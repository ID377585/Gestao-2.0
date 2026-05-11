import "server-only";
import { redirect } from "next/navigation";
import { ensureCurrentTermsAcceptedOrRedirect } from "@/lib/auth/terms-compliance.server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

export async function requireCurrentTenant(options?: {
  redirectToLogin?: string;
  redirectToNoAccess?: string;
}) {
  const redirectToLogin = options?.redirectToLogin ?? "/login";
  const redirectToNoAccess = options?.redirectToNoAccess ?? "/sem-acesso";

  const tenant = await getCurrentTenant();

  if (!tenant) {
    redirect(redirectToNoAccess);
  }

  await ensureCurrentTermsAcceptedOrRedirect({
    userId: tenant.userId,
    redirectPath: "/dashboard/pedidos",
    loginPath: redirectToLogin,
  });

  return tenant;
}
