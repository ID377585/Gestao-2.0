import { NextResponse } from "next/server";
import { privateCacheHeaders } from "@/lib/cache/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "api:products:catalog",
      limit: 90,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const supabase = await createSupabaseServerClient();
    let tenantContext: Awaited<ReturnType<typeof getAuthenticatedTenantUserOrThrow>>;

    try {
      tenantContext = await getAuthenticatedTenantUserOrThrow();
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message ?? "Estabelecimento não encontrado." },
        { status: error?.message === "Não autenticado." ? 401 : 403 }
      );
    }

    const establishmentId = tenantContext.tenant.establishmentId;

    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        sku,
        price,
        brand,
        product_type,
        standard_cost,
        default_unit_label,
        sector_category,
        category,
        package_qty,
        qty_per_package,
        aliases,
        alternate_names,
        allergens,
        is_active
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

    return NextResponse.json(data ?? [], {
      status: 200,
      headers: privateCacheHeaders(30),
    });
  } catch (error: any) {
    console.error("Erro inesperado em /api/products/catalog:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}
