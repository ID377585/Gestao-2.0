"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export type DishType = "Entrada" | "Prato Principal" | "Sobremesa";

export type ProductOption = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  suggestedPrice: number;
};

export type SalesPriceBenchmark = {
  id: string | null;
  productId: string;
  productName: string;
  brand: string | null;
  category: string | null;
  dishType: DishType;
  catalogSuggestedPrice: number;
  manualSalePrice: number | null;
  restaurant1Price: number | null;
  restaurant2Price: number | null;
  restaurant3Price: number | null;
  restaurant4Price: number | null;
  restaurant5Price: number | null;
  competitorAveragePrice: number | null;
  suggestedAveragePrice: number | null;
  percentageVsSuggested: number | null;
  notes: string | null;
  updatedAt: string | null;
};

export type SalesPriceBenchmarkInput = {
  productId: string;
  dishType: DishType;
  manualSalePrice?: number | null;
  restaurant1Price?: number | null;
  restaurant2Price?: number | null;
  restaurant3Price?: number | null;
  restaurant4Price?: number | null;
  restaurant5Price?: number | null;
  notes?: string | null;
};

export type SalesPriceBenchmarkPayload = {
  products: ProductOption[];
  benchmarks: SalesPriceBenchmark[];
  error?: string;
};

export type SaveBenchmarkResult = {
  ok: boolean;
  error?: string;
};

async function getContext() {
  const supabaseAuth = await createSupabaseServerClient();
  const supabase = createSupabaseAdminClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id as string | undefined;

  if (!establishmentId) throw new Error("Estabelecimento não encontrado para o usuário atual.");

  const {
    data: { user },
    error: userError,
  } = await supabaseAuth.auth.getUser();

  if (userError || !user) throw new Error("Usuário não autenticado.");

  return { supabase, establishmentId, userId: user.id };
}

function getErrorMessage(error: unknown) {
  return String((error as any)?.message ?? "");
}

function isMissingBenchmarkTable(error: unknown) {
  const code = String((error as any)?.code ?? "");
  const message = getErrorMessage(error).toLowerCase();
  return (
    code === "42P01" ||
    (message.includes("sales_price_benchmarks") && message.includes("schema cache")) ||
    (message.includes("sales_price_benchmarks") && message.includes("could not find")) ||
    (message.includes("sales_price_benchmarks") && message.includes("does not exist"))
  );
}

function isColumnOrSchemaError(error: unknown) {
  const code = String((error as any)?.code ?? "");
  const message = getErrorMessage(error).toLowerCase();
  return code === "42703" || message.includes("column") || message.includes("schema cache") || message.includes("could not find");
}

function friendlyError(error: unknown, fallback: string) {
  const code = String((error as any)?.code ?? "");
  const message = getErrorMessage(error).toLowerCase();

  if (isMissingBenchmarkTable(error)) return "A tabela sales_price_benchmarks ainda não existe no Supabase. Aplique a migration de Preço Venda Médio.";
  if (code === "42501" || message.includes("permission denied") || message.includes("row-level security")) return "Sem permissão para acessar ou salvar os preços médios neste estabelecimento.";
  if (code === "42P10" || message.includes("on conflict") || message.includes("no unique")) return "A tabela de Preço Venda Médio precisa da chave única por estabelecimento/produto. Reaplique a migration.";
  if (isColumnOrSchemaError(error)) return `Estrutura do Supabase diferente do esperado. Detalhe: ${getErrorMessage(error) || "schema incompatível"}.`;

  return fallback;
}

function toNumber(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function getProductSuggestedPrice(product: any) {
  return toNumber(product.price ?? product.sale_price ?? product.suggested_sale_price ?? product.standard_cost ?? 0);
}

function getCompetitorPrices(row: Pick<SalesPriceBenchmark, "restaurant1Price" | "restaurant2Price" | "restaurant3Price" | "restaurant4Price" | "restaurant5Price">) {
  return [row.restaurant1Price, row.restaurant2Price, row.restaurant3Price, row.restaurant4Price, row.restaurant5Price]
    .map((value) => toNullableNumber(value))
    .filter((value): value is number => value !== null && value > 0);
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function computeBenchmark(row: Omit<SalesPriceBenchmark, "competitorAveragePrice" | "suggestedAveragePrice" | "percentageVsSuggested">): SalesPriceBenchmark {
  const prices = getCompetitorPrices(row);
  const competitorAveragePrice = prices.length > 0 ? roundMoney(prices.reduce((sum, price) => sum + price, 0) / prices.length) : null;
  const suggestedAveragePrice = competitorAveragePrice !== null
    ? roundMoney((competitorAveragePrice + row.catalogSuggestedPrice) / 2)
    : row.catalogSuggestedPrice > 0
      ? roundMoney(row.catalogSuggestedPrice)
      : null;
  const percentageVsSuggested = competitorAveragePrice !== null && row.catalogSuggestedPrice > 0
    ? roundMoney(((competitorAveragePrice - row.catalogSuggestedPrice) / row.catalogSuggestedPrice) * 100)
    : null;

  return {
    ...row,
    competitorAveragePrice,
    suggestedAveragePrice,
    percentageVsSuggested,
  };
}

async function fetchProducts(supabase: ReturnType<typeof createSupabaseAdminClient>, establishmentId: string): Promise<any[]> {
  const attempts = [
    { select: "id,name,brand,category,price,standard_cost", active: true },
    { select: "id,name,brand,category,price", active: true },
    { select: "id,name,brand,category", active: true },
    { select: "id,name,brand,category,price,standard_cost", active: false },
    { select: "id,name,brand,category", active: false },
  ];

  let lastError: unknown = null;

  for (const attempt of attempts) {
    let query = supabase.from("products").select(attempt.select).eq("establishment_id", establishmentId).order("name", { ascending: true });
    if (attempt.active) query = query.eq("is_active", true);

    const { data, error } = await query;
    if (!error) return (data ?? []) as any[];
    lastError = error;
    if (!isColumnOrSchemaError(error)) break;
  }

  throw new Error(friendlyError(lastError, "Não foi possível carregar o catálogo de produtos."));
}

async function fetchBenchmarks(supabase: ReturnType<typeof createSupabaseAdminClient>, establishmentId: string) {
  const { data, error } = await supabase
    .from("sales_price_benchmarks")
    .select("id,product_id,dish_type,manual_sale_price,restaurant_1_price,restaurant_2_price,restaurant_3_price,restaurant_4_price,restaurant_5_price,notes,updated_at")
    .eq("establishment_id", establishmentId)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isMissingBenchmarkTable(error)) return { rows: [] as any[], tableMissing: true };
    throw new Error(friendlyError(error, "Não foi possível carregar os preços médios."));
  }

  return { rows: data ?? [], tableMissing: false };
}

