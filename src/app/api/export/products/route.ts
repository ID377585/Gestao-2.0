// src/app/api/export/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ✅ IMPORTANTE: rota usa cookies/auth → precisa ser dinâmica no build
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

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

/**
 * ✅ Tipagem explícita do retorno do export
 * (evita o TS inferir GenericStringError quando o schema/types não batem 100%)
 */
type ProductExportRow = {
  id: string | null;
  establishment_id: string | null;
  sku: string | null;
  name: string | null;
  product_type: string | null;
  default_unit_label: string | null;
  package_qty: number | string | null;
  qty_per_package: string | null;
  category: string | null;
  price: number | string | null;
  conversion_factor: number | string | null;
  is_active: boolean | null;
};

export async function GET(_request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    /**
     * ✅ API Route: autenticação correta (sem redirect/exceptions)
     */
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    /**
     * ✅ Pega establishment_id do membership do usuário
     * Ajuste o nome da tabela/colunas se no seu banco for diferente.
     */
    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("establishment_id, organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      console.error("Erro ao buscar membership:", membershipError);
      return NextResponse.json(
        { error: "Erro ao buscar estabelecimento do usuário." },
        { status: 500 }
      );
    }

    const establishmentId: string | null =
      (membership as any)?.establishment_id ??
      (membership as any)?.organization_id ??
      null;

    if (!establishmentId) {
      return NextResponse.json(
        { error: "Estabelecimento não encontrado para o usuário atual." },
        { status: 403 }
      );
    }

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
    query = query.eq("establishment_id", establishmentId);

    // ✅ Cast controlado: evita GenericStringError derrubar a build
    const { data, error } = await (query as any);

    if (error) {
      console.error("Erro ao exportar produtos:", error);
      return NextResponse.json(
        { error: "Erro ao exportar produtos." },
        { status: 500 }
      );
    }

    const products = (Array.isArray(data) ? data : []) as ProductExportRow[];

    // Cabeçalho do CSV
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
    rows.push(header.join(";"));

    for (const p of products) {
      if (!p) continue;

      // package_qty: tenta converter, mas só formata se não der NaN
      let packageQtyFormatted = "";
      if (p.package_qty !== null && p.package_qty !== undefined) {
        const n = Number(p.package_qty);
        packageQtyFormatted = !Number.isNaN(n) ? formatNumber(n, 3) : "";
      }

      // qty_per_package é texto livre
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
        conversionFormatted = !Number.isNaN(n) ? formatNumber(n, 4) : "";
      }

      const row = [
        csvField(p.id ?? ""),
        csvField(p.sku ?? ""),
        csvField(p.name ?? ""),
        csvField(p.product_type ?? ""),
        csvField(p.default_unit_label ?? ""),
        csvField(packageQtyFormatted),
        csvField(qtyPerPackageText),
        csvField(p.category ?? ""),
        csvField(priceFormatted),
        csvField(conversionFormatted),
        csvField(p.is_active ? 1 : 0),
      ];

      rows.push(row.join(";"));
    }

    // BOM para Excel reconhecer UTF-8
    const csvContent = "\uFEFF" + rows.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="produtos.csv"',
      },
    });
  } catch (err) {
    console.error("Erro inesperado em export produtos:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao exportar produtos." },
      { status: 500 }
    );
  }
}
