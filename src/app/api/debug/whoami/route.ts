// src/app/api/debug/whoami/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireDebugApiAccess } from "@/lib/security/debug-api";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "api:debug:whoami",
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const access = await requireDebugApiAccess(request);
    if (access.response) return access.response;

    const cookieStore = await cookies();
    const allCookies = cookieStore.getAll().map((c) => ({
      name: c.name,
      present: Boolean(c.value),
      length: c.value.length,
    }));

    const { data: { user }, error } = await access.supabase.auth.getUser();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const projectRef = url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] ?? null;

    return NextResponse.json({
      ok: true,
      projectRef,
      supabaseUrl: url ? `${url.slice(0, 35)}...` : null,
      cookies: allCookies,
      user: user ? { id: user.id, email: user.email, role: (user as any).role } : null,
      error: error ? { message: error.message, status: (error as any).status } : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "unknown error" }, { status: 500 });
  }
}
