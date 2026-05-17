// src/app/api/debug/whoami/route.ts
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function isDebugRouteEnabled() {
  return process.env.DEBUG_ROUTES_ENABLED === "true";
}

export async function GET() {
  if (process.env.NODE_ENV === "production" && !isDebugRouteEnabled()) {
    return NextResponse.json({ ok: false, message: "Not found" }, { status: 404 });
  }

  try {
    const supabase = createSupabaseRouteClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        {
          ok: false,
          user: null,
          error: error ? { message: error.message, status: (error as any).status } : "not_logged_in",
        },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const projectRef = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] ?? null;

    return NextResponse.json({
      ok: true,
      projectRef,
      supabaseUrl: url ? `${url.slice(0, 35)}...` : null,
      user: {
        id: user.id,
        email: user.email,
        role: (user as any).role,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
