import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCurrentUserTenantsForUser } from "@/lib/tenant/get-current-tenant";
import { TENANT_COOKIE_NAME } from "@/lib/tenant/constants";
import { getCompanySubscriptionStatusWithClient } from "@/lib/billing/subscription-status";

export const dynamic = "force-dynamic";

function buildDisplayName(params: {
  profileName?: string | null;
  metadataName?: string | null;
  email?: string | null;
}) {
  const profileName = String(params.profileName ?? "").trim();
  if (profileName) return profileName;

  const metadataName = String(params.metadataName ?? "").trim();
  if (metadataName) return metadataName;

  const email = String(params.email ?? "").trim();
  if (email.includes("@")) {
    return email.split("@")[0];
  }

  return "Usuário";
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    const [{ data: profile }, tenants] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, sector")
        .eq("id", user.id)
        .maybeSingle(),
      listCurrentUserTenantsForUser(supabase, user.id),
    ]);

    const cookieStore = await cookies();
    const selectedEstablishmentId =
      cookieStore.get(TENANT_COOKIE_NAME)?.value ?? null;

    const membership = selectedEstablishmentId
      ? tenants.find(
          (tenant) => tenant.establishment_id === selectedEstablishmentId
        ) ?? null
      : tenants[0] ?? null;

    const establishmentId = membership?.establishment_id ?? null;
    const establishmentName =
      membership?.display_name ?? membership?.establishment_name ?? null;

    const subscription = establishmentId
      ? await getCompanySubscriptionStatusWithClient(supabase, establishmentId)
      : null;

    const payload = {
      id: user.id,
      email: user.email ?? "",
      name: buildDisplayName({
        profileName: (profile as any)?.full_name ?? null,
        metadataName: (user.user_metadata as any)?.full_name ?? null,
        email: user.email ?? null,
      }),
      role: String((membership as any)?.role ?? (profile as any)?.role ?? "user"),
      sector: ((profile as any)?.sector as string | null) ?? null,
      avatar:
        ((user.user_metadata as any)?.avatar_url as string | null) ??
        ((user.user_metadata as any)?.picture as string | null) ??
        null,
      establishmentId,
      establishmentName,
      orgId: (membership as any)?.org_id ?? null,
      unitId: (membership as any)?.unit_id ?? null,
      isActive: Boolean((membership as any)?.is_active ?? true),
      tenants,
      subscription,
      lastSignInAt: user.last_sign_in_at ?? null,
    };

    return NextResponse.json(payload, { status: 200 });
  } catch (error: any) {
    console.error("Erro inesperado em /api/user/me:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}
