import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    // ✅ garante que tem usuário logado (senão, RLS vai bloquear e/ou retornar vazio)
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) {
      return NextResponse.json(
        { error: authError.message || "Falha ao validar sessão." },
        { status: 401 }
      );
    }
    if (!authData?.user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    // ✅ BUSCA PRODUTOS
    // (campos usados pelo seu combobox: id, name, unit, category)
    const { data, error } = await supabase
      .from("products")
      .select("id, name, unit, category")
      .order("name", { ascending: true })
      .limit(1000);

    if (error) {
      console.error("GET /api/products - supabase error:", error);
      return NextResponse.json(
        { error: error.message || "Erro ao listar produtos." },
        { status: 500 }
      );
    }

    const rows = (data ?? []) as ProductRow[];
    return NextResponse.json(rows, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/products - unexpected:", e);
    return NextResponse.json(
      { error: e?.message || "Erro inesperado ao listar produtos." },
      { status: 500 }
    );
  }
}
