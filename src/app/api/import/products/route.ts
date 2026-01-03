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
  decimals = 3
): number | null {
  if (value == null) return null;
  const str = String(value).replace(",", ".").trim();
  if (!str) return null;
  const n = Number(str);
  if (Number.isNaN(n)) return null;
  return Number(n.toFixed(decimals));
}

/**
 * Determina o delimitador do CSV ( ; ou , )
 */
function detectDelimiter(headerLine: string): ";" | "," {
  if (headerLine.includes(";")) return ";";
  return ",";
}

/**
 * Parser de CSV linha-a-linha com suporte básico a aspas:
 * - Delimitador ; ou ,
 * - Campos entre aspas podem conter delimitador
 * - Aspas duplas dentro de aspas: "" vira "
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // "" dentro de campo com aspas -> "
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

/**
 * Heurística: se request veio via fetch/AJAX, devolvemos JSON ao invés de redirect.
 */
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
 * ✅ Split robusto para Windows/Mac/Linux:
 * - CRLF (\r\n)
 * - LF (\n)
 * - CR (\r)  <-- Excel no Mac às vezes salva assim
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

/**
 * ✅ Chunk helper (Supabase tem limite prático de tamanho no .in())
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(request: Request) {
  try {
    const membership = await getActiveMembershipOrRedirect();
    const { organization_id, establishment_id, user_id } = membership as any;

    const membershipEstablishmentId =
      normalizeId(establishment_id) ?? normalizeId(organization_id);

    const supabase = await createSupabaseServerClient();

    // ✅ Melhoria: pegar o userId REAL do auth (evita falha de policy quando membership.user_id vem vazio)
    let authUserId: string | null = null;
    try {
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) console.error("Erro ao obter usuário via auth.getUser():", authErr);
      authUserId = normalizeId(authData?.user?.id);
    } catch (e) {
      console.error("Falha inesperada em auth.getUser():", e);
    }

    const userId = normalizeId(user_id) ?? authUserId;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Arquivo não enviado." }, { status: 400 });
    }

    // ✅ Bloqueia XLSX com mensagem clara
    const fileName = (file as any)?.name ? String((file as any).name) : "";
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith(".xlsx") || String(file.type).includes("spreadsheetml")) {
      return NextResponse.json(
        {
          error:
            "Formato .xlsx não suportado nesta importação. Exporte como CSV (de preferência 'CSV UTF-8') e tente novamente.",
        },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(arrayBuffer);

    // remove BOM se existir
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
        { status: 400 }
      );
    }

    const headerLine = lines[0];
    const delimiter = detectDelimiter(headerLine);

    // ✅ Normaliza headers (case-insensitive)
    const headersRaw = parseCsvLine(headerLine, delimiter).map((h) => h.trim());
    const headers = headersRaw.map((h) => h.toLowerCase());

    // ✅ Cabeçalhos mínimos
    const required = ["name", "product_type", "default_unit_label"];
    const missing = required.filter((k) => !headers.includes(k));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `CSV inválido. Cabeçalhos obrigatórios ausentes: ${missing.join(", ")}`,
          debug: { headers: headersRaw },
        },
        { status: 400 }
      );
    }

    // Monta records
    const records: Record<string, string>[] = [];
    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line, delimiter);
      const rec: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rec[h] = (cols[idx] ?? "").trim();
      });
      records.push(rec);
    }

    // ==========================================================
    // ✅ RESOLVER establishment_id EFETIVO
    // ==========================================================
    const csvEstabSet = new Set<string>();
    for (const rec of records) {
      const csvEstab = normalizeId(rec["establishment_id"]);
      if (csvEstab) csvEstabSet.add(csvEstab);
    }

    let effectiveEstablishmentId: string | null = null;

    if (membershipEstablishmentId) {
      effectiveEstablishmentId = membershipEstablishmentId;

      if (csvEstabSet.size > 0) {
        for (const v of csvEstabSet.values()) {
          if (v !== membershipEstablishmentId) {
            return NextResponse.json(
              {
                error:
                  "CSV contém establishment_id diferente do establishment do usuário logado. Verifique o UUID do estabelecimento.",
                debug: {
                  membershipEstablishmentId,
                  csvEstablishmentIds: Array.from(csvEstabSet),
                },
              },
              { status: 400 }
            );
          }
        }
      }
    } else {
      if (csvEstabSet.size !== 1) {
        return NextResponse.json(
          {
            error:
              "Estabelecimento não encontrado no membership. Preencha a coluna establishment_id no CSV com o MESMO UUID em todas as linhas.",
            debug: {
              csvEstablishmentIds: Array.from(csvEstabSet),
            },
          },
          { status: 400 }
        );
      }
      effectiveEstablishmentId = Array.from(csvEstabSet)[0];
    }

    if (!effectiveEstablishmentId) {
      return NextResponse.json(
        { error: "Não foi possível determinar o establishment_id para importar." },
        { status: 400 }
      );
    }

    // ==========================================================
    // ✅ Preparação de payloads + DEDUPE por SKU (evita erro de duplicidade no mesmo CSV)
    // ==========================================================
    const bySku = new Map<string, any>(); // sku -> payload (última ocorrência vence)
    const upsertById: any[] = [];
    const insertNoSku: any[] = [];

    let skipped = 0;
    const nowIso = new Date().toISOString();

    for (const rec of records) {
      const id = normalizeId(rec["id"]?.trim() || null);

      const skuRaw = rec["sku"]?.trim() || "";
      const sku = skuRaw.length > 0 ? skuRaw : null;

      const name = (rec["name"] ?? "").trim();
      const product_type = ((rec["product_type"] ?? "INSU").trim() || "INSU").toUpperCase();
      const default_unit_label = (rec["default_unit_label"] ?? "un").trim() || "un";

      const package_qty = parseNumberStr(rec["package_qty"], 3);

      const qty_per_package =
        rec["qty_per_package"] && rec["qty_per_package"].trim().length > 0
          ? rec["qty_per_package"].trim()
          : null;

      // ✅ price é NOT NULL no banco -> se vier vazio, vira 0
      const priceParsed = parseNumberStr(rec["price"], 2);
      const price = priceParsed ?? 0;

      const conversion_factor = parseNumberStr(rec["conversion_factor"], 4) ?? 1;

      const category =
        rec["category"] && rec["category"].trim().length > 0 ? rec["category"].trim() : null;

      const is_active_raw = (rec["is_active"] ?? "1").trim().toLowerCase();
      const is_active = is_active_raw === "1" || is_active_raw === "true" || is_active_raw === "sim";

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
        price,
        conversion_factor,
        is_active,
      };

      if (id) {
        upsertById.push({
          id,
          establishment_id: effectiveEstablishmentId,
          ...basePayload,
          ...(userId
            ? {
                updated_by: userId,
                updated_at: nowIso,
              }
            : {}),
        });
        continue;
      }

      const createPayload: any = {
        establishment_id: effectiveEstablishmentId,
        ...basePayload,
        ...(userId
          ? {
              created_by: userId,
              created_at: nowIso,
            }
          : {}),
      };

      if (sku) {
        // ✅ dedupe por sku
        bySku.set(sku, createPayload);
      } else {
        insertNoSku.push(createPayload);
      }
    }

    const dedupedBySku = Array.from(bySku.values());
    const dedupedSkuList = Array.from(bySku.keys());

    // ==========================================================
    // ✅ 1) UPSERT por SKU (MODO ROBUSTO, sem depender de ON CONFLICT)
    // - Busca existentes (id, sku) do estabelecimento
    // - Faz UPDATE em lote por id
    // - Faz INSERT do que não existe
    // ==========================================================
    let upsertSkuInsertedOrUpdated = 0;

    if (dedupedBySku.length > 0) {
      // 1.1 buscar existentes em chunks
      const existingBySku = new Map<string, string>(); // sku -> id
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
            { status: 500 }
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
          const { establishment_id, ...rest } = payload; // não mexe no estab no update
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

      // 1.2 update em lote via upsert por id (PK)
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
            { status: 500 }
          );
        }
        upsertSkuInsertedOrUpdated += (upData ?? []).length;
      }

      // 1.3 insert do que não existe
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
            { status: 500 }
          );
        }
        upsertSkuInsertedOrUpdated += (insData ?? []).length;
      }
    }

    // ==========================================================
    // ✅ 2) INSERT sem SKU
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
          { status: 500 }
        );
      }

      insertedNoSku = (data ?? []).length;
    }

    // ==========================================================
    // ✅ 3) UPSERT por ID (quando vier id no CSV)
    // ==========================================================
    let updatedById = 0;
    if (upsertById.length > 0) {
      const { error: upsertIdErr, data } = await supabase
        .from("products")
        .upsert(upsertById, {
          onConflict: "id",
          ignoreDuplicates: false,
        })
        .select("id");

      if (upsertIdErr) {
        console.error("Erro upsert por ID (import):", upsertIdErr);

        // fallback update 1 a 1
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
                details: {
                  update: errDetails(updateErr),
                },
              },
              { status: 500 }
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
      303
    );
  } catch (err) {
    console.error("Erro inesperado em /api/import/products:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao importar produtos." },
      { status: 500 }
    );
  }
}
