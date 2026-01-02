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

export async function POST(request: Request) {
  try {
    const membership = await getActiveMembershipOrRedirect();
    const { organization_id, establishment_id, user_id } = membership as any;

    const membershipEstablishmentId =
      normalizeId(establishment_id) ?? normalizeId(organization_id);
    const userId = normalizeId(user_id);

    const supabase = await createSupabaseServerClient();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado." },
        { status: 400 }
      );
    }

    // ✅ Bloqueia XLSX com mensagem clara (mantendo CSV como padrão)
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

    // ✅ tenta decodificar como UTF-8
    let text = new TextDecoder("utf-8").decode(arrayBuffer);

    // remove BOM se existir
    if (text && text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    // ✅ linhas robustas (corrige Mac \r)
    const lines = splitLinesRobusto(text);

    if (lines.length <= 1) {
      // ✅ debug leve para você enxergar o que o servidor leu
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
    const headers = parseCsvLine(headerLine, delimiter).map((h) => h.trim());

    // ✅ Cabeçalhos mínimos
    const required = ["name", "product_type", "default_unit_label"];
    const missing = required.filter((k) => !headers.includes(k));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `CSV inválido. Cabeçalhos obrigatórios ausentes: ${missing.join(", ")}`,
          debug: { headers },
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
    // - se membership tem establishment => usamos ele
    //   e se CSV vier com outro => ERRO
    // - se membership NÃO tem establishment => exigimos 1 único establishment_id no CSV
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
    // Separação inteligente:
    // - Se tiver ID válido => upsert por id (PK) (atualiza)
    // - Se não tiver ID:
    //    - se tiver sku => upsert por (establishment_id, sku)
    //    - se não tiver sku => insert puro
    // ==========================================================

    const upsertById: any[] = [];
    const upsertBySku: any[] = [];
    const insertNoSku: any[] = [];

    let skipped = 0;
    const nowIso = new Date().toISOString();

    for (const rec of records) {
      const id = normalizeId(rec["id"]?.trim() || null);

      const skuRaw = rec["sku"]?.trim() || "";
      const sku = skuRaw.length > 0 ? skuRaw : null;

      const name = (rec["name"] ?? "").trim();

      const product_type = ((rec["product_type"] ?? "INSU").trim() || "INSU")
        .toUpperCase();

      const default_unit_label =
        (rec["default_unit_label"] ?? "un").trim() || "un";

      const package_qty = parseNumberStr(rec["package_qty"], 3);

      const qty_per_package =
        rec["qty_per_package"] && rec["qty_per_package"].trim().length > 0
          ? rec["qty_per_package"].trim()
          : null;

      const price = parseNumberStr(rec["price"], 2);
      const conversion_factor = parseNumberStr(rec["conversion_factor"], 4);

      const category =
        rec["category"] && rec["category"].trim().length > 0
          ? rec["category"].trim()
          : null;

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
        product_type,
        default_unit_label,
        package_qty,
        qty_per_package,
        category,
        price,
        conversion_factor: conversion_factor ?? 1,
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
      } else {
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

        if (sku) upsertBySku.push(createPayload);
        else insertNoSku.push(createPayload);
      }
    }

    // 1) UPSERT por SKU
    let upsertSkuInsertedOrUpdated = 0;
    if (upsertBySku.length > 0) {
      const { error: upsertSkuErr, data } = await supabase
        .from("products")
        .upsert(upsertBySku, {
          onConflict: "establishment_id,sku",
          ignoreDuplicates: false,
        })
        .select("id");

      if (upsertSkuErr) {
        console.error("Erro upsert por SKU (import):", upsertSkuErr);
        const { error: fallbackErr } = await supabase
          .from("products")
          .insert(upsertBySku);

        if (fallbackErr) {
          console.error("Erro fallback insert (sku) (import):", fallbackErr);
          return NextResponse.json(
            { error: "Erro ao inserir/atualizar produtos por SKU." },
            { status: 500 }
          );
        }
      } else {
        upsertSkuInsertedOrUpdated = (data ?? []).length;
      }
    }

    // 2) INSERT sem SKU
    let insertedNoSku = 0;
    if (insertNoSku.length > 0) {
      const { error: insertErr, data } = await supabase
        .from("products")
        .insert(insertNoSku)
        .select("id");

      if (insertErr) {
        console.error("Erro ao inserir produtos sem SKU (import):", insertErr);
        return NextResponse.json(
          { error: "Erro ao inserir produtos (sem SKU)." },
          { status: 500 }
        );
      }
      insertedNoSku = (data ?? []).length;
    }

    // 3) UPSERT por ID
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

        for (const rec of upsertById) {
          const { id, ...rest } = rec;
          const { error: updateErr } = await supabase
            .from("products")
            .update(rest)
            .eq("id", id)
            .eq("establishment_id", effectiveEstablishmentId);

          if (updateErr) {
            console.error(
              `Erro fallback update produto id=${id} (import):`,
              updateErr
            );
            return NextResponse.json(
              { error: `Erro ao atualizar produto id=${id}.` },
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
    };

    // ✅ Se veio via fetch/AJAX, retorna JSON
    if (wantsJson(request)) {
      return NextResponse.json(summary, { status: 200 });
    }

    // ✅ Submit normal: redirect
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
