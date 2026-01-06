import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  name: string;
  unit: string | null; // mantém o campo esperado pelo combobox
  category: string | null;
};

/**
 * ✅ tenta extrair unidade de QUALQUER coluna comum
 */
function pickUnitFromAnyColumn(p: any): string | null {
  const candidates = [
    p.unit,
    p.umd,
    p.uom,
    p.unit_label,
    p.unit_measure,
    p.unit_measurement,
    p.unit_measure_unit,
    p.unidade,
    p.unidade_medida,
    p.unidade_de_medida,
    p.medida,
    p.measure_unit,
    p.measurement_unit,
    p.um,
    p.und,
    p.unid,
    p.unit_code,
    p.unit_abbr,
    p.unit_short,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}

async function fetchProductsWithUnitFallbacks(supabase: any) {
  // Tentativas de nomes possíveis de coluna para "unidade"
  const unitColumnCandidates = [
    "unit",
    "umd",
    "uom",
    "unit_label",
    "unit_measure",
    "unit_measurement",
    "unidade",
    "unidade_medida",
    "unidade_de_medida",
    "um",
    "und",
  ];

  // 1) tenta com uma coluna de unidade existente
  for (const col of unitColumnCandidates) {
    const { data, error } = await supabase
      .from("products")
      .select(`id, name, category, ${col}`)
      .order("name", { ascending: true })
      .limit(1000);

    // coluna não existe -> tenta próxima
    if (error?.code === "42703") continue;

    // outro erro -> retorna
    if (error) return { data: null, error };

    const rows: ProductRow[] = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      unit: typeof p?.[col] === "string" ? String(p[col]).trim() : p?.[col] ?? null,
    }));

    // ✅ MELHORIA: se a coluna existe MAS não trouxe unidade em nenhum item,
    // NÃO para aqui — tenta próxima coluna / fallback "*"
    const anyUnit = rows.some(
      (r) => typeof r.unit === "string" && r.unit.trim().length > 0
    );
    if (!anyUnit) continue;

    return { data: rows, error: null };
  }

  /**
   * 2) fallback inteligente: busca "*" e tenta extrair unidade
   */
  const { data: allData, error: allErr } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true })
    .limit(1000);

  if (!allErr) {
    const rows: ProductRow[] = (allData ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      unit: pickUnitFromAnyColumn(p),
    }));

    const anyUnit = rows.some(
      (r) => typeof r.unit === "string" && r.unit.trim().length > 0
    );
    if (anyUnit) return { data: rows, error: null };
  }

  // 3) fallback final: sem unidade
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
