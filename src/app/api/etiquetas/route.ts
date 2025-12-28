import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const etiquetas = body?.etiquetas as any[] | undefined;

    if (!etiquetas || !Array.isArray(etiquetas) || etiquetas.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma etiqueta recebida." },
        { status: 400 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { membership } = await getActiveMembershipOrRedirect();

    const establishmentId = (membership as any).establishment_id;
    const userId = (membership as any).user_id ?? null;

    if (!establishmentId) {
      return NextResponse.json(
        { error: "Estabelecimento não encontrado no membership." },
        { status: 400 }
      );
    }

    // Monta as linhas para a tabela inventory_labels
    const rows = etiquetas.map((e) => ({
      establishment_id: establishmentId,
      // 👉 por enquanto não amarramos em um "product_id" de verdade
      product_id: null, // depois podemos ligar ao cadastro de produtos
      label_code: e.loteMan, // usamos o LOTE da Vigilância como código da etiqueta
      qty: e.qtd,
      unit_label: e.umd,
      status: "available",
      order_id: null,
      separated_at: null,
      separated_by: null,
      created_by: userId,
      notes: null,
    }));

    const { error } = await supabase.from("inventory_labels").insert(rows);

    if (error) {
      console.error("Erro ao salvar etiquetas em inventory_labels:", error);
      return NextResponse.json(
        { error: "Erro ao salvar etiquetas." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Erro inesperado na rota /api/etiquetas:", err);
    return NextResponse.json(
      { error: "Erro inesperado." },
      { status: 500 }
    );
  }
}
    