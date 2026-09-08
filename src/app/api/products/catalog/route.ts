import { NextResponse } from "next/server";
import { privateCacheHeaders } from "@/lib/cache/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const PRODUCT_CATALOG_CACHE_TTL_MS = 15_000;
const PRODUCT_CATALOG_CACHE_MAX_TENANTS = 100;

type ProductCatalogCacheEntry = {
  expiresAt: number;
  data: unknown[];
};

const productCatalogCache = new Map<string, ProductCatalogCacheEntry>();

function readProductCatalogCache(establishmentId: string) {
  // Tenant contract: establishmentId originates from getAuthenticatedTenantUserOrThrow.
  const now = Date.now();
  const cached = productCatalogCache.get(establishmentId);

  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  if (cached) {
    productCatalogCache.delete(establishmentId);
  }

  return null;
}

function writeProductCatalogCache(establishmentId: string, data: unknown[]) {
  // Tenant contract: establishmentId originates from getAuthenticatedTenantUserOrThrow.
  const now = Date.now();

  if (productCatalogCache.size >= PRODUCT_CATALOG_CACHE_MAX_TENANTS) {
    for (const [tenantId, entry] of productCatalogCache) {
      if (entry.expiresAt <= now) {
        productCatalogCache.delete(tenantId);
      }
    }
  }

  if (productCatalogCache.size >= PRODUCT_CATALOG_CACHE_MAX_TENANTS) {
    const oldestTenantId = productCatalogCache.keys().next().value as string | undefined;
    if (oldestTenantId) productCatalogCache.delete(oldestTenantId);
  }

  productCatalogCache.set(establishmentId, {
    data,
    expiresAt: now + PRODUCT_CATALOG_CACHE_TTL_MS,
  });
}

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
    const cachedCatalog = readProductCatalogCache(establishmentId);

    if (cachedCatalog) {
      return NextResponse.json(cachedCatalog, {
        status: 200,
        headers: privateCacheHeaders(30),
      });
    }

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

    const catalog = data ?? [];
    writeProductCatalogCache(establishmentId, catalog);

    return NextResponse.json(catalog, {
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
