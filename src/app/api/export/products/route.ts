// src/app/api/export/products/route.ts
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
 * Escapa campo para CSV usando ; como separador.
 */
function csvField(value: any): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  // Se contiver ;, " ou quebra de linha, envolve em aspas e escapa aspas internas
  if (/[;"\r\n]/.test(text)) {
    text = text.replace(/"/g, '""');
    return `"${text}"`;
  }

  return text;
}

/**
 * Formata números para pt-BR (com vírgula) com casas decimais.
 */
function formatNumber(value: number | null | undefined, decimals: number) {
  if (value === null || value === undefined) return "";
  if (Number.isNaN(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export async function GET(_request: Request) {
  try {
    const membership = await getActiveMembershipOrRedirect();
    const { organization_id, establishment_id } = membership as any;

    const establishmentId =
      normalizeId(establishment_id) ?? normalizeId(organization_id);

    const supabase = await createSupabaseServerClient();

    // Campos que queremos exportar
    const selectFields = [
      "id",
      "establishment_id",
      "sku",
      "name",
      "product_type",
      "default_unit_label",
      "package_qty",
      "qty_per_package",
      "category",
      "price",
      "conversion_factor",
      "is_active",
    ].join(", ");

    let query = supabase.from("products").select(selectFields);

    if (establishmentId) {
      query = query.eq("establishment_id", establishmentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Erro ao exportar produtos:", error);
      return NextResponse.json(
        { error: "Erro ao exportar produtos." },
        { status: 500 },
      );
    }

    const products = data ?? [];

    // Cabeçalho do CSV (ordem que será usada também no import)
    const header = [
      "id",
      "sku",
      "name",
      "product_type",
      "default_unit_label",
      "package_qty",
      "qty_per_package",
      "category",
      "price",
      "conversion_factor",
      "is_active",
    ];

    const rows: string[] = [];

    // linha de cabeçalho com ;
    rows.push(header.join(";"));

    for (const p of products) {
      // package_qty: tenta converter, mas só formata se não der NaN
      let packageQtyFormatted = "";
      if (p.package_qty !== null && p.package_qty !== undefined) {
        const n = Number(p.package_qty);
        packageQtyFormatted = !Number.isNaN(n)
          ? formatNumber(n, 3)
          : "";
      }

      // qty_per_package AGORA É TEXTO LIVRE (não fazemos Number nem formatNumber)
      const qtyPerPackageText =
        p.qty_per_package !== null && p.qty_per_package !== undefined
          ? String(p.qty_per_package)
          : "";

      // price
      let priceFormatted = "";
      if (p.price !== null && p.price !== undefined) {
        const n = Number(p.price);
        priceFormatted = !Number.isNaN(n) ? formatNumber(n, 2) : "";
      }

      // conversion_factor
      let conversionFormatted = "";
      if (p.conversion_factor !== null && p.conversion_factor !== undefined) {
        const n = Number(p.conversion_factor);
        conversionFormatted = !Number.isNaN(n)
          ? formatNumber(n, 4)
          : "";
      }

      const row = [
        csvField(p.id),
        csvField(p.sku ?? ""),
        csvField(p.name ?? ""),
        csvField(p.product_type ?? ""),
        csvField(p.default_unit_label ?? ""),
        csvField(packageQtyFormatted),     // SEM NaN
        csvField(qtyPerPackageText),       // TEXTO PURO
        csvField(p.category ?? ""),
        csvField(priceFormatted),          // SEM NaN
        csvField(conversionFormatted),     // SEM NaN
        csvField(p.is_active ? 1 : 0),
      ];

      rows.push(row.join(";"));
    }

    // Adiciona BOM para o Excel reconhecer UTF-8
    const csvContent = "\uFEFF" + rows.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="produtos.csv"',
      },
    });
  } catch (err) {
    console.error("Erro inesperado em /api/export/products:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao exportar produtos." },
      { status: 500 },
    );
  }
}
