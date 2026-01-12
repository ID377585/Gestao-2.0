// src/app/api/import/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Normaliza possível ID para evitar "undefined"/"null" em string.
 */
function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

/**
 * Converte string de número em number aceitando vírgula ou ponto.
 */
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

/**
 * ✅ parse inteiro (dias) seguro
 */
function parseIntSafeCsv(value: string | null | undefined): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  if (Number.isNaN(n)) return null;
  const i = Math.trunc(n);
  return i < 0 ? null : i;
}

/**
 * ✅ Normaliza unidade (CSV → valores aceitos no banco/app)
 * Suporta aliases comuns do Excel: UNID, LITRO, etc.
 */
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

/**
 * ✅ Setor (Categoria) — deve bater com o CHECK do banco
 * Use exatamente o mesmo conjunto do dropdown em ProductsPage.
 */
const SECTOR_CATEGORIES = [
  "Confeitaria",
  "Padaria",
  "Açougue",
  "Produção",
  "Massaria",
  "Burrataria",
  "Secos",
  "Embalagens",
  "Hortifruti",
  "Produto de Limpeza",
  "Descartáveis",
  "Bebidas",
] as const;

function normalizeSectorCategoryCsv(
  value: string | null | undefined,
): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  // remove NBSP (muito comum vindo do Excel)
  const cleaned = raw.replace(/\u00A0/g, " ").trim();

  const hit = (SECTOR_CATEGORIES as readonly string[]).find(
    (c) => c.toLowerCase() === cleaned.toLowerCase(),
  );

  return hit ?? null;
}

/**
 * Determina o delimitador do CSV/TSV (TAB, ; ou ,)
 * - Excel/Sheets às vezes exporta como TSV (tab)
 * - escolhe o delimitador com maior contagem no header
 */
function detectDelimiter(headerLine: string): "\t" | ";" | "," {
  const counts = {
    tab: (headerLine.match(/\t/g) || []).length,
    semicolon: (headerLine.match(/;/g) || []).length,
    comma: (headerLine.match(/,/g) || []).length,
  };

  if (
    counts.tab >= counts.semicolon &&
    counts.tab >= counts.comma &&
    counts.tab > 0
  )
    return "\t";
  if (counts.semicolon >= counts.comma && counts.semicolon > 0) return ";";
  return ",";
}

/**
 * Parser de CSV/TSV linha-a-linha com suporte básico a aspas
 */
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

/**
 * Split robusto para Windows/Mac/Linux
 */
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

/**
 * ✅ Resolve establishment_id com múltiplas estratégias (igual ao export)
 */
