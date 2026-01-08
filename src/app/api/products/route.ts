// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Payload unificado para atender:
 * - Etiquetas: id, name, category, unit, shelf_life_days
 * - Perdas:    id, name, sku, unit_label
 *
 * Mantemos também "unit" por compatibilidade.
 */
type ProductApiRow = {
  id: string;
  name: string;
  category: string | null;

  // Compatibilidade e uso no front
  unit: string | null;
  unit_label: string | null;

  sku: string;
  shelf_life_days: number | null;
};

function pickFirstNonEmptyString(value: any): string | null {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

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
    const v = pickFirstNonEmptyString(c);
    if (v) return v;
  }
  return null;
}

function pickSkuFromAnyColumn(p: any): string {
  const candidates = [
    p.sku,
    p.SKU,
    p.code,
    p.codigo,
    p.product_code,
    p.internal_code,
    p.ref,
    p.reference,
    p.barcode,
    p.ean,
    p.upc,
  ];

  for (const c of candidates) {
    const v = pickFirstNonEmptyString(c);
    if (v) return v;
  }
  return "";
}

function pickCategoryFromAnyColumn(p: any): string | null {
  const candidates = [
    p.category,
    p.categoria,
    p.setor,
    p.sector,
    p.department,
    p.departamento,
    p.group,
    p.grupo,
  ];

  for (const c of candidates) {
    const v = pickFirstNonEmptyString(c);
    if (v) return v;
  }
  return null;
}

function pickShelfLifeDaysFromAnyColumn(p: any): number | null {
  const candidates = [
    p.shelf_life_days,
    p.shelfLifeDays,
    p.shelf_life,
    p.shelf_life_day,
    p.validade_dias,
    p.validade_em_dias,
    p.dias_validade,
    p.expiration_days,
    p.expiry_days,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/**
 * Executa select com uma lista de colunas e, se alguma coluna não existir,
 * remove a coluna faltante e tenta novamente.
 *
 * Isso evita manter uma lista enorme de tentativas e mantém robusto mesmo
 * com schemas diferentes.
 */
async function safeSelectWithMissingColumnRetry(
  supabase: any,
  columns: string[],
  opts: { limit?: number } = {}
) {
  let cols = [...columns];
  const limit = typeof opts.limit === "number" ? opts.limit : 2000;

  // no máximo algumas tentativas (caso faltem várias colunas)
  for (let attempt = 0; attempt < 10; attempt++) {
    const selectClause = cols.join(", ");

    const { data, error } = await supabase
      .from("products")
      .select(selectClause)
      .order("name", { ascending: true })
      .limit(limit);

    if (!error) return { data, error: null };

    // coluna inexistente
    if (error?.code === "42703") {
      const msg = String(error.message || "");
      // tenta extrair o nome da coluna do erro: column "xxx" does not exist
      const m = msg.match(/column\s+"([^"]+)"\s+does not exist/i);
      const missing = m?.[1];

      if (missing && cols.includes(missing)) {
        cols = cols.filter((c) => c !== missing);
        // se removemos algo essencial, ainda assim seguimos; no fim normalizamos
        continue;
      }

      // se não conseguimos identificar, cai fora
      return { data: null, error };
    }

    // qualquer outro erro (RLS, permissão, etc)
    return { data: null, error };
  }

  return {
    data: null,
    error: { code: "500", message: "Falha ao selecionar colunas de products." },
  };
}

async function fetchProductsUnified(supabase: any): Promise<{
  data: ProductApiRow[] | null;
  error: any;
}> {
  /**
   * Tentamos buscar um conjunto “rico” de colunas.
   * Se algumas não existirem, o safeSelect remove e reconsulta.
   */
  const desiredColumns = [
    "id",
    "name",
    "category",
    "sku",
    "unit",
    "unit_label",
    "shelf_life_days",
    // alguns schemas podem ter alternativa de unidade/shelf life; se não existir, o safeSelect remove
    "umd",
    "uom",
    "unidade",
    "validade_dias",
    "dias_validade",
  ];

  const { data, error } = await safeSelectWithMissingColumnRetry(
    supabase,
    desiredColumns,
    { limit: 2000 }
  );

  if (error) return { data: null, error };

  const list = Array.isArray(data) ? data : [];

  const rows: ProductApiRow[] = list
    .map((p: any) => {
      const id = String(p?.id ?? "").trim();
      const name = String(p?.name ?? "").trim();

      if (!id || !name) return null;

      const category = pickCategoryFromAnyColumn(p);

      const unitPicked = pickUnitFromAnyColumn(p);
      const shelf = pickShelfLifeDaysFromAnyColumn(p);
      const sku = pickSkuFromAnyColumn(p);

      return {
        id,
        name,
        category,

        // compatibilidade
        unit: unitPicked,
        unit_label: unitPicked,

        sku,
        shelf_life_days: shelf,
      } as ProductApiRow;
    })
    .filter(Boolean) as ProductApiRow[];

  return { data: rows, error: null };
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

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

    const { data: rows, error } = await fetchProductsUnified(supabase);

    if (error) {
      // ✅ melhora: RLS geralmente dá 42501 (insufficient_privilege) ou mensagem "permission denied"
      const msg = error.message || "Erro ao listar produtos.";
      const code = error.code || "";

      console.error("GET /api/products - supabase error:", { code, msg });

      const isRls =
        code === "42501" ||
        /permission denied/i.test(msg) ||
        /row level security/i.test(msg);

      return NextResponse.json({ error: msg }, { status: isRls ? 403 : 500 });
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
