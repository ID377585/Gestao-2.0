"use server";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export type SalesPriceBenchmarkExtrasInput = {
  productId: string;
  xFactor?: number | null;
  calculatedSalePrice?: number | null;
  definedSalePrice?: number | null;
  percentVsLowestCompetitor?: number | null;
  lowestCompetitorMarkup?: number | null;
  markupDifference?: number | null;
};

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function getContext() {
  const supabaseAuth = await createSupabaseServerClient();
  const supabase = createSupabaseAdminClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id as string | undefined;

  if (!establishmentId) throw new Error("Estabelecimento não encontrado para o usuário atual.");

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) throw new Error("Usuário não autenticado.");

  return { supabase, establishmentId, userId: user.id };
}

export async function saveSalesPriceBenchmarkExtras(input: SalesPriceBenchmarkExtrasInput) {
  try {
    const { supabase, establishmentId, userId } = await getContext();
    if (!input.productId) return { ok: false, error: "Produto não informado." };

    const payload = {
      establishment_id: establishmentId,
      product_id: input.productId,
      dish_type: "Prato Principal",
      x_factor: toNullableNumber(input.xFactor),
      calculated_sale_price: toNullableNumber(input.calculatedSalePrice),
      defined_sale_price: toNullableNumber(input.definedSalePrice),
      percent_vs_lowest_competitor: toNullableNumber(input.percentVsLowestCompetitor),
      lowest_competitor_markup: toNullableNumber(input.lowestCompetitorMarkup),
      markup_difference: toNullableNumber(input.markupDifference),
      created_by: userId,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("sales_price_benchmarks")
      .upsert(payload, { onConflict: "establishment_id,product_id" });

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível salvar os campos extras." };
  }
}
