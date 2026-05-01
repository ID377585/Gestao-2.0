// src/app/api/import/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { normalizeAllergenList } from "@/lib/allergens";
import {
  PRODUCT_SECTOR_CATEGORIES,
  normalizeProductSectorCategory,
} from "@/lib/product-sectors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

function parseNumberStr(
  value: string | null | undefined,
  decimals = 3,
): number | null {
  if (value == null) return null;
  const str = String(value).replace(",", ".").trim();
  if (!str) return null;
  const n = Number(str);
  if (Number.isNaN(n)) return null;
  return Number(n.toFixed(decimals));
}

function parseIntSafeCsv(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  const i = Math.trunc(n);
  return i < 0 ? null : i;
}

const UNIT_ALIASES: Record<string, "UN" | "KG" | "G" | "L" | "ML"> = {
  UN: "UN",
  UNID: "UN",
  UNIDADE: "UN",
  KG: "KG",
  KILO: "KG",
  QUILO: "KG",
  G: "G",
  GR: "G",
  GRAMA: "G",
  L: "L",
  LT: "L",
  LITRO: "L",
  ML: "ML",
};

function normalizeUnitCsv(
  value: string | null | undefined,
): "UN" | "KG" | "G" | "L" | "ML" {
  const raw = String(value ?? "").trim().toUpperCase();
  return UNIT_ALIASES[raw] ?? "UN";
}

function cleanTextFromExcel(value: string) {
  return value.replace(/\u00A0/g, " ").trim();
}

function detectDelimiter(headerLine: string): "\t" | ";" | "," {
  if (headerLine.includes("\t")) return "\t";
  if (headerLine.includes(";")) return ";";
  return ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

function wantsJson(request: Request) {
  const accept = request.headers.get("accept") || "";
  const xrw = request.headers.get("x-requested-with") || "";
  const secFetchMode = request.headers.get("sec-fetch-mode") || "";

  if (accept.includes("application/json")) return true;
  if (xrw.toLowerCase() === "xmlhttprequest") return true;
  if (secFetchMode && secFetchMode !== "navigate") return true;

  return false;
}

function respondError(
  request: Request,
  message: string,
  status = 400,
  extra?: any,
) {
  if (wantsJson(request)) {
    return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
  }

  const url = new URL("/dashboard/produtos", request.url);
  url.searchParams.set("error", encodeURIComponent(message));
  return NextResponse.redirect(url, 303);
}

function splitLinesRobusto(text: string): string[] {
  return text
    .split(/\r\n|\n|\r/g)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);
}

