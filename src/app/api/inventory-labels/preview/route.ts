import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("establishment_id")
    .eq("user_id", user.id)
    .single();

  if (!membership?.establishment_id) {
    return NextResponse.json(
      { error: "Estabelecimento não encontrado." },
      { status: 400 }
    );
  }

  const establishment_id = membership.establishment_id;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Código não informado." }, { status: 400 });
  }

  const { data: label, error } = await supabase
    .from("inventory_labels")
    .select(
      `
      id,
      product_id,
      label_code,
      qty_balance,
      used_qty,
      unit_label,
      status,
      batch_number,
      expiration_date
    `
    )
    .eq("establishment_id", establishment_id)
    .eq("label_code", code)
    .single();

  if (error || !label) {
    return NextResponse.json(
      { error: "Etiqueta não encontrada." },
      { status: 404 }
    );
  }

  return NextResponse.json({ label });
}
