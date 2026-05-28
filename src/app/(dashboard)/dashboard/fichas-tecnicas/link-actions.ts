"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { linkTechnicalSheetToProduct } from "@/lib/technical-sheets/link-to-product";

export async function linkTechnicalSheetToProductAction(formData: FormData) {
  const technicalSheetId = String(
    formData.get("technical_sheet_id") ?? ""
  ).trim();

  if (!technicalSheetId) {
    throw new Error("Ficha técnica não informada para atrelamento.");
  }

  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = String(
    (membership as any)?.establishment_id ?? ""
  ).trim();

  const userId = String((membership as any)?.user_id ?? "").trim();

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado para atrelar a ficha.");
  }

  const supabase = createSupabaseAdminClient();

  const result = await linkTechnicalSheetToProduct({
    supabase,
    establishmentId,
    technicalSheetId,
    userId,
  });

  revalidatePath("/dashboard/fichas-tecnicas");
  revalidatePath("/dashboard/produtos");
  revalidatePath("/dashboard/estoque");

  return result;
}