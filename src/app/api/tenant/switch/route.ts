import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";
import {
  TENANT_COOKIE_MAX_AGE_SECONDS,
  TENANT_COOKIE_NAME,
} from "@/lib/tenant/constants";
import { writeTenantAuditLog } from "@/lib/tenant/audit";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "tenant-switch",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const body = await request.json().catch(() => ({}));
    const establishmentId = String(body?.establishmentId ?? "").trim();

    if (!establishmentId) {
      return NextResponse.json(
        { error: "Informe a empresa que deseja acessar." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("id, establishment_id, is_active")
      .eq("user_id", user.id)
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .maybeSingle();

    if (membershipError) {
      console.error("Erro ao validar troca de empresa:", membershipError);
      return NextResponse.json(
        { error: "Não foi possível validar seu acesso à empresa." },
        { status: 500 }
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: "Você não possui acesso ativo a esta empresa." },
        { status: 403 }
      );
    }

    const cookieStore = await cookies();
    const previousEstablishmentId = cookieStore.get(TENANT_COOKIE_NAME)?.value ?? null;

    cookieStore.set(TENANT_COOKIE_NAME, establishmentId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: TENANT_COOKIE_MAX_AGE_SECONDS,
    });

    const supabaseAdmin = getSupabaseAdminClient();
    await writeTenantAuditLog({
      supabaseAdmin,
      establishmentId,
      actorUserId: user.id,
      targetUserId: user.id,
      action: "switch_active_tenant",
      entityType: "establishment",
      entityId: establishmentId,
      details: {
        previous_establishment_id: previousEstablishmentId,
        next_establishment_id: establishmentId,
      },
    });

    return NextResponse.json({ ok: true, establishmentId }, { status: 200 });
  } catch (error: any) {
    console.error("Erro inesperado em /api/tenant/switch:", error);
    return NextResponse.json(
      { error: error?.message ?? "Erro ao trocar empresa ativa." },
      { status: 500 }
    );
  }
}
