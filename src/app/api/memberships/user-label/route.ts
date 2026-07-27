import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  assertSameActiveEstablishment,
  getAuthenticatedTenantUserOrThrow,
} from "@/lib/tenant/guards";

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
    await getAuthenticatedTenantUserOrThrow();
    const supabase = await createSupabaseServerClient();

    const { searchParams } = new URL(request.url);
    const userId = String(searchParams.get("user_id") ?? "").trim();
    const establishmentId = String(
      searchParams.get("establishment_id") ?? ""
    ).trim();

    if (!userId || !establishmentId) {
      return NextResponse.json({ label: "-" }, { status: 200 });
    }

    await assertSameActiveEstablishment(establishmentId);

    const { data: membership, error: membershipError } = await supabase
      .from("memberships")
      .select("role")
      .eq("user_id", userId)
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .maybeSingle();

    if (membershipError) {
      console.warn("[user-label] membership lookup error:", membershipError);
      return NextResponse.json({ label: "-" }, { status: 200 });
    }

    if (!membership) {
      return NextResponse.json({ label: "-" }, { status: 200 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      console.warn("[user-label] profile lookup error:", profileError);
    }

    const fullName = String(profile?.full_name ?? "").trim();
    const roleLabel = prettyRole(String(membership.role ?? ""));

    return NextResponse.json(
      { label: fullName || roleLabel || "-" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[user-label] unexpected error:", error);
    return NextResponse.json({ label: "-" }, { status: 200 });
  }
}