function errDetails(err: any) {
  if (!err) return null;
  return {
    message: err.message,
    code: err.code,
    hint: err.hint,
    details: err.details,
  };
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeHeader(h: string) {
  const cleaned = cleanTextFromExcel(String(h ?? ""));
  return cleaned.replace(/^\uFEFF/, "").trim().toLowerCase();
}

function findOptionalHeader(headers: string[], candidates: string[]) {
  return candidates.find((candidate) => headers.includes(candidate)) ?? null;
}

async function loadAllowedSectorCategoriesFromDb(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("products")
    .select("sector_category")
    .eq("establishment_id", establishmentId)
    .limit(2000);

  if (error) {
    console.error("[import.products] load sector_category from db error:", error);
    return [...PRODUCT_SECTOR_CATEGORIES];
  }

  const set = new Set<string>();
  for (const row of data ?? []) {
    const v = cleanTextFromExcel(
      String((row as any)?.sector_category ?? ""),
    ).trim();
    if (v) set.add(v);
  }

  if (set.size === 0) return [...PRODUCT_SECTOR_CATEGORIES];

  return Array.from(set.values());
}

function normalizeSectorCategoryWithAllowed(
  value: string | null | undefined,
  allowed: string[],
): string | null {
  const normalized = normalizeProductSectorCategory(value);
  if (normalized) return normalized;

  const raw = cleanTextFromExcel(String(value ?? ""));
  if (!raw) return null;

  const map = new Map<string, string>();
  for (const a of allowed) {
    map.set(cleanTextFromExcel(a).toLowerCase(), cleanTextFromExcel(a));
  }

  const hit = map.get(raw.toLowerCase());
  return hit ?? null;
}

/**
 * Busca SKUs existentes e determina o próximo SKU numérico.
 */
async function loadExistingSkuContext(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  establishmentId: string,
): Promise<{ existingSkuSet: Set<string>; nextSkuNumber: number }> {
  const existingSkuSet = new Set<string>();
  const pageSize = 1000;
  let from = 0;
  let maxNumericSku = 0;

  while (true) {
    const to = from + pageSize - 1;

    const { data, error } = await supabase
      .from("products")
      .select("sku")
      .eq("establishment_id", establishmentId)
      .range(from, to);

    if (error) {
      throw new Error(`Falha ao carregar SKUs existentes: ${error.message}`);
    }

    const rows = data ?? [];
    for (const row of rows) {
      const raw = String((row as any)?.sku ?? "").trim();
      if (!raw) continue;

      existingSkuSet.add(raw);

      if (/^\d+$/.test(raw)) {
        const n = Number(raw);
        if (!Number.isNaN(n) && n > maxNumericSku) {
          maxNumericSku = n;
        }
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return {
    existingSkuSet,
    nextSkuNumber: maxNumericSku + 1,
  };
}

function generateSequentialSku(
  ctx: { existingSkuSet: Set<string>; nextSkuNumber: number },
): string {
  while (ctx.existingSkuSet.has(String(ctx.nextSkuNumber))) {
    ctx.nextSkuNumber += 1;
  }

  const sku = String(ctx.nextSkuNumber);
  ctx.existingSkuSet.add(sku);
  ctx.nextSkuNumber += 1;
  return sku;
}

async function resolveEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<{ establishmentId: string | null; debug: string[] }> {
  const debug: string[] = [];

  try {
    const helperRes = await getActiveMembershipOrRedirect();
    const membership = (helperRes as any)?.membership ?? helperRes;

    const estId = normalizeId((membership as any)?.establishment_id);
    const orgId = normalizeId((membership as any)?.organization_id);
    const picked = estId ?? orgId ?? null;

    debug.push(
      `membership-helper: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`,
    );
    if (picked) return { establishmentId: picked, debug };

    debug.push("membership-helper: sem establishment/org no membership");
  } catch (e: any) {
    debug.push(`membership-helper: falhou (${e?.message ?? "sem mensagem"})`);
  }

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      debug.push("auth.getUser: falhou/sem user");
      return { establishmentId: null, debug };
    }

    const userId = userData.user.id;
    debug.push(`auth.getUser: ok (user=${userId})`);

    try {
      const { data: m, error: mErr } = await supabase
        .from("memberships")
        .select("establishment_id, organization_id")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mErr) {
        debug.push(`fallback memberships: erro (${mErr.message})`);
      } else {
        const estId = normalizeId((m as any)?.establishment_id);
        const orgId = normalizeId((m as any)?.organization_id);
        const picked = estId ?? orgId ?? null;

        debug.push(
          `fallback memberships: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`,
        );
        if (picked) return { establishmentId: picked, debug };
      }
    } catch (e: any) {
      debug.push(
        `fallback memberships: exceção (${e?.message ?? "sem mensagem"})`,
      );
    }

    try {
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("establishment_id, organization_id")
        .eq("id", userId)
        .maybeSingle();

      if (pErr) {
        debug.push(`fallback profiles: erro (${pErr.message})`);
      } else {
        const estId = normalizeId((p as any)?.establishment_id);
        const orgId = normalizeId((p as any)?.organization_id);
        const picked = estId ?? orgId ?? null;

        debug.push(
          `fallback profiles: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`,
        );
        if (picked) return { establishmentId: picked, debug };
      }
    } catch (e: any) {
      debug.push(
        `fallback profiles: exceção (${e?.message ?? "sem mensagem"})`,
      );
    }

    return { establishmentId: null, debug };
  } catch (e: any) {
    debug.push(`auth+fallback: exceção geral (${e?.message ?? "sem mensagem"})`);
    return { establishmentId: null, debug };
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const { establishmentId: resolvedEstablishmentId, debug } =
      await resolveEstablishmentId(supabase);

    let authUserId: string | null = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      authUserId = normalizeId(authData?.user?.id);
    } catch {}

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return respondError(request, "Arquivo não enviado.", 400);
    }

    const fileName = (file as any)?.name ? String((file as any).name) : "";
    const lowerName = fileName.toLowerCase();
    if (
      lowerName.endsWith(".xlsx") ||
      String(file.type).includes("spreadsheetml")
    ) {
      return respondError(
        request,
        "Formato .xlsx não suportado nesta importação. Exporte como CSV (de preferência 'CSV UTF-8') e tente novamente.",
        400,
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(arrayBuffer);

    if (text && text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    const lines = splitLinesRobusto(text);

    if (lines.length <= 1) {
      const preview = text.slice(0, 300);
      return respondError(request, "Arquivo sem dados para importar.", 400, {
        debug: {
          fileName,
          fileType: file.type,
          size: (file as any)?.size ?? null,
          first300chars: preview,
          detectedLines: lines.length,
        },
      });
    }

    const headerLine = lines[0];
    const delimiter = detectDelimiter(headerLine);

    const headersRaw = parseCsvLine(headerLine, delimiter).map((h) =>
      String(h ?? "").trim(),
    );
    const headers = headersRaw.map((h) => normalizeHeader(h));

    const required = ["name", "product_type", "default_unit_label"];
    const missing = required.filter((k) => !headers.includes(k));
    if (missing.length > 0) {
      return respondError(
        request,
        `CSV inválido. Cabeçalhos obrigatórios ausentes: ${missing.join(", ")}`,
        400,
        { debug: { headers: headersRaw, delimiter_detected: delimiter } },
      );
    }

    const records: Record<string, string>[] = [];
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line, delimiter);
      const rec: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rec[h] = cleanTextFromExcel(String(cols[idx] ?? ""));
      });
      records.push(rec);
    }

    const allergensHeader = findOptionalHeader(headers, [
      "allergens",
      "alergenico",
      "alergenicos",
      "alergênico",
      "alergênicos",
    ]);

    const csvEstabSet = new Set<string>();
    for (const rec of records) {
      const csvEstab = normalizeId(rec["establishment_id"]);
      if (csvEstab) csvEstabSet.add(csvEstab);
    }

    let effectiveEstablishmentId: string | null = resolvedEstablishmentId;

    if (effectiveEstablishmentId) {
      if (csvEstabSet.size > 0) {
        for (const v of csvEstabSet.values()) {
          if (v !== effectiveEstablishmentId) {
            return respondError(
              request,
              "CSV contém establishment_id diferente do establishment do usuário logado. Verifique o UUID.",
              400,
              {
                debug: {
                  resolvedEstablishmentId: effectiveEstablishmentId,
                  csvEstablishmentIds: Array.from(csvEstabSet),
                  resolveDebug: debug,
                },
              },
            );
          }
        }
      }
    } else {
      if (csvEstabSet.size !== 1) {
        return respondError(
          request,
          "Estabelecimento não encontrado no membership/login. Preencha a coluna establishment_id no CSV com o MESMO UUID em todas as linhas.",
          400,
          {
            debug: {
              csvEstablishmentIds: Array.from(csvEstabSet),
              resolveDebug: debug,
            },
          },
        );
      }
      effectiveEstablishmentId = Array.from(csvEstabSet)[0];
    }

    if (!effectiveEstablishmentId) {
      return respondError(
        request,
        "Não foi possível determinar o establishment_id para importar.",
        400,
        { debug: { resolveDebug: debug } },
      );
    }

    const allowedSectorCategories = await loadAllowedSectorCategoriesFromDb(
      supabase,
      effectiveEstablishmentId,
    );

    const skuContext = await loadExistingSkuContext(
      supabase,
      effectiveEstablishmentId,
    );

    const bySku = new Map<string, any>();
    const insertNoSku: any[] = [];
    const withIdPayloads: any[] = [];

    let skipped = 0;
    const nowIso = new Date().toISOString();
    const userId = authUserId;

    const warnings: any[] = [];

    for (const rec of records) {
      const id = normalizeId(rec["id"]?.trim() || null);

      let skuRaw = rec["sku"]?.trim() || "";
      if (!skuRaw) {
        skuRaw = generateSequentialSku(skuContext);
      }

      const sku = skuRaw.length > 0 ? skuRaw : null;

      const name = cleanTextFromExcel(String(rec["name"] ?? ""));
      const brand =
        rec["brand"] && rec["brand"].trim().length > 0
          ? cleanTextFromExcel(String(rec["brand"]))
          : null;

      const product_type = (
        cleanTextFromExcel(String(rec["product_type"] ?? "INSU")) || "INSU"
      ).toUpperCase();

      const default_unit_label = normalizeUnitCsv(rec["default_unit_label"]);
      const package_qty = parseNumberStr(rec["package_qty"], 3);

      const qty_per_package =
        rec["qty_per_package"] && rec["qty_per_package"].trim().length > 0
          ? cleanTextFromExcel(String(rec["qty_per_package"]))
          : null;

      const priceParsed = parseNumberStr(rec["price"], 2);
      const price = priceParsed ?? 0;
      const conversion_factor = parseNumberStr(rec["conversion_factor"], 4) ?? 1;

      const category =
        rec["category"] && rec["category"].trim().length > 0
          ? cleanTextFromExcel(String(rec["category"]))
          : null;

      const sector_category_raw = rec["sector_category"];
      const sector_category = normalizeSectorCategoryWithAllowed(
        sector_category_raw,
        allowedSectorCategories,
      );

      if (
        String(sector_category_raw ?? "").trim().length > 0 &&
        !sector_category
      ) {
        warnings.push({
          id,
          sku,
          name,
          field: "sector_category",
          value: sector_category_raw,
          action: "set_null_to_avoid_check_constraint",
          allowed_examples: allowedSectorCategories.slice(0, 20),
        });
      }

      const shelf_life_days = parseIntSafeCsv(rec["shelf_life_days"]);

      const is_active_raw = (rec["is_active"] ?? "1").trim().toLowerCase();
      const is_active =
        is_active_raw === "1" ||
        is_active_raw === "true" ||
        is_active_raw === "sim";

      if (!name) {
        skipped++;
        continue;
      }

      const basePayload: any = {
        sku,
        name,
        brand,
        product_type,
        default_unit_label,
        package_qty,
        qty_per_package,
        category,
        sector_category: sector_category ?? null,
        shelf_life_days,
        price,
        conversion_factor,
        is_active,
      };

      if (allergensHeader) {
        basePayload.allergens = normalizeAllergenList(rec[allergensHeader]);
      }

      if (id) {
        withIdPayloads.push({
          id,
          establishment_id: effectiveEstablishmentId,
          ...basePayload,
        });
        continue;
      }

      const createPayload: any = {
        establishment_id: effectiveEstablishmentId,
        ...basePayload,
        ...(userId ? { created_by: userId, created_at: nowIso } : {}),
      };

      if (sku) bySku.set(sku, createPayload);
      else insertNoSku.push(createPayload);
    }

    const dedupedBySku = Array.from(bySku.values());
    const dedupedSkuList = Array.from(bySku.keys());

    let upsertSkuInsertedOrUpdated = 0;

    if (dedupedBySku.length > 0) {
      const existingBySku = new Map<string, string>();
      const skuChunks = chunkArray(dedupedSkuList, 250);

      for (const chunk of skuChunks) {
        const { data: existing, error: existingErr } = await supabase
          .from("products")
          .select("id,sku")
          .eq("establishment_id", effectiveEstablishmentId)
          .in("sku", chunk);

        if (existingErr) {
          console.error(
            "Erro ao buscar produtos existentes por SKU (import):",
            existingErr,
          );
          return respondError(
            request,
            "Erro ao preparar importação (busca por SKU).",
            500,
            { details: { select: errDetails(existingErr) } },
          );
        }

        for (const row of existing ?? []) {
          if ((row as any)?.sku) {
            existingBySku.set(
              String((row as any).sku),
              String((row as any).id),
            );
          }
        }
      }

      const toUpdateById: any[] = [];
      const toInsert: any[] = [];

      for (const payload of dedupedBySku) {
        const sku = String(payload.sku);
        const existingId = existingBySku.get(sku);

        if (existingId) {
          const { establishment_id, ...rest } = payload;
          toUpdateById.push({
            id: existingId,
            establishment_id: effectiveEstablishmentId,
            ...rest,
            ...(userId ? { updated_by: userId, updated_at: nowIso } : {}),
          });
        } else {
          toInsert.push(payload);
        }
      }

      if (toUpdateById.length > 0) {
        const { error: upErr, data: upData } = await supabase
          .from("products")
          .upsert(toUpdateById, { onConflict: "id", ignoreDuplicates: false })
          .select("id");

        if (upErr) {
          console.error(
            "Erro ao atualizar produtos por SKU (via id) (import):",
            upErr,
          );
          return respondError(
            request,
            "Erro ao atualizar produtos existentes (por SKU).",
            500,
            { details: { upsertById: errDetails(upErr) } },
          );
        }
        upsertSkuInsertedOrUpdated += (upData ?? []).length;
      }

      if (toInsert.length > 0) {
        const { error: insErr, data: insData } = await supabase
          .from("products")
          .insert(toInsert)
          .select("id");

        if (insErr) {
          console.error(
            "Erro ao inserir novos produtos (por SKU) (import):",
            insErr,
          );
          return respondError(
            request,
            "Erro ao inserir novos produtos (por SKU).",
            500,
            { details: { insert: errDetails(insErr) } },
          );
        }
        upsertSkuInsertedOrUpdated += (insData ?? []).length;
      }
    }

    let insertedNoSku = 0;
    if (insertNoSku.length > 0) {
      const { error: insertErr, data } = await supabase
        .from("products")
        .insert(insertNoSku)
        .select("id");

      if (insertErr) {
        console.error("Erro ao inserir produtos sem SKU (import):", insertErr);
        return respondError(
          request,
          "Erro ao inserir produtos (sem SKU).",
          500,
          {
            details: {
              insert: errDetails(insertErr),
              info: {
                effectiveEstablishmentId,
                hasUserId: Boolean(userId),
                userIdUsed: userId ?? null,
              },
            },
          },
        );
      }

      insertedNoSku = (data ?? []).length;
    }

    let insertedWithId = 0;
    let updatedById = 0;

    if (withIdPayloads.length > 0) {
      const ids = Array.from(
        new Set(withIdPayloads.map((p) => String(p.id)).filter(Boolean)),
      );

      const existingIdSet = new Set<string>();
      const idChunks = chunkArray(ids, 250);

      for (const chunk of idChunks) {
        const { data: existing, error: existingErr } = await supabase
          .from("products")
          .select("id")
          .eq("establishment_id", effectiveEstablishmentId)
          .in("id", chunk);

        if (existingErr) {
          console.error(
            "Erro ao buscar produtos existentes por ID (import):",
            existingErr,
          );
          return respondError(
            request,
            "Erro ao preparar importação (busca por ID).",
            500,
            { details: { select: errDetails(existingErr) } },
          );
        }

        for (const row of existing ?? []) {
          if ((row as any)?.id) existingIdSet.add(String((row as any).id));
        }
      }

      const skuList = Array.from(
        new Set(
          withIdPayloads
            .map((p) => String((p as any)?.sku ?? "").trim())
            .filter((v) => v.length > 0),
        ),
      );

      const existingBySku = new Map<string, string>();
      if (skuList.length > 0) {
        const skuChunks = chunkArray(skuList, 250);

        for (const chunk of skuChunks) {
          const { data: existingSkuRows, error: existingSkuErr } = await supabase
            .from("products")
            .select("id,sku")
            .eq("establishment_id", effectiveEstablishmentId)
            .in("sku", chunk);

          if (existingSkuErr) {
            console.error(
              "Erro ao buscar produtos existentes por SKU (import - withId):",
              existingSkuErr,
            );
            return respondError(
              request,
              "Erro ao preparar importação (busca por SKU).",
              500,
              { details: { select: errDetails(existingSkuErr) } },
            );
          }

          for (const row of existingSkuRows ?? []) {
            if ((row as any)?.sku && (row as any)?.id) {
              existingBySku.set(
                String((row as any).sku),
                String((row as any).id),
              );
            }
          }
        }
      }

      const toInsertWithId: any[] = [];
      const toUpdateById: any[] = [];

      for (const payload of withIdPayloads) {
        const csvId = String(payload.id);
        const sku = String((payload as any)?.sku ?? "").trim();
        const existingIdFromSku = sku ? existingBySku.get(sku) : null;

        if (existingIdSet.has(csvId)) {
          toUpdateById.push({
            ...payload,
            ...(userId ? { updated_by: userId, updated_at: nowIso } : {}),
          });
          continue;
        }

        if (existingIdFromSku) {
          const { id: _ignoreIdFromCsv, ...restPayload } = payload;

          toUpdateById.push({
            ...restPayload,
            id: existingIdFromSku,
            establishment_id: effectiveEstablishmentId,
            ...(userId ? { updated_by: userId, updated_at: nowIso } : {}),
          });
          continue;
        }

        toInsertWithId.push({
          ...payload,
          ...(userId ? { created_by: userId, created_at: nowIso } : {}),
        });
      }

      if (toInsertWithId.length > 0) {
        const { error: insErr, data: insData } = await supabase
          .from("products")
          .insert(toInsertWithId)
          .select("id");

        if (insErr) {
          console.error("Erro ao inserir produtos com ID (import):", insErr);
          return respondError(
            request,
            "Erro ao inserir produtos (com ID do CSV).",
            500,
            { details: { insert: errDetails(insErr) } },
          );
        }

        insertedWithId = (insData ?? []).length;
      }

      if (toUpdateById.length > 0) {
        const { error: upsertIdErr, data } = await supabase
          .from("products")
          .upsert(toUpdateById, { onConflict: "id", ignoreDuplicates: false })
          .select("id");

        if (upsertIdErr) {
          console.error("Erro upsert por ID (import):", upsertIdErr);

          for (const rec of toUpdateById) {
            const { id, ...rest } = rec;

            const { error: updateErr } = await supabase
              .from("products")
              .update(rest)
              .eq("id", id)
              .eq("establishment_id", effectiveEstablishmentId);

            if (updateErr) {
              console.error(
                `Erro fallback update produto id=${id} (import):`,
                updateErr,
              );
              return respondError(
                request,
                `Erro ao atualizar produto id=${id}.`,
                500,
                { details: { update: errDetails(updateErr) } },
              );
            }
          }

          updatedById = toUpdateById.length;
        } else {
          updatedById = (data ?? []).length;
        }
      }
    }

    const summary: any = {
      ok: true,
      insertedOrUpserted:
        upsertSkuInsertedOrUpdated + insertedNoSku + insertedWithId,
      updated: updatedById,
      skipped,
      totalLines: records.length,
      establishment_id_used: effectiveEstablishmentId,
      delimiter_used: delimiter,
      user_id_used: userId ?? null,
      sku_stats: {
        received_with_sku: bySku.size,
        deduped_with_sku: dedupedBySku.length,
        note: "Linhas sem SKU agora recebem código automático sequencial.",
      },
      id_stats: {
        received_with_id: withIdPayloads.length,
        inserted_with_id: insertedWithId,
        updated_by_id: updatedById,
      },
    };

    if (warnings.length > 0) {
      summary.warnings = {
        count: warnings.length,
        examples: warnings.slice(0, 30),
        note:
          "Algumas linhas tinham sector_category que o banco não reconheceu. Para não violar o CHECK, o valor foi definido como NULL nessas linhas.",
      };
    }

    const affected = (summary.insertedOrUpserted ?? 0) + (summary.updated ?? 0);

    if (affected === 0) {
      return respondError(
        request,
        "Importação concluída, mas nenhuma linha foi inserida/atualizada. Verifique se o CSV possui 'name' preenchido, se o establishment_id está correto e se você está consultando a tabela 'products' (não 'produtos') no Supabase.",
        400,
        { summary },
      );
    }

    if (wantsJson(request)) {
      return NextResponse.json(summary, { status: 200 });
    }

    return NextResponse.redirect(
      new URL("/dashboard/produtos?success=import", request.url),
      303,
    );
  } catch (err: any) {
    console.error("Erro inesperado em /api/import/products:", err);

    return respondError(
      request,
      "Erro inesperado ao importar produtos.",
      500,
      { details: errDetails(err) },
    );
  }
}
