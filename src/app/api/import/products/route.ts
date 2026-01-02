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
  const str = value.replace(",", ".").trim();
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

export async function POST(request: Request) {
  try {
    const membership = await getActiveMembershipOrRedirect();
    const { organization_id, establishment_id, user_id } = membership as any;

    const establishmentId =
      normalizeId(establishment_id) ?? normalizeId(organization_id);
    const userId = normalizeId(user_id);

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
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) {
      return NextResponse.json(
        { error: "Arquivo sem dados para importar." },
        { status: 400 },
      );
    }

    const headerLine = lines[0];
    const delimiter = detectDelimiter(headerLine);
    const headers = headerLine.split(delimiter).map((h) => h.trim());

    const records: Record<string, string>[] = [];

    for (const line of lines.slice(1)) {
      const cols = line.split(delimiter);
      const rec: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rec[h] = (cols[idx] ?? "").trim();
      });
      records.push(rec);
    }

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    for (const rec of records) {
      const id = rec["id"]?.trim() || null;
      const sku = rec["sku"]?.trim() || null;
      const name = rec["name"]?.trim() || "";
      const product_type = rec["product_type"]?.trim() || "INSU";
      const default_unit_label = rec["default_unit_label"]?.trim() || "un";

      // NUMÉRICO: package_qty
      const package_qty = parseNumberStr(rec["package_qty"], 3);

      // *** TEXTO: qty_per_package (NÃO PARSEAR, APENAS TRIM) ***
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

      const is_active_raw = rec["is_active"]?.trim().toLowerCase() ?? "1";
      const is_active =
        is_active_raw === "1" ||
        is_active_raw === "true" ||
        is_active_raw === "sim";

      if (!name) {
        // pula linha sem nome
        continue;
      }

      if (id) {
        // atualização
        toUpdate.push({
          id,
          sku,
          name,
          product_type,
          default_unit_label,
          package_qty,
          qty_per_package, // TEXTO
          category,
          price,
          conversion_factor,
          is_active,
          ...(userId
            ? {
                updated_by: userId,
                updated_at: new Date().toISOString(),
              }
            : {}),
        });
      } else {
        // novo registro
        toInsert.push({
          sku,
          name,
          product_type,
          default_unit_label,
          package_qty,
          qty_per_package, // TEXTO
          category,
          price,
          conversion_factor: conversion_factor ?? 1,
          is_active,
          ...(establishmentId
            ? { establishment_id: establishmentId }
            : {}),
          ...(userId
            ? {
                created_by: userId,
                created_at: new Date().toISOString(),
              }
            : {}),
        });
      }
    }

    // INSERÇÕES
    if (toInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("products")
        .insert(toInsert);

      if (insertError) {
        console.error("Erro ao inserir produtos (import):", insertError);
        return NextResponse.json(
          { error: "Erro ao inserir novos produtos." },
          { status: 500 },
        );
      }
    }

    // ATUALIZAÇÕES
    for (const rec of toUpdate) {
      const { id, ...rest } = rec;
      const { error: updateError } = await supabase
        .from("products")
        .update(rest)
        .eq("id", id);

      if (updateError) {
        console.error(
          `Erro ao atualizar produto id=${id} (import):`,
          updateError,
        );
        return NextResponse.json(
          { error: `Erro ao atualizar produto id=${id}.` },
          { status: 500 },
        );
      }
    }

    // mantém o mesmo parâmetro de sucesso já usado
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
