import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  unit: string | null; // mantém o campo esperado pelo combobox
  category: string | null;
};

async function fetchProductsWithUnitFallbacks(supabase: any) {
  // Tentativas de nomes possíveis de coluna para "unidade"
  // (não quebra se nenhuma existir; só cai para próximo)
  const unitColumnCandidates = [
    "unit",
    "umd",
    "uom",
    "unit_label",
    "unit_measure",
    "unidade",
  ];

  // 1) tenta com uma coluna de unidade existente
  for (const col of unitColumnCandidates) {
    const { data, error } = await supabase
      .from("products")
      .select(`id, name, category, ${col}`)
      .order("name", { ascending: true })
      .limit(1000);

    // Se deu erro porque a coluna não existe, tenta a próxima
    // Postgres: undefined_column => 42703
    if (error?.code === "42703") continue;

    // Qualquer outro erro: devolve pra quem chamou tratar
    if (error) return { data: null, error };

    // Achou uma coluna válida, normaliza para { unit }
    const rows: ProductRow[] = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      unit: p?.[col] ?? null,
    }));

    return { data: rows, error: null };
  }

  // 2) fallback final: sem unidade (igual seu comportamento atual)
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category")
    .order("name", { ascending: true })
    .limit(1000);

  if (error) return { data: null, error };

  const rows: ProductRow[] = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category ?? null,
    unit: null,
  }));

  return { data: rows, error: null };
}

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

    // ✅ BUSCA PRODUTOS com fallback de colunas de unidade
    const { data: rows, error } = await fetchProductsWithUnitFallbacks(supabase);

    if (error) {
      console.error("GET /api/products - supabase error:", error);
      return NextResponse.json(
        { error: error.message || "Erro ao listar produtos." },
        { status: 500 }
      );
    }

    return NextResponse.json(rows ?? [], { status: 200 });
  } catch (e: any) {
    console.error("GET /api/products - unexpected:", e);
    return NextResponse.json(
      { error: e?.message || "Erro inesperado ao listar produtos." },
      { status: 500 }
    );
  }
}
