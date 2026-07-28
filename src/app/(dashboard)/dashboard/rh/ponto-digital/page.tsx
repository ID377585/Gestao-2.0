import { redirect } from "next/navigation";

import { TimeClockClient } from "./TimeClockClient";
import { getTimeClockDashboardData } from "@/lib/hr/time-clock.server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { assertTenantCanAccessModule } from "@/lib/tenant/module-access";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DigitalTimeClockPage() {
  const tenant = await getCurrentTenant();

  if (!tenant) {
    redirect("/login");
  }

  await assertTenantCanAccessModule(tenant, "rh");
  const initialData = await getTimeClockDashboardData();

  return <TimeClockClient initialData={initialData} />;
}
