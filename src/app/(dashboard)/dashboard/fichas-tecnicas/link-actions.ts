"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { linkTechnicalSheetToProduct } from "@/lib/technical-sheets/link-to-product";

function getFormString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function linkTechnicalSheetToProductAction(formData: FormData) {
  const technicalSheetId = getFormString(formData, "technical_sheet_id");

  if (!technicalSheetId) {
    throw new Error("Informe a ficha técnica que deseja atrelar ao produto.");
  }

  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = String((membership as any)?.establishment_id ?? "").trim();
  const userId = String((membership as any)?.user_id ?? "").trim() || null;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado para atrelar ficha técnica.");
  }

  const supabase = createSupabaseAdminClient();

  await linkTechnicalSheetToProduct({
    supabase,
    establishmentId,
    technicalSheetId,
    userId,
  });

  revalidatePath("/dashboard/fichas-tecnicas");
  revalidatePath("/dashboard/produtos");
  revalidatePath("/dashboard/estoque");

  return { ok: true };
}
