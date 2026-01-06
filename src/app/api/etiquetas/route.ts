// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string | null;
  category: string | null;
  unit_label: string | null; // ✅ coluna REAL no seu banco
};

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    // ✅ mantém o padrão do seu app (garante sessão/membership)
    await getActiveMembershipOrRedirect();

    // ✅ aqui só selecionamos colunas que EXISTEM (unit NÃO existe)
    const { data, error } = await supabase
      .from("products")
      .select("id,name,category,unit_label")
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Erro ao listar produtos." },
        { status: 400 }
      );
    }

    const rows = (data || []) as ProductRow[];

    // ✅ normaliza para o FRONT: devolve `unit` sempre
    const normalized = rows
      .map((p) => ({
        id: String(p.id),
        name: (p.name || "").toString().trim(),
        category: p.category ? String(p.category).trim() : null,
        unit: p.unit_label ? String(p.unit_label).trim() : null,
      }))
      .filter((p) => p.id && p.name);

    return NextResponse.json(normalized, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Erro inesperado em /api/products." },
      { status: 500 }
    );
  }
}
