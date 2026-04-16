import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role, sector")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("establishment_memberships")
        .select("establishment_id, role, is_active, created_at")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const payload = {
      id: user.id,
      email: user.email ?? "",
      name: buildDisplayName({
        profileName: (profile as any)?.full_name ?? null,
        metadataName: (user.user_metadata as any)?.full_name ?? null,
        email: user.email ?? null,
      }),
      role:
        String((membership as any)?.role ?? (profile as any)?.role ?? "user"),
      sector: ((profile as any)?.sector as string | null) ?? null,
      avatar:
        ((user.user_metadata as any)?.avatar_url as string | null) ??
        ((user.user_metadata as any)?.picture as string | null) ??
        null,
      establishmentId:
        ((membership as any)?.establishment_id as string | null) ?? null,
      isActive: Boolean((membership as any)?.is_active ?? true),
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