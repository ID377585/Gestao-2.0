import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { membership } = await getActiveMembershipOrRedirect();

    const establishmentId = (membership as any)?.establishment_id as
      | string
      | undefined;

    if (!establishmentId) {
      return NextResponse.json(
        { error: "Estabelecimento não encontrado." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        sku,
        default_unit_label,
        price,
        standard_cost,
        category,
        sector_category,
        shelf_life_days,
        package_qty,
        qty_per_package,
        conversion_factor,
        allergens
      `)
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Erro ao listar catálogo de produtos:", error);
      return NextResponse.json(
        { error: "Erro ao listar produtos." },
        { status: 500 }
      );
    }

    return NextResponse.json(data ?? [], { status: 200 });
  } catch (error: any) {
    console.error("Erro inesperado em /api/products/catalog:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}