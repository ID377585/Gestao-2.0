"use server";

import { revalidatePath } from "next/cache";

import {
  acceptLegalDocument,
  createDataSubjectRequest,
  createSecurityIncident,
  DPA_VERSION_ID,
  requestTenantOffboarding,
} from "@/lib/compliance/legal.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenantForUser } from "@/lib/tenant/get-current-tenant";

async function getAdminContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Sessão inválida.");

  const tenant = await getCurrentTenantForUser(supabase, {
    id: user.id,
    email: user.email,
  });

  if (!tenant?.establishmentId) throw new Error("Empresa ativa não encontrada.");
  if (tenant.role !== "admin") {
    throw new Error("Apenas administradores podem executar esta ação.");
  }

  return { user, tenant };
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function acceptDpaAction(formData: FormData) {
  const { user, tenant } = await getAdminContext();
  if (value(formData, "authority") !== "yes") {
    throw new Error("Confirme que possui poderes para representar a empresa.");
  }

  await acceptLegalDocument({
    userId: user.id,
    establishmentId: tenant.establishmentId,
    versionId: DPA_VERSION_ID,
    source: "privacy_center",
    path: "/dashboard/admin/privacidade",
    representativeAuthority: true,
  });

  revalidatePath("/dashboard/admin/privacidade");
}

export async function createPrivacyRequestAction(formData: FormData) {
  const { user, tenant } = await getAdminContext();
  const requestType = value(formData, "requestType");
  const allowed = new Set([
    "access",
    "correction",
    "deletion",
    "anonymization",
    "portability",
    "opposition",
    "consent_withdrawal",
    "information",
  ]);
  if (!allowed.has(requestType)) throw new Error("Tipo de solicitação inválido.");

  await createDataSubjectRequest({
    establishmentId: tenant.establishmentId,
    userId: user.id,
    requestType,
    subjectName: value(formData, "subjectName") || null,
    subjectContact: value(formData, "subjectContact") || null,
    description: value(formData, "description") || null,
  });

  revalidatePath("/dashboard/admin/privacidade");
}

export async function reportSecurityIncidentAction(formData: FormData) {
  const { user, tenant } = await getAdminContext();
  const title = value(formData, "title");
  if (title.length < 3) throw new Error("Informe um título para o incidente.");

  await createSecurityIncident({
    establishmentId: tenant.establishmentId,
    userId: user.id,
    title,
    description: value(formData, "description") || null,
  });

  revalidatePath("/dashboard/admin/privacidade");
}

export async function requestOffboardingAction(formData: FormData) {
  const { user, tenant } = await getAdminContext();
  const confirmation = value(formData, "confirmation");
  if (confirmation !== "ENCERRAR") {
    throw new Error('Digite "ENCERRAR" para registrar a solicitação.');
  }

  await requestTenantOffboarding({
    establishmentId: tenant.establishmentId,
    userId: user.id,
    reason: value(formData, "reason") || null,
  });

  revalidatePath("/dashboard/admin/privacidade");
}
