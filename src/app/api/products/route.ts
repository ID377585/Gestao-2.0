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
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}

/**
 * ✅ NOVO: tenta montar label de unidade quando buscamos em tabela de unidades
 */
function pickBestUnitLabel(u: any): string | null {
  const candidates = [u?.abbr, u?.code, u?.short, u?.name, u?.label, u?.title];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}

/**
 * ✅ NOVO: tenta resolver unidade via FK (unit_id / uom_id / etc.)
 * sem assumir o schema — tenta várias colunas e várias tabelas comuns.
 */
async function resolveUnitViaForeignKey(supabase: any, productsRaw: any[]) {
  if (!Array.isArray(productsRaw) || productsRaw.length === 0) return null;

  const fkCandidates = ["unit_id", "uom_id", "umd_id", "measurement_unit_id"];

  const sample = productsRaw[0] ?? {};
  const fkCol =
    fkCandidates.find(
      (c) =>
        Object.prototype.hasOwnProperty.call(sample, c) &&
        productsRaw.some((p) => p?.[c])
    ) ?? null;

  if (!fkCol) return null;

  const ids = Array.from(
    new Set(productsRaw.map((p) => p?.[fkCol]).filter(Boolean))
  );

  if (ids.length === 0) return null;

  const unitTables = ["units", "uoms", "measurement_units", "unit_measures"];

  for (const t of unitTables) {
    const { data: unitsData, error } = await supabase.from(t).select("*").in("id", ids);

    // tabela não existe => tenta a próxima (Postgres: 42P01)
    if (error?.code === "42P01") continue;

    // qualquer outro erro => devolve
    if (error) return { map: null, error };

    const map = new Map<string, string>();
    for (const u of unitsData ?? []) {
      const label = pickBestUnitLabel(u);
      if (u?.id && label) map.set(u.id, label);
    }

    if (map.size > 0) return { fkCol, map, error: null, table: t };
  }

  return null;
}

async function fetchProductsWithUnitFallbacks(supabase: any, debug = false) {
  // Tentativas de nomes possíveis de coluna para "unidade"
  // (não quebra se nenhuma existir; só cai para próximo)
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
      unit: p?.[col] ?? null,
    }));

    if (debug) {
      return {
        data: rows,
        error: null,
        debug: {
          mode: "directColumn",
          usedColumn: col,
          sampleKeys: Object.keys((data ?? [])[0] ?? {}),
        },
      };
    }

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
    const rowsByAnyColumn: ProductRow[] = (allData ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category ?? null,
      unit: pickUnitFromAnyColumn(p),
    }));

    const anyUnitByAnyColumn = rowsByAnyColumn.some(
      (r) => typeof r.unit === "string" && r.unit.trim().length > 0
    );

    if (anyUnitByAnyColumn) {
      if (debug) {
        return {
          data: rowsByAnyColumn,
          error: null,
          debug: {
            mode: "pickUnitFromAnyColumn",
            sampleKeys: Object.keys((allData ?? [])[0] ?? {}),
          },
        };
      }
      return { data: rowsByAnyColumn, error: null };
    }

    /**
     * 3) ✅ NOVO: tenta resolver via FK (unit_id / uom_id / etc.)
     * caso nenhuma coluna string tenha a unidade.
     */
    const resolved = await resolveUnitViaForeignKey(supabase, allData ?? []);
    if (resolved?.error) return { data: null, error: resolved.error };

    if (resolved?.map && resolved?.fkCol) {
      const rowsByFk: ProductRow[] = (allData ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        category: p.category ?? null,
        unit: resolved.map.get(p?.[resolved.fkCol]) ?? null,
      }));

      const anyUnitByFk = rowsByFk.some(
        (r) => typeof r.unit === "string" && r.unit.trim().length > 0
      );

      if (anyUnitByFk) {
        if (debug) {
          return {
            data: rowsByFk,
            error: null,
            debug: {
              mode: "foreignKeyLookup",
              fkCol: resolved.fkCol,
              table: resolved.table,
              sampleKeys: Object.keys((allData ?? [])[0] ?? {}),
            },
          };
        }
        return { data: rowsByFk, error: null };
      }
    }

    if (debug) {
      return {
        data: rowsByAnyColumn,
        error: null,
        debug: {
          mode: "noUnitFound",
          sampleKeys: Object.keys((allData ?? [])[0] ?? {}),
        },
      };
    }
  }

  // 4) fallback final: sem unidade (igual seu comportamento atual)
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

  if (debug) {
    return {
      data: rows,
      error: null,
      debug: {
        mode: "fallbackNoUnit",
        sampleKeys: Object.keys((data ?? [])[0] ?? {}),
      },
    };
  }

  return { data: rows, error: null };
}

export async function GET(req: Request) {
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

    const url = new URL(req.url);
    const debug = url.searchParams.get("debug") === "1";

    // ✅ BUSCA PRODUTOS com fallback de colunas de unidade + FK
    const result = await fetchProductsWithUnitFallbacks(supabase, debug);

    if (result.error) {
      console.error("GET /api/products - supabase error:", result.error);
      return NextResponse.json(
        { error: (result.error as any)?.message || "Erro ao listar produtos." },
        { status: 500 }
      );
    }

    if (debug) {
      return NextResponse.json(
        { rows: result.data ?? [], debug: (result as any).debug ?? null },
        { status: 200 }
      );
    }

    return NextResponse.json(result.data ?? [], { status: 200 });
  } catch (e: any) {
    console.error("GET /api/products - unexpected:", e);
    return NextResponse.json(
      { error: e?.message || "Erro inesperado ao listar produtos." },
      { status: 500 }
    );
  }
}
