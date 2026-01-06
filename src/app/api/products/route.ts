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
 * ✅ NOVO: normaliza unidade para evitar variações tipo "UND", "Unidade", "Kg", "LT" etc.
 * - Não força um enum; apenas padroniza valores comuns.
 */
function normalizeUnit(input: any): string | null {
  if (input === null || input === undefined) return null;

  const raw = typeof input === "string" ? input : String(input);
  const v = raw.trim();
  if (!v) return null;

  const low = v.toLowerCase();

  // normalizações comuns
  if (low === "kg" || low.includes("quilo") || low.includes("kilogram")) return "kg";
  if (low === "g" || low.includes("grama")) return "g";

  // litro: aceita "l", "lt", "litro"
  if (low === "l" || low === "lt" || low.includes("litro")) return "lt";

  if (low === "ml" || low.includes("mililit")) return "ml";

  // unidade: "un", "und", "unid", "unidade", "pc", "pç"
  if (
    low === "un" ||
    low === "und" ||
    low === "unid" ||
    low.includes("unidade") ||
    low === "pc" ||
    low === "pç"
  ) {
    return "un";
  }

  if (low === "cx" || low.includes("caixa")) return "cx";
  if (low === "pct" || low.includes("pacote")) return "pct";

  // fallback: mantém o valor original “como veio”
  return v;
}

/**
 * ✅ NOVO: tenta extrair unidade de QUALQUER coluna comum
 * (mesmo que o nome real não esteja na lista unitColumnCandidates)
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
    const n = normalizeUnit(c);
    if (typeof n === "string" && n.trim().length > 0) return n.trim();
  }
  return null;
}

async function fetchProductsWithUnitFallbacks(supabase: any) {
  // Tentativas de nomes possíveis de coluna para "unidade"
  // (não quebra se nenhuma existir; só cai para próximo)
  const unitColumnCandidates = [
    "unit",
    "umd",
    "uom",
    "unit_label",
    "unit_measure",
    "unit_measurement",
    "unit_measure_unit",
    "unidade",
    "unidade_medida",
    "unidade_de_medida",
    "um",
    "und",
    "unid",
  ];

  // 1) tenta com uma coluna de unidade existente (rápido e leve)
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
      unit: normalizeUnit(p?.[col]),
    }));

    return { data: rows, error: null };
  }

  /**
   * 2) ✅ fallback inteligente
   * Busca "*" para não depender do nome exato da coluna e tenta extrair unidade
   * sem quebrar o contrato do frontend.
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

    // Se pelo menos 1 item vier com unit preenchido, já resolvemos
    const anyUnit = rows.some(
      (r) => typeof r.unit === "string" && r.unit.trim().length > 0
    );
    if (anyUnit) return { data: rows, error: null };
  }

  // 3) fallback final: sem unidade (igual seu comportamento atual)
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
