import "server-only";
import { NextResponse } from "next/server";
import { requireDebugApiAccess } from "@/lib/security/debug-api";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "api:debug:whoami-membership",
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const access = await requireDebugApiAccess(request);
    if (access.response) return access.response;

    const {
      data: { user },
      error: userErr,
    } = await access.supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json(
        { ok: false, step: "auth.getUser", user: null, error: userErr?.message ?? "not_logged_in" },
        { status: 401 }
      );
    }

    // tenta buscar membership ativo (fonte atual)
    const { data, error } = await access.supabase
      .from("establishment_memberships")
      .select("id, establishment_id, user_id, role, is_active, created_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email },
      rows: data ?? [],
      error: error
        ? {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, step: "catch", error: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}