async function assertProductBelongsToEstablishment(supabase: ReturnType<typeof createSupabaseAdminClient>, establishmentId: string, productId: string) {
  const { data, error } = await supabase
    .from("products")
    .select("id,establishment_id")
    .eq("id", productId)
    .maybeSingle();

  if (error) throw new Error(friendlyError(error, "Não foi possível validar o produto."));
  if (!data || (data as any).establishment_id !== establishmentId) throw new Error("Produto inválido ou de outro estabelecimento.");
}

export async function loadSalesPriceBenchmarks(): Promise<SalesPriceBenchmarkPayload> {
  try {
    const { supabase, establishmentId } = await getContext();
    const products = await fetchProducts(supabase, establishmentId);
    const productOptions: ProductOption[] = products.map((product: any) => ({
      id: String(product.id),
      name: String(product.name ?? "Sem nome"),
      brand: product.brand ?? null,
      category: product.category ?? null,
      suggestedPrice: getProductSuggestedPrice(product),
    }));

    const productById = new Map(productOptions.map((product) => [product.id, product]));
    const { rows, tableMissing } = await fetchBenchmarks(supabase, establishmentId);

    const benchmarks = rows.map((row: any) => {
      const product = productById.get(String(row.product_id));
      const base = {
        id: String(row.id),
        productId: String(row.product_id),
        productName: product?.name ?? "Produto não encontrado",
        brand: product?.brand ?? null,
        category: product?.category ?? null,
        dishType: (row.dish_type || "Prato Principal") as DishType,
        catalogSuggestedPrice: product?.suggestedPrice ?? 0,
        manualSalePrice: toNullableNumber(row.manual_sale_price),
        restaurant1Price: toNullableNumber(row.restaurant_1_price),
        restaurant2Price: toNullableNumber(row.restaurant_2_price),
        restaurant3Price: toNullableNumber(row.restaurant_3_price),
        restaurant4Price: toNullableNumber(row.restaurant_4_price),
        restaurant5Price: toNullableNumber(row.restaurant_5_price),
        notes: row.notes ?? null,
        updatedAt: row.updated_at ?? null,
      };
      return computeBenchmark(base);
    });

    return {
      products: productOptions,
      benchmarks,
      error: tableMissing ? "A tabela sales_price_benchmarks ainda não existe no Supabase. Aplique a migration para salvar os registros." : undefined,
    };
  } catch (error) {
    console.error("Erro ao carregar Preço Venda Médio:", error);
    return {
      products: [],
      benchmarks: [],
      error: error instanceof Error ? error.message : "Não foi possível carregar Preço Venda Médio.",
    };
  }
}

export async function saveSalesPriceBenchmark(input: SalesPriceBenchmarkInput): Promise<SaveBenchmarkResult> {
  try {
    const { supabase, establishmentId, userId } = await getContext();
    if (!input.productId) return { ok: false, error: "Selecione um prato do catálogo." };

    await assertProductBelongsToEstablishment(supabase, establishmentId, input.productId);

    const payload = {
      establishment_id: establishmentId,
      product_id: input.productId,
      dish_type: input.dishType || "Prato Principal",
      manual_sale_price: toNullableNumber(input.manualSalePrice),
      restaurant_1_price: toNullableNumber(input.restaurant1Price),
      restaurant_2_price: toNullableNumber(input.restaurant2Price),
      restaurant_3_price: toNullableNumber(input.restaurant3Price),
      restaurant_4_price: toNullableNumber(input.restaurant4Price),
      restaurant_5_price: toNullableNumber(input.restaurant5Price),
      notes: input.notes?.trim() || null,
      created_by: userId,
      updated_at: new Date().toISOString(),
    };

    let { error } = await supabase
      .from("sales_price_benchmarks")
      .upsert(payload, { onConflict: "establishment_id,product_id" });

    if (error && isColumnOrSchemaError(error)) {
      const retry = await supabase
        .from("sales_price_benchmarks")
        .upsert({ ...payload, created_by: undefined }, { onConflict: "establishment_id,product_id" });
      error = retry.error;
    }

    if (error) return { ok: false, error: friendlyError(error, "Não foi possível salvar o Preço Venda Médio.") };

    revalidatePath("/engenharia/preco-venda-medio");
    return { ok: true };
  } catch (error) {
    console.error("Erro ao salvar Preço Venda Médio:", error);
    return { ok: false, error: error instanceof Error ? error.message : "Não foi possível salvar o Preço Venda Médio." };
  }
}
