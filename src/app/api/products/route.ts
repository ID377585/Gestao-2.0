// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * DEBUG (opcional):
 * - Local (.env.local): DEBUG_PRODUCTS=true
 * - Vercel Env Vars:    DEBUG_PRODUCTS=true
 *
 * Logs são condicionais para não poluir produção.
 */
function isDebugProductsEnabled() {
  const v = process.env.DEBUG_PRODUCTS;
  if (!v) return false;
  return ["1", "true", "yes", "on"].includes(String(v).trim().toLowerCase());
}

type ProductRow = {
  id: string;
  name: string;

  // unidade normalizada (compatibilidade com os frontends atuais)
  unit: string | null;

  category: string | null;

  // ✅ NOVOS (solicitado)
  sku: string | null;
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
  // ✅ seu schema real tem "default_unit_label"
  const candidates = [
    p.default_unit_label, // ✅ principal no seu schema
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

function pickSkuFromAnyColumn(p: any): string | null {
  // ✅ seu schema real tem "sku"
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
  return null;
}

function pickShelfLifeDaysFromAnyColumn(p: any): number | null {
  // ✅ seu schema real tem "shelf_life_days"
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

function normalizeFromDynamicUnitColumn(p: any, unitCol: string): ProductRow | null {
  const id = String(p?.id ?? "").trim();
  const name = String(p?.name ?? "").trim();
  if (!id || !name) return null;

  const unit =
    pickFirstNonEmptyString(p?.[unitCol]) ??
    pickUnitFromAnyColumn(p);

  return {
    id,
    name,
    category: pickFirstNonEmptyString(p?.category) ?? null,
    unit,
    sku: pickSkuFromAnyColumn(p),
    shelf_life_days: pickShelfLifeDaysFromAnyColumn(p),
  };
}

function normalizeFromAny(p: any): ProductRow | null {
  const id = String(p?.id ?? "").trim();
  const name = String(p?.name ?? "").trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    category: pickFirstNonEmptyString(p?.category) ?? null,
    unit: pickUnitFromAnyColumn(p),
    sku: pickSkuFromAnyColumn(p),
    shelf_life_days: pickShelfLifeDaysFromAnyColumn(p),
  };
}

async function fetchProductsWithUnitFallbacks(supabase: any, debug: boolean) {
  /**
   * ✅ Ajuste importante:
   * - inclui "default_unit_label" como primeira candidata de unidade (seu schema real).
   * - SEMPRE seleciona sku e shelf_life_days junto.
   */
  const unitColumnCandidates = [
    "default_unit_label",
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

  for (const col of unitColumnCandidates) {
    const { data, error } = await supabase
      .from("products")
      .select(`id, name, category, sku, shelf_life_days, ${col}`)
      .order("name", { ascending: true })
      .limit(2000);

    if (error?.code === "42703") continue; // coluna não existe
    if (error) return { data: null, error };

    const rows: ProductRow[] = (data ?? [])
      .map((p: any) => normalizeFromDynamicUnitColumn(p, col))
      .filter(Boolean) as ProductRow[];

    const anyUnit = rows.some((r) => (r.unit || "").trim().length > 0);
    if (!anyUnit) continue;

    if (debug) console.log("[api/products] using unit column:", col);

    return { data: rows, error: null };
  }

  // fallback "*"
  const { data: allData, error: allErr } = await supabase
    .from("products")
    .select("*")
    .order("name", { ascending: true })
    .limit(2000);

  if (!allErr) {
    const rows: ProductRow[] = (allData ?? [])
      .map((p: any) => normalizeFromAny(p))
      .filter(Boolean) as ProductRow[];

    return { data: rows, error: null };
  }

  // fallback final: mínimo (ainda tenta sku/shelf_life_days, mas unit fica null)
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, sku, shelf_life_days")
    .order("name", { ascending: true })
    .limit(2000);

  if (error) return { data: null, error };

  const rows: ProductRow[] = (data ?? [])
    .map((p: any) => {
      const id = String(p?.id ?? "").trim();
      const name = String(p?.name ?? "").trim();
      if (!id || !name) return null;

      return {
        id,
        name,
        category: pickFirstNonEmptyString(p?.category) ?? null,
        unit: null,
        sku: pickFirstNonEmptyString(p?.sku) ?? null,
        shelf_life_days: pickShelfLifeDaysFromAnyColumn(p),
      } as ProductRow;
    })
    .filter(Boolean) as ProductRow[];

  return { data: rows, error: null };
}

export async function GET() {
  const debug = isDebugProductsEnabled();

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

    const { data: rows, error } = await fetchProductsWithUnitFallbacks(supabase, debug);

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

    const list = rows ?? [];

    // ✅ contagem automática do que veio faltando
    const missingUnit = list.filter((r) => !(r.unit && r.unit.trim().length > 0)).length;

    // "shelf-life faltante": considera faltante quando null/NaN/<=0
    const missingShelf = list.filter((r) => {
      const n = Number(r.shelf_life_days);
      return !(Number.isFinite(n) && n > 0);
    }).length;

    if (debug) {
      console.log("[api/products] count:", list.length);
      console.log("[api/products] missing unit:", missingUnit, "/", list.length);
      console.log("[api/products] missing shelf_life_days (>0):", missingShelf, "/", list.length);

      const s0 = list[0];
      if (s0) {
        console.log("[api/products] keys(sample[0]):", Object.keys(s0));
        console.log("[api/products] sample[0]:", s0);
      }

      console.log(
        "[api/products] sample(10):",
        list.slice(0, 10).map((r) => ({
          id: r.id,
          name: r.name,
          unit: r.unit,
          sku: r.sku,
          shelf_life_days: r.shelf_life_days,
          category: r.category,
        }))
      );
    }

    return NextResponse.json(list, { status: 200 });
  } catch (e: any) {
    console.error("GET /api/products - unexpected:", e);
    return NextResponse.json(
      { error: e?.message || "Erro inesperado ao listar produtos." },
      { status: 500 }
    );
  }
}
