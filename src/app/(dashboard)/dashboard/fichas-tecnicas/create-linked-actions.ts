"use server";

import { revalidatePath } from "next/cache";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { linkTechnicalSheetToProduct } from "@/lib/technical-sheets/link-to-product";
import {
  createTechnicalSheet,
  type TechnicalSheetInput,
} from "./actions";

type CreateTechnicalSheetWithLinkInput = TechnicalSheetInput & {
  attachTechnicalSheetToProduct?: boolean;
};

function getCreatedTechnicalSheetId(result: unknown) {
  const value = result as any;
  return (
    value?.id ??
    value?.technicalSheetId ??
    value?.technical_sheet_id ??
    value?.data?.id ??
    null
  );
}

async function findLatestCreatedSheetId(params: {
  establishmentId: string;
  userId: string;
  name: string;
  importOrigin?: string | null;
}) {
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("technical_sheets")
    .select("id")
    .eq("establishment_id", params.establishmentId)
    .eq("name", params.name)
    .order("created_at", { ascending: false })
    .limit(1);

  if (params.importOrigin) {
    query = query.eq("import_origin", params.importOrigin);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("[createTechnicalSheetWithOptionalProductLink] lookup error", error);
    throw new Error("Ficha criada, mas não foi possível localizar a ficha para atrelar ao produto.");
  }

  return data?.id ? String(data.id) : null;
}

export async function createTechnicalSheetWithOptionalProductLink(
  input: CreateTechnicalSheetWithLinkInput
) {
  const shouldAttach = Boolean(input.attachTechnicalSheetToProduct);
  const payload: TechnicalSheetInput = {
    ...input,
  };

  delete (payload as any).attachTechnicalSheetToProduct;

  const result = await createTechnicalSheet(payload);

  if (!shouldAttach) {
    return result;
  }

  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = String((membership as any)?.establishment_id ?? "").trim();
  const userId = String(
  (membership as any)?.user_id ??
    (membership as any)?.userId ??
    ""
  ).trim();

  if (!establishmentId) {
    throw new Error("Ficha criada, mas o estabelecimento não foi encontrado para atrelar ao produto.");
  }

  const createdIdFromResult = getCreatedTechnicalSheetId(result);
  const technicalSheetId = createdIdFromResult
    ? String(createdIdFromResult)
    : await findLatestCreatedSheetId({
        establishmentId,
        userId,
        name: payload.name,
        importOrigin: payload.import_origin ?? null,
      });

  if (!technicalSheetId) {
    throw new Error("Ficha criada, mas não foi possível identificar a ficha para atrelar ao produto.");
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

  return result;
}
