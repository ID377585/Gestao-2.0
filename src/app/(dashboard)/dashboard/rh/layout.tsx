import { assertTenantCanAccessModule } from "@/lib/tenant/module-access";
import { getActiveTenantOrRedirect } from "@/lib/tenant/guards";

export default async function RhLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const tenant = await getActiveTenantOrRedirect();
  await assertTenantCanAccessModule(tenant, "rh");

  return children;
}
