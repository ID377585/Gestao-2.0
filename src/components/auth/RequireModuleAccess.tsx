import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireModuleAccess } from "@/lib/auth/module-access.server";
import type { AccessModuleKey } from "@/lib/auth/module-access-config";
import { redirect } from "next/navigation";

export async function RequireModuleAccess({
  moduleKey,
  children,
}: {
  moduleKey: AccessModuleKey;
  children: React.ReactNode;
}) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login");
  }

  await requireModuleAccess(user.id, moduleKey);

  return <>{children}</>;
}
