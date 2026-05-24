// src/app/api/export/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeAllergenList } from "@/lib/allergens";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function csvField(value: any): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  if (/[;"\r\n]/.test(text)) {
    text = text.replace(/"/g, '""');
    return `"${text}"`;
  }

  return text;
}

function formatNumber(value: number | null | undefined, decimals: number) {
  if (value === null || value === undefined) return "";
  if (Number.isNaN(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

type ProductExportRow = {
  id: string | null;
  establishment_id: string | null;
  sku: string | null;
  name: string | null;
  brand: string | null;
  product_type: string | null;
  default_unit_label: string | null;
  package_qty: number | string | null;
  qty_per_package: string | null;
  category: string | null;
  sector_category: string | null;
  shelf_life_days: number | string | null;
  price: number | string | null;
  conversion_factor: number | string | null;
  allergens: string[] | string | null;
  is_active: boolean | null;
};

export async function GET(_request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    let establishmentId: string;

    try {
      const { tenant } = await getAuthenticatedTenantUserOrThrow();
      establishmentId = tenant.establishmentId;
    } catch (error: any) {
      console.error("Export products: establishmentId não resolvido", {
        message: error?.message,
      });
      return NextResponse.json(
        {
          error:
            "Não foi possível identificar o estabelecimento do usuário. Verifique membership/profiles e RLS.",
        },
        { status: error?.message === "Não autenticado." ? 401 : 403 },
      );
    }

    const selectFields = [
      "id",
      "establishment_id",
      "sku",
      "name",
      "brand",
      "product_type",
      "default_unit_label",
      "package_qty",
      "qty_per_package",
      "category",
      "sector_category",
      "shelf_life_days",
      "price",
      "conversion_factor",
      "allergens",
      "is_active",
    ].join(", ");

    const query = supabase
      .from("products")
      .select(selectFields)
      .eq("establishment_id", establishmentId);

    const { data, error } = await (query as any);

    if (error) {
      console.error("Erro ao exportar produtos:", error);
      return NextResponse.json(
        { error: "Erro ao exportar produtos." },
        { status: 500 },
      );
    }

    const products = (Array.isArray(data) ? data : []) as ProductExportRow[];

    const header = [
      "id",
      "establishment_id",
      "sku",
      "name",
      "brand",
      "product_type",
      "default_unit_label",
      "package_qty",
      "qty_per_package",
      "category",
      "sector_category",
      "shelf_life_days",
      "price",
      "conversion_factor",
      "allergens",
      "is_active",
    ];

    const rows: string[] = [];
    rows.push(header.join(";"));

    for (const p of products) {
      if (!p) continue;

      let packageQtyFormatted = "";
      if (p.package_qty !== null && p.package_qty !== undefined) {
        const n = Number(p.package_qty);
        packageQtyFormatted = !Number.isNaN(n) ? formatNumber(n, 3) : "";
      }

      const qtyPerPackageText =
        p.qty_per_package !== null && p.qty_per_package !== undefined
          ? String(p.qty_per_package)
          : "";

      let shelfLifeFormatted = "";
      if (p.shelf_life_days !== null && p.shelf_life_days !== undefined) {
        const n = Number(p.shelf_life_days);
        shelfLifeFormatted = !Number.isNaN(n) ? String(Math.trunc(n)) : "";
      }

      let priceFormatted = "";
      if (p.price !== null && p.price !== undefined) {
        const n = Number(p.price);
        priceFormatted = !Number.isNaN(n) ? formatNumber(n, 2) : "";
      }

      let conversionFormatted = "";
      if (p.conversion_factor !== null && p.conversion_factor !== undefined) {
        const n = Number(p.conversion_factor);
        conversionFormatted = !Number.isNaN(n) ? formatNumber(n, 4) : "";
      }

      const sectorCategoryText =
        p.sector_category !== null && p.sector_category !== undefined
          ? String(p.sector_category)
          : "";
      const allergensText = normalizeAllergenList(p.allergens).join(", ");

      const row = [
        csvField(p.id ?? ""),
        csvField(p.establishment_id ?? ""),
        csvField(p.sku ?? ""),
        csvField(p.name ?? ""),
        csvField(p.brand ?? ""),
        csvField(p.product_type ?? ""),
        csvField(p.default_unit_label ?? ""),
        csvField(packageQtyFormatted),
        csvField(qtyPerPackageText),
        csvField(p.category ?? ""),
        csvField(sectorCategoryText),
        csvField(shelfLifeFormatted),
        csvField(priceFormatted),
        csvField(conversionFormatted),
        csvField(allergensText),
        csvField(p.is_active ? 1 : 0),
      ];

      rows.push(row.join(";"));
    }

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
      { status: 500 },
    );
  }
}
