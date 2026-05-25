"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { createCompanyInternalAction } from "@/lib/tenant/company-onboarding.server";
import { assertEstablishmentCreationLimitAvailable } from "@/lib/billing/limits";

function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizePlanSlug(value: string) {
  if (value === "growth" || value === "enterprise") return value;
  return "starter";
}

function isCompanyCreationEnabled() {
  return process.env.GESTIFY_ENABLE_COMPANY_CREATION === "true";
}

export async function createCompanyFromAdminPageAction(formData: FormData) {
  if (!isCompanyCreationEnabled()) {
    throw new Error(
      "Criação administrativa de empresas ainda não está liberada neste ambiente."
    );
  }

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Não autenticado.");
  }

  const currentTenant = await getCurrentTenant();

  if (!currentTenant?.establishmentId) {
    throw new Error("Nenhuma empresa ativa encontrada.");
  }

  if (currentTenant.role !== "admin") {
    throw new Error("Apenas administradores podem criar empresas.");
  }

  const name = text(formData.get("name"));
  const planSlug = normalizePlanSlug(text(formData.get("plan_slug")));
  const selectAsActive = text(formData.get("select_as_active")) === "on";

  if (!name) {
    throw new Error("Informe o nome da empresa.");
  }

  const supabaseAdmin = getSupabaseAdminClient();
  await assertEstablishmentCreationLimitAvailable({
    supabaseAdmin,
    referenceEstablishmentId: currentTenant.establishmentId,
    userId: user.id,
  });

  await createCompanyInternalAction({
    name,
    adminUserId: user.id,
    adminRole: "admin",
    planSlug,
    selectAsActive,
    actorUserId: user.id,
    referenceEstablishmentId: currentTenant.establishmentId,
  });

  revalidatePath("/dashboard/admin/empresas");
  revalidatePath("/dashboard/admin/usuarios");
  revalidatePath("/dashboard/admin/assinatura");

  redirect("/dashboard/admin/empresas?created=1");
}
