import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({
        ok: false,
        step: "auth.getUser",
        user: null,
        userErr: userErr
          ? { message: userErr.message, status: (userErr as any).status }
          : null,
      });
    }

    const { data, error } = await supabase
      .from("establishment_memberships")
      .select("id,establishment_id,user_id,role,is_active,created_at")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(5);

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
      { ok: false, message: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
