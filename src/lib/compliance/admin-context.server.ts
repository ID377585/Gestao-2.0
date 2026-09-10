import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenantForUser } from "@/lib/tenant/get-current-tenant";

export async function getTenantAdminContext() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false as const, status: 401, error: "Sessão inválida." };
  }

  const tenant = await getCurrentTenantForUser(supabase, {
    id: user.id,
    email: user.email,
  });

  if (!tenant?.establishmentId) {
    return { ok: false as const, status: 403, error: "Empresa ativa não encontrada." };
  }

  if (tenant.role !== "admin") {
    return {
      ok: false as const,
      status: 403,
      error: "Apenas administradores podem executar esta operação.",
    };
  }

  return { ok: true as const, user, tenant, supabase };
}