async function resolveEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<{ establishmentId: string | null; debug: string[] }> {
  const debug: string[] = [];

  // 1) helper do app
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

  // 2) fallback auth.getUser + memberships + profiles
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      debug.push("auth.getUser: falhou/sem user");
      return { establishmentId: null, debug };
    }

    const userId = userData.user.id;
    debug.push(`auth.getUser: ok (user=${userId})`);

    // memberships
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

    // profiles
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

    // ✅ resolve establishment de forma robusta
    const { establishmentId: resolvedEstablishmentId, debug } =
      await resolveEstablishmentId(supabase);

    // user id real
    let authUserId: string | null = null;
    try {
      const { data: authData } = await supabase.auth.getUser();
      authUserId = normalizeId(authData?.user?.id);
    } catch {}

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    }

    const fileName = (file as any)?.name ? String((file as any).name) : "";
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".xlsx") || String(file.type).includes("spreadsheetml")) {
      return NextResponse.json(
        {
          error:
            "Formato .xlsx não suportado nesta importação. Exporte como CSV (de preferência 'CSV UTF-8') e tente novamente.",
        },
        { status: 400 },
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
      return NextResponse.json(
        {
          error: "Arquivo sem dados para importar.",
          debug: {
            fileName,
            fileType: file.type,
            size: (file as any)?.size ?? null,
            first300chars: preview,
            detectedLines: lines.length,
          },
        },
        { status: 400 },
      );
    }

    const headerLine = lines[0];
    const delimiter = detectDelimiter(headerLine);

    const headersRaw = parseCsvLine(headerLine, delimiter).map((h) => h.trim());
    const headers = headersRaw.map((h) => h.toLowerCase());

    const required = ["name", "product_type", "default_unit_label"];
    const missing = required.filter((k) => !headers.includes(k));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `CSV inválido. Cabeçalhos obrigatórios ausentes: ${missing.join(", ")}`,
          debug: { headers: headersRaw, delimiter_used: delimiter },
        },
        { status: 400 },
      );
    }

    // records
    const records: Record<string, string>[] = [];
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line, delimiter);
      const rec: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rec[h] = (cols[idx] ?? "").trim();
      });
      records.push(rec);
    }

    // csv establishment ids (se existir coluna)
    const csvEstabSet = new Set<string>();
    for (const rec of records) {
      const csvEstab = normalizeId(rec["establishment_id"]);
      if (csvEstab) csvEstabSet.add(csvEstab);
    }

    // ✅ Determina establishment efetivo:
    // 1) resolved pelo usuário logado
    // 2) se não der, usa o CSV (mas exige 1 único UUID)
    let effectiveEstablishmentId: string | null = resolvedEstablishmentId;

    if (effectiveEstablishmentId) {
      // se CSV tiver ids, valida consistência
      if (csvEstabSet.size > 0) {
        for (const v of csvEstabSet.values()) {
          if (v !== effectiveEstablishmentId) {
            return NextResponse.json(
              {
                error:
                  "CSV contém establishment_id diferente do establishment do usuário logado. Verifique o UUID.",
                debug: {
                  resolvedEstablishmentId: effectiveEstablishmentId,
                  csvEstablishmentIds: Array.from(csvEstabSet),
                  resolveDebug: debug,
                },
              },
              { status: 400 },
            );
          }
        }
      }
    } else {
      // não conseguiu resolver pelo login → exige CSV preenchido
      if (csvEstabSet.size !== 1) {
        return NextResponse.json(
          {
            error:
              "Estabelecimento não encontrado no membership/login. Preencha a coluna establishment_id no CSV com o MESMO UUID em todas as linhas.",
            debug: {
              csvEstablishmentIds: Array.from(csvEstabSet),
              resolveDebug: debug,
            },
          },
          { status: 400 },
        );
      }
      effectiveEstablishmentId = Array.from(csvEstabSet)[0];
    }

    if (!effectiveEstablishmentId) {
      return NextResponse.json(
        {
          error: "Não foi possível determinar o establishment_id para importar.",
          debug: { resolveDebug: debug },
        },
        { status: 400 },
      );
    }

    // ==========================================================
    // Payloads + dedupe
    // ==========================================================
    const bySku = new Map<string, any>();
    const upsertById: any[] = [];
    const insertNoSku: any[] = [];

    let skipped = 0;
    const nowIso = new Date().toISOString();
    const userId = authUserId; // usa auth real

    // ✅ coleta linhas inválidas para não quebrar constraint no banco
    const invalids: any[] = [];

    for (const rec of records) {
      const id = normalizeId(rec["id"]?.trim() || null);

      const skuRaw = rec["sku"]?.trim() || "";
      const sku = skuRaw.length > 0 ? skuRaw : null;

      const name = (rec["name"] ?? "").trim();
      const product_type = (
        (rec["product_type"] ?? "INSU").trim() || "INSU"
      ).toUpperCase();

      // ✅ normaliza UNID/LITRO/etc → UN/L
      const default_unit_label = normalizeUnitCsv(rec["default_unit_label"]);

      const package_qty = parseNumberStr(rec["package_qty"], 3);

      const qty_per_package =
        rec["qty_per_package"] && rec["qty_per_package"].trim().length > 0
          ? rec["qty_per_package"].trim()
          : null;

      const priceParsed = parseNumberStr(rec["price"], 2);
      const price = priceParsed ?? 0;

      const conversion_factor = parseNumberStr(rec["conversion_factor"], 4) ?? 1;

      const category =
        rec["category"] && rec["category"].trim().length > 0
          ? rec["category"].trim()
          : null;

      // ✅ normaliza e garante que bate com o CHECK do banco
      const sector_category_raw = rec["sector_category"];
      const sector_category = normalizeSectorCategoryCsv(sector_category_raw);

      // se veio preenchido mas não bate com a lista, ignora linha e devolve debug
      if (String(sector_category_raw ?? "").trim().length > 0 && !sector_category) {
        invalids.push({
          id,
          sku,
          name,
          field: "sector_category",
          value: sector_category_raw,
        });
        continue;
      }

      // ✅ NOVO: importa shelf_life_days (se vier no CSV)
      const shelf_life_days = parseIntSafeCsv(rec["shelf_life_days"]);

      const is_active_raw = (rec["is_active"] ?? "1").trim().toLowerCase();
      const is_active =
        is_active_raw === "1" || is_active_raw === "true" || is_active_raw === "sim";

      if (!name) {
        skipped++;
        continue;
      }

      const basePayload: any = {
        sku,
        name,
        product_type,
        default_unit_label,
        package_qty,
        qty_per_package,
        category,
        sector_category,
        shelf_life_days, // ✅ adiciona no payload
        price,
        conversion_factor,
        is_active,
      };

      if (id) {
        upsertById.push({
          id,
          establishment_id: effectiveEstablishmentId,
          ...basePayload,
          ...(userId ? { updated_by: userId, updated_at: nowIso } : {}),
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

    // ✅ se houver valores inválidos, aborta antes de bater no banco
    if (invalids.length > 0) {
      return NextResponse.json(
        {
          error:
            "Importação cancelada: existem valores inválidos em sector_category que não passam no CHECK do banco.",
          debug: {
            invalid_count: invalids.length,
            invalids: invalids.slice(0, 30),
          },
        },
        { status: 400 },
      );
    }

    const dedupedBySku = Array.from(bySku.values());
    const dedupedSkuList = Array.from(bySku.keys());

    // ==========================================================
    // 1) UPSERT por SKU robusto
    // ==========================================================
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
          console.error("Erro ao buscar produtos existentes por SKU (import):", existingErr);
          return NextResponse.json(
            {
              error: "Erro ao preparar importação (busca por SKU).",
              details: { select: errDetails(existingErr) },
            },
            { status: 500 },
          );
        }

        for (const row of existing ?? []) {
          if (row?.sku) existingBySku.set(String(row.sku), String(row.id));
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
          console.error("Erro ao atualizar produtos por SKU (via id) (import):", upErr);
          return NextResponse.json(
            {
              error: "Erro ao atualizar produtos existentes (por SKU).",
              details: { upsertById: errDetails(upErr) },
            },
            { status: 500 },
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
          console.error("Erro ao inserir novos produtos (por SKU) (import):", insErr);
          return NextResponse.json(
            {
              error: "Erro ao inserir novos produtos (por SKU).",
              details: { insert: errDetails(insErr) },
            },
            { status: 500 },
          );
        }
        upsertSkuInsertedOrUpdated += (insData ?? []).length;
      }
    }

    // ==========================================================
    // 2) INSERT sem SKU
    // ==========================================================
    let insertedNoSku = 0;
    if (insertNoSku.length > 0) {
      const { error: insertErr, data } = await supabase
        .from("products")
        .insert(insertNoSku)
        .select("id");

      if (insertErr) {
        console.error("Erro ao inserir produtos sem SKU (import):", insertErr);
        return NextResponse.json(
          {
            error: "Erro ao inserir produtos (sem SKU).",
            details: {
              insert: errDetails(insertErr),
              info: {
                effectiveEstablishmentId,
                hasUserId: Boolean(userId),
                userIdUsed: userId ?? null,
              },
            },
          },
          { status: 500 },
        );
      }

      insertedNoSku = (data ?? []).length;
    }

    // ==========================================================
    // 3) UPSERT por ID (quando vier id no CSV)
    // ==========================================================
    let updatedById = 0;
    if (upsertById.length > 0) {
      const { error: upsertIdErr, data } = await supabase
        .from("products")
        .upsert(upsertById, { onConflict: "id", ignoreDuplicates: false })
        .select("id");

      if (upsertIdErr) {
        console.error("Erro upsert por ID (import):", upsertIdErr);

        for (const rec of upsertById) {
          const { id, ...rest } = rec;
          const { error: updateErr } = await supabase
            .from("products")
            .update(rest)
            .eq("id", id)
            .eq("establishment_id", effectiveEstablishmentId);

          if (updateErr) {
            console.error(`Erro fallback update produto id=${id} (import):`, updateErr);
            return NextResponse.json(
              {
                error: `Erro ao atualizar produto id=${id}.`,
                details: { update: errDetails(updateErr) },
              },
              { status: 500 },
            );
          }
        }

        updatedById = upsertById.length;
      } else {
        updatedById = (data ?? []).length;
      }
    }

    const summary = {
      ok: true,
      insertedOrUpserted: upsertSkuInsertedOrUpdated + insertedNoSku,
      updated: updatedById,
      skipped,
      totalLines: records.length,
      establishment_id_used: effectiveEstablishmentId,
      delimiter_used: delimiter,
      user_id_used: userId ?? null,
      sku_stats: {
        received_with_sku: bySku.size,
        deduped_with_sku: dedupedBySku.length,
      },
    };

    if (wantsJson(request)) {
      return NextResponse.json(summary, { status: 200 });
    }

    return NextResponse.redirect(
      new URL("/dashboard/produtos?success=import", request.url),
      303,
    );
  } catch (err) {
    console.error("Erro inesperado em /api/import/products:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao importar produtos." },
      { status: 500 },
    );
  }
}
