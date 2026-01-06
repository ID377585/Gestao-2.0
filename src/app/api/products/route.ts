import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  unit: string | null;      // mantém o campo esperado pelo combobox
  category: string | null;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // ✅ garante sessão (RLS depende disso)
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json(
        { error: authError.message || "Falha ao validar sessão." },
        { status: 401 }
      );
    }

    if (!authData?.user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    // ✅ BUSCA PRODUTOS
    // ⚠️ Removido "unit" do select porque a coluna NÃO EXISTE no banco
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category")
      .order("name", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("GET /api/products - supabase error:", error);
      return NextResponse.json(
        { error: error.message || "Erro ao listar produtos." },
        { status: 500 }
      );
    }

    // ✅ mantém o contrato do frontend retornando unit:null
    const rows: ProductRow[] = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      unit: null,
    }));

    return NextResponse.json(rows, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/products - unexpected:", e);
    return NextResponse.json(
      { error: e?.message || "Erro inesperado ao listar produtos." },
      { status: 500 }
    );
  }
}
