import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";
import {
  isProductSectorConstraintError,
  normalizeProductSectorCategory,
} from "@/lib/product-sectors";

export const dynamic = "force-dynamic";

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeUnit(value: unknown) {
  return String(value ?? "UN").trim().toUpperCase() || "UN";
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    let tenantContext: Awaited<ReturnType<typeof getAuthenticatedTenantUserOrThrow>>;

    try {
      tenantContext = await getAuthenticatedTenantUserOrThrow();
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message ?? "Usuário não autenticado." },
        { status: error?.message === "Não autenticado." ? 401 : 403 }
      );
    }

    const { user, tenant } = tenantContext;
    const establishmentId = tenant.establishmentId;
    const body = await req.json();

    const name = normalizeText(body.name);
    const sku = normalizeText(body.sku) || null;
    const defaultUnitLabel = normalizeUnit(body.default_unit_label);
    const category = normalizeText(body.category) || null;
    const sectorCategory = normalizeProductSectorCategory(body.sector_category);
    const price = toNumber(body.price, 0);
    const standardCost = toNumber(body.standard_cost, 0);

    if (!name) {
      return NextResponse.json({ error: "Nome do produto é obrigatório." }, { status: 400 });
    }

    const insertPayload = {
      establishment_id: establishmentId,
      name,
      sku,
      default_unit_label: defaultUnitLabel,
      category,
      sector_category: sectorCategory,
      price,
      standard_cost: standardCost,
      created_by: user.id,
      is_active: true,
    };

    let { data, error } = await supabase
      .from("products")
      .insert(insertPayload)
      .select(`
        id,
        name,
        sku,
        default_unit_label,
        price,
        standard_cost,
        category,
        sector_category,
        shelf_life_days
      `)
      .single();

    if (isProductSectorConstraintError(error) && insertPayload.sector_category) {
      ({ data, error } = await supabase
        .from("products")
        .insert({
          ...insertPayload,
          sector_category: null,
        })
        .select(`
          id,
          name,
          sku,
          default_unit_label,
          price,
          standard_cost,
          category,
          sector_category,
          shelf_life_days
        `)
        .single());
    }

    if (error || !data) {
      console.error("Erro ao criar produto rapidamente:", error);
      return NextResponse.json(
        { error: error?.message ?? "Não foi possível criar o produto." },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error("Erro inesperado em quick-create:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}
