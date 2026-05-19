import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();

  let establishment_id: string;
  try {
    const { tenant } = await getAuthenticatedTenantUserOrThrow();
    establishment_id = tenant.establishmentId;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? "Estabelecimento não encontrado." },
      { status: error?.message === "Não autenticado." ? 401 : 403 }
    );
  }

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
