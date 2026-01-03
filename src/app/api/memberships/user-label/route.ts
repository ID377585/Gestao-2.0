import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function prettyRole(role: string) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "operacao") return "Operação";
  if (r === "producao") return "Produção";
  if (r === "estoque") return "Estoque";
  if (r === "fiscal") return "Fiscal";
  if (r === "entrega") return "Entrega";
  if (r === "cliente") return "Cliente";
  return role ? role : "-";
}

export async function GET(request: Request) {
  try {
    await getActiveMembershipOrRedirect();
    const supabase = await createSupabaseServerClient();

    const { searchParams } = new URL(request.url);
    const user_id = searchParams.get("user_id");
    const establishment_id = searchParams.get("establishment_id");

    if (!user_id || !establishment_id) {
      return NextResponse.json({ label: "-" }, { status: 200 });
    }

    const { data, error } = await supabase
      .from("memberships")
      .select("display_name, full_name, name, role")
      .eq("user_id", user_id)
      .eq("establishment_id", establishment_id)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[user-label] memberships error:", error);
      return NextResponse.json({ label: "-" }, { status: 200 });
    }

    const md: any = data ?? null;
    const candidate =
      md?.display_name ??
      md?.full_name ??
      md?.name ??
      (md?.role ? prettyRole(String(md.role)) : null);

    return NextResponse.json({ label: candidate ? String(candidate) : "-" }, { status: 200 });
  } catch (e) {
    console.error("[user-label] unexpected error:", e);
    return NextResponse.json({ label: "-" }, { status: 200 });
  }
}
