// src/app/api/import/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

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
  if (!value) return null;
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
  // muitas libs usam cors/no-cors/same-origin, mas em fetch geralmente aparece "cors"
  if (secFetchMode && secFetchMode !== "navigate") return true;

  return false;
}

export async function POST(request: Request) {
  try {
    const membership = await getActiveMembershipOrRedirect();
    const { organization_id, establishment_id, user_id } = membership as any;

    const establishmentId =
      normalizeId(establishment_id) ?? normalizeId(organization_id);
    const userId = normalizeId(user_id);

    if (!establishmentId) {
      const msg = "Estabelecimento não encontrado no membership.";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não enviado." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(arrayBuffer);

    // remove BOM se existir
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }

    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.trim().length > 0);

    if (lines.length <= 1) {
      return NextResponse.json(
        { error: "Arquivo sem dados para importar." },
        { status: 400 },
      );
    }

    const headerLine = lines[0];
    const delimiter = detectDelimiter(headerLine);
    const headers = parseCsvLine(headerLine, delimiter).map((h) => h.trim());

    // garante headers mínimas
    const required = ["name", "product_type", "default_unit_label"];
    const missing = required.filter((k) => !headers.includes(k));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          error: `CSV inválido. Cabeçalhos obrigatórios ausentes: ${missing.join(
            ", ",
          )}`,
        },
        { status: 400 },
      );
    }

    const records: Record<string, string>[]= [];

    for (const line of lines.slice(1)) {
      const cols = parseCsvLine(line, delimiter);
      const rec: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rec[h] = (cols[idx] ?? "").trim();
      });
      records.push(rec);
    }

    // Separação inteligente:
    // - Se tiver ID válido => upsert por id (PK) (atualiza)
    // - Se não tiver ID:
    //    - se tiver sku => upsert por (establishment_id, sku) (evita duplicar)
    //    - se não tiver sku => insert puro
    const upsertById: any[] = [];
    const upsertBySku: any[] = [];
    const insertNoSku: any[] = [];

    let skipped = 0;

    for (const rec of records) {
      const idRaw = rec["id"]?.trim() || "";
      const id = normalizeId(idRaw);

      const skuRaw = rec["sku"]?.trim() || "";
      const sku = skuRaw.length > 0 ? skuRaw : null;

      const name = (rec["name"] ?? "").trim();
      const product_type = (rec["product_type"] ?? "INSU").trim() || "INSU";
      const default_unit_label =
        (rec["default_unit_label"] ?? "un").trim() || "un";

      // NUMÉRICO: package_qty
      const package_qty = parseNumberStr(rec["package_qty"], 3);

      // TEXTO: qty_per_package
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

      // payload base
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

      // auditoria (opcional)
      const nowIso = new Date().toISOString();

      if (id) {
        // update por id (PK)
        upsertById.push({
          id, // PK
          establishment_id: establishmentId, // segurança extra
          ...basePayload,
          ...(userId
            ? {
                updated_by: userId,
                updated_at: nowIso,
              }
            : {}),
        });
      } else {
        // sem id => criar
        const createPayload: any = {
          establishment_id: establishmentId,
          ...basePayload,
          ...(userId
            ? {
                created_by: userId,
                created_at: nowIso,
              }
            : {}),
        };

        if (sku) {
          upsertBySku.push(createPayload);
        } else {
          insertNoSku.push(createPayload);
        }
      }
    }

    // 1) UPSERT por SKU (evita duplicar se sku já existe no estabelecimento)
    // OBS: Precisa de UNIQUE/INDEX em (establishment_id, sku) para funcionar perfeito.
    // Se não tiver, o Supabase vai reclamar e a gente cai no insert.
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
        // fallback: tenta insert simples (vai duplicar se já existir)
        const { error: fallbackErr } = await supabase
          .from("products")
          .insert(upsertBySku);

        if (fallbackErr) {
          console.error("Erro fallback insert (sku) (import):", fallbackErr);
          return NextResponse.json(
            { error: "Erro ao inserir/atualizar produtos por SKU." },
            { status: 500 },
          );
        }
      } else {
        upsertSkuInsertedOrUpdated = (data ?? []).length;
      }
    }

    // 2) INSERT para registros SEM SKU (sempre cria novo)
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
          { status: 500 },
        );
      }
      insertedNoSku = (data ?? []).length;
    }

    // 3) UPSERT por ID (PK) (atualiza em lote)
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

        // fallback: atualiza 1 a 1 (mantém compatibilidade)
        for (const rec of upsertById) {
          const { id, establishment_id, ...rest } = rec;
          const { error: updateErr } = await supabase
            .from("products")
            .update(rest)
            .eq("id", id)
            .eq("establishment_id", establishmentId);

          if (updateErr) {
            console.error(
              `Erro fallback update produto id=${id} (import):`,
              updateErr,
            );
            return NextResponse.json(
              { error: `Erro ao atualizar produto id=${id}.` },
              { status: 500 },
            );
          }
        }
        updatedById = upsertById.length;
      } else {
        updatedById = (data ?? []).length;
      }
    }

    const insertedOrUpserted = upsertSkuInsertedOrUpdated + insertedNoSku;
    const updated = updatedById; // updates reais por id
    const summary = {
      ok: true,
      insertedOrUpserted,
      updated,
      skipped,
      totalLines: records.length,
    };

    // ✅ IMPORTANTE: se veio via fetch/AJAX, retorna JSON
    if (wantsJson(request)) {
      return NextResponse.json(summary, { status: 200 });
    }

    // ✅ Submit normal: redirect para tela
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
