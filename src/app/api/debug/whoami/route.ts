// app/api/debug/whoami/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseRouteClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // pega os cookies (apenas para debugging)
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll().map((c) => ({
      name: c.name,
      value: c.value,
    }));

    // cria o client específico para Route Handler / API
    const supabase = createSupabaseRouteClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    // Mostra qual projeto o Vercel/Supabase está usando (pelo URL)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const projectRef =
      url.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/i)?.[1] ?? null;

    return NextResponse.json({
      ok: true,
      projectRef,
      supabaseUrl: url ? `${url.slice(0, 35)}...` : null,
      cookies: allCookies, // útil para ver se o cookie de sessão está chegando
      user: user ? { id: user.id, email: user.email, role: (user as any).role } : null,
      error: error ? { message: error.message, status: (error as any).status } : null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
