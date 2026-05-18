import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant, listCurrentUserTenants } from "@/lib/tenant/get-current-tenant";
import type { TenantContext, TenantMembershipRole } from "@/lib/tenant/types";

export async function getActiveTenantOrRedirect(options?: {
  redirectTo?: string;
}): Promise<TenantContext> {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    redirect(options?.redirectTo ?? "/sem-acesso");
  }

  return tenant;
}

export async function getActiveEstablishmentIdOrThrow() {
  const tenant = await getCurrentTenant();

  if (!tenant?.establishmentId) {
    throw new Error("Nenhuma empresa ativa encontrada.");
  }

  return tenant.establishmentId;
}

export async function assertUserCanAccessEstablishment(establishmentId: string) {
  const requestedEstablishmentId = String(establishmentId ?? "").trim();

  if (!requestedEstablishmentId) {
    throw new Error("Estabelecimento não informado.");
  }

  const tenants = await listCurrentUserTenants();
  const membership = tenants.find(
    (tenant) =>
      tenant.is_active && tenant.establishment_id === requestedEstablishmentId
  );

  if (!membership) {
    throw new Error("Você não tem acesso a este estabelecimento.");
  }

  return membership;
}

export async function assertSameActiveEstablishment(establishmentId: string) {
  const tenant = await getCurrentTenant();
  const requestedEstablishmentId = String(establishmentId ?? "").trim();

  if (!tenant?.establishmentId) {
    throw new Error("Nenhuma empresa ativa encontrada.");
  }

  if (!requestedEstablishmentId) {
    throw new Error("Estabelecimento não informado.");
  }

  if (tenant.establishmentId !== requestedEstablishmentId) {
    throw new Error("Estabelecimento inválido para a empresa ativa.");
  }

  return tenant;
}

export async function assertActiveTenantRole(
  allowedRoles: TenantMembershipRole[]
) {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    throw new Error("Nenhuma empresa ativa encontrada.");
  }

  if (!allowedRoles.includes(tenant.role)) {
    throw new Error("Você não tem permissão para executar esta ação.");
  }

  return tenant;
}

export async function getAuthenticatedTenantUserOrThrow() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("Não autenticado.");
  }

  const tenant = await getCurrentTenant();

  if (!tenant) {
    throw new Error("Nenhuma empresa ativa encontrada.");
  }

  return { user, tenant };
}
