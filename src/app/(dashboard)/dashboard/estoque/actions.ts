// src/app/(dashboard)/dashboard/estoque/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { dispatchLowStockAlertsForProducts } from "@/lib/alerts/domain-triggers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { moveStock, type StockMovementInput } from "@/lib/stock/moveStock";

type StockBalanceRow = {
  id: string;
  establishment_id: string;
  product_id: string;
  quantity: number;
  unit_label: string | null;
  min_qty: number | null;
  med_qty: number | null;
  max_qty: number | null;
  location: string | null;
  product: {
    id: string;
    name: string;
    price: number | null;
    default_unit_label: string | null;
    sku?: string | null;
    is_active?: boolean | null;
  } | null;
};

type CurrentStockRow = {
  establishment_id: string;
  product_id: string;
  unit_label: string | null;
  qty_balance: number;
};

type InventorySessionRow = {
  id: string;
  establishment_id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
};

type InventoryItemRow = {
  id: string;
  session_id: string;
  product_id: string;
  counted_quantity: number;
  unit_label: string | null;
  product: {
    id: string;
    name: string;
  } | null;
};

export type AddInventoryItemInput = {
  session_id: string;
  product_id: string;
  counted_quantity: number;
  unit_label: string;
};

export type BulkStockMetaUpdateItem = {
  balance_id?: string;
  product_id?: string;
  unit_label?: string | null;
  location?: string | null;
  min_qty?: number | null;
  med_qty?: number | null;
  max_qty?: number | null;
};

export type RecentStockMovementRow = {
  id: string;
  product_id: string;
  unit_label: string | null;
  qty: number;
  direction: string | null;
  movement_type: string | null;
  reason: string | null;
  details: any;
  created_at: string | null;
};

function normalizeUnitLabel(input: any): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  return s.toUpperCase();
}

function normalizeNumber(input: any, fallback = 0): number {
  const n = Number(input);
  return Number.isFinite(n) ? n : fallback;
}

async function getSupabaseAndEstablishment() {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = (membership as any)?.establishment_id as
    | string
    | undefined;

  if (!establishmentId) {
    console.error("Objeto de membership recebido:", membership);
    throw new Error(
      "Estabelecimento não encontrado para o usuário atual ao carregar dados de estoque."
    );
  }

  return { supabase, establishmentId };
}

async function getProductDefaultUnit(params: {
  supabase: any;
  establishmentId: string;
  productId: string;
}) {
  const { data, error } = await params.supabase
    .from("products")
    .select("id, default_unit_label")
    .eq("id", params.productId)
    .eq("establishment_id", params.establishmentId)
    .maybeSingle();

  if (error) {
    console.error(
      "[estoque.getProductDefaultUnit] erro ao consultar produto:",
      error
    );
    throw new Error("Não foi possível consultar a unidade padrão do produto.");
  }

  return normalizeUnitLabel((data as any)?.default_unit_label) ?? "UN";
}

async function ensureStockBalanceForProduct(params: {
  supabase: any;
  establishmentId: string;
  productId: string;
  unitLabel?: string | null;
}) {
  const canonicalUnit =
    normalizeUnitLabel(params.unitLabel) ??
    (await getProductDefaultUnit({
      supabase: params.supabase,
      establishmentId: params.establishmentId,
      productId: params.productId,
    }));

  const { data: existingRows, error: existingError } = await params.supabase
    .from("stock_balances")
    .select(
      "id, quantity, unit_label, min_qty, med_qty, max_qty, location, created_at"
    )
    .eq("establishment_id", params.establishmentId)
    .eq("product_id", params.productId)
    .order("id", { ascending: true });

  if (existingError) {
    console.error(
      "[estoque.ensureStockBalanceForProduct] erro ao consultar stock_balances:",
      existingError
    );
    throw new Error(
      "Não foi possível verificar a estrutura de estoque deste produto."
    );
  }

  const rows = (existingRows ?? []) as any[];

  if (rows.length === 0) {
    const { data: inserted, error: insertError } = await params.supabase
      .from("stock_balances")
      .insert({
        establishment_id: params.establishmentId,
        product_id: params.productId,
        quantity: 0,
        unit_label: canonicalUnit,
        min_qty: 0,
        med_qty: 0,
        max_qty: 0,
        location: "Estoque Principal",
      })
      .select("id")
      .maybeSingle();

    if (insertError) {
      console.error(
        "[estoque.ensureStockBalanceForProduct] erro ao inserir stock_balance:",
        insertError
      );
      throw new Error(
        "Não foi possível criar a estrutura de estoque para um ou mais produtos."
      );
    }

    return inserted?.id as string | undefined;
  }

  if (rows.length === 1) {
    const onlyRow = rows[0];

    const { error: updateSingleError } = await params.supabase
      .from("stock_balances")
      .update({
        unit_label: canonicalUnit,
      })
      .eq("id", onlyRow.id);

    if (updateSingleError) {
      console.error(
        "[estoque.ensureStockBalanceForProduct] erro ao padronizar unidade:",
        updateSingleError
      );
      throw new Error(
        "Não foi possível padronizar a unidade estrutural do estoque."
      );
    }

    return onlyRow.id as string;
  }

  const keeper = rows[0];
  const duplicateIds = rows.slice(1).map((row) => String(row.id));

  const mergedQuantity = rows.reduce(
    (acc, row) => acc + normalizeNumber(row.quantity, 0),
    0
  );

  const mergedMin = rows.reduce(
    (acc, row) => Math.max(acc, normalizeNumber(row.min_qty, 0)),
    0
  );
  const mergedMed = rows.reduce(
    (acc, row) => Math.max(acc, normalizeNumber(row.med_qty, 0)),
    0
  );
  const mergedMax = rows.reduce(
    (acc, row) => Math.max(acc, normalizeNumber(row.max_qty, 0)),
    0
  );

  const mergedLocation =
    rows.find((row) => String(row.location ?? "").trim().length > 0)?.location ??
    "Estoque Principal";

  const { error: updateKeeperError } = await params.supabase
    .from("stock_balances")
    .update({
      quantity: mergedQuantity,
      unit_label: canonicalUnit,
      min_qty: mergedMin,
      med_qty: mergedMed,
      max_qty: mergedMax,
      location: mergedLocation,
    })
    .eq("id", keeper.id);

  if (updateKeeperError) {
    console.error(
      "[estoque.ensureStockBalanceForProduct] erro ao consolidar duplicados:",
      updateKeeperError
    );
    throw new Error(
      "Não foi possível consolidar a estrutura duplicada de estoque deste produto."
    );
  }

  if (duplicateIds.length > 0) {
    const { error: deleteDuplicatesError } = await params.supabase
      .from("stock_balances")
      .delete()
      .in("id", duplicateIds);

    if (deleteDuplicatesError) {
      console.error(
        "[estoque.ensureStockBalanceForProduct] erro ao remover duplicados:",
        deleteDuplicatesError
      );
      throw new Error(
        "Não foi possível remover estruturas duplicadas de estoque deste produto."
      );
    }
  }

  return keeper.id as string;
}

async function getOpenInventorySessionOwned(
  supabase: any,
  establishmentId: string,
  sessionId: string
) {
  const { data: session, error } = await supabase
    .from("inventory_sessions")
    .select("id, establishment_id, status, started_at, finished_at")
    .eq("id", sessionId)
    .single();

  if (error || !session) {
    throw new Error("Sessão de inventário não encontrada.");
  }

  if ((session as any).establishment_id !== establishmentId) {
    throw new Error(
      "Sessão de inventário não pertence ao estabelecimento atual."
    );
  }

  if ((session as any).finished_at) {
    throw new Error("Esta sessão de inventário já foi encerrada.");
  }

  return session as InventorySessionRow;
}

export async function listCurrentStock(): Promise<StockBalanceRow[]> {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const { data, error } = await supabase
    .from("stock_balances")
    .select(
      `
      id,
      establishment_id,
      product_id,
      quantity,
      unit_label,
      min_qty,
      med_qty,
      max_qty,
      location,
      product:products!stock_balances_product_id_fkey!inner (
        id,
        name,
        price,
        default_unit_label,
        sku,
        is_active
      )
    `
    )
    .eq("establishment_id", establishmentId)
    .eq("product.is_active", true)
    .order("id");

  if (error) {
    console.error("Erro ao listar estoque:", error);
    throw new Error("Erro ao carregar estoque atual.");
  }

  const normalized = (data ?? []).map((row: any) => {
    const raw = row.product as any;
    let product: any = null;

    if (Array.isArray(raw)) {
      product = raw.length > 0 ? raw[0] : null;
    } else if (raw && typeof raw === "object") {
      product = raw;
    }

    return {
      ...row,
      unit_label: normalizeUnitLabel(row?.unit_label),
      product,
    };
  }) as StockBalanceRow[];

  const { data: cs, error: csErr } = await supabase
    .from("current_stock")
    .select("establishment_id, product_id, unit_label, qty_balance")
    .eq("establishment_id", establishmentId);

  if (csErr) {
    console.error("Erro ao listar current_stock:", csErr);
    throw new Error("Erro ao carregar saldo do estoque (current_stock).");
  }

  const currentRows = (cs ?? []).map((r: any) => ({
    establishment_id: String(r.establishment_id),
    product_id: String(r.product_id),
    unit_label: normalizeUnitLabel(r.unit_label),
    qty_balance: normalizeNumber(r.qty_balance, 0),
  })) as CurrentStockRow[];

  const byProduct = new Map<
    string,
    { total: number; byUnit: Map<string, number> }
  >();

  for (const r of currentRows) {
    const pid = String(r.product_id);
    const unit = String(r.unit_label ?? "").toUpperCase();
    const qty = normalizeNumber(r.qty_balance, 0);

    if (!byProduct.has(pid)) {
      byProduct.set(pid, { total: 0, byUnit: new Map() });
    }

    const entry = byProduct.get(pid)!;
    entry.total += qty;
    entry.byUnit.set(unit, (entry.byUnit.get(unit) ?? 0) + qty);
  }

  const dedupedByProduct = new Map<string, StockBalanceRow>();

  for (const row of normalized) {
    const pid = String(row.product_id);
    const canonicalUnit = normalizeUnitLabel(
      row.product?.default_unit_label ?? row.unit_label ?? "UN"
    ) ?? "UN";

    const entry = byProduct.get(pid);
    const canonicalQty = entry?.byUnit.get(canonicalUnit);
    const totalQty = entry?.total ?? 0;

    const nextRow: StockBalanceRow = {
      ...row,
      unit_label: canonicalUnit,
      quantity: canonicalQty !== undefined ? canonicalQty : totalQty,
    };

    const existing = dedupedByProduct.get(pid);

    if (!existing) {
      dedupedByProduct.set(pid, nextRow);
      continue;
    }

    dedupedByProduct.set(pid, {
      ...existing,
      unit_label: canonicalUnit,
      quantity: canonicalQty !== undefined ? canonicalQty : totalQty,
      min_qty: Math.max(
        normalizeNumber(existing.min_qty, 0),
        normalizeNumber(row.min_qty, 0)
      ),
      med_qty: Math.max(
        normalizeNumber(existing.med_qty, 0),
        normalizeNumber(row.med_qty, 0)
      ),
      max_qty: Math.max(
        normalizeNumber(existing.max_qty, 0),
        normalizeNumber(row.max_qty, 0)
      ),
      location:
        String(existing.location ?? "").trim() ||
        !String(row.location ?? "").trim()
          ? existing.location
          : row.location,
    });
  }

  return Array.from(dedupedByProduct.values());
}

export async function listProductsForInventory() {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, default_unit_label, sku, is_active")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao listar produtos do inventário:", error);
    throw new Error("Não foi possível carregar produtos do inventário.");
  }

  return (
    data?.map((p) => ({
      id: p.id as string,
      name: p.name as string,
      default_unit_label: (p as any).default_unit_label as string | null,
      sku: (p as any).sku as string | null,
    })) ?? []
  );
}

export async function seedInitialStockFromProducts() {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const { data: products, error: prodError } = await supabase
    .from("products")
    .select("id, default_unit_label")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true);

  if (prodError) {
    console.error("Erro ao carregar produtos para seed de estoque:", prodError);
    throw new Error("Não foi possível carregar produtos para criar estoque.");
  }

  if (!products || products.length === 0) {
    return;
  }

  const { data: existingBalances, error: balError } = await supabase
    .from("stock_balances")
    .select("product_id")
    .eq("establishment_id", establishmentId);

  if (balError) {
    console.error("Erro ao carregar estoques existentes:", balError);
    throw new Error("Não foi possível verificar estoque existente.");
  }

  const existingSet = new Set(
    (existingBalances ?? []).map((b) => String((b as any).product_id))
  );

  const rowsToInsert = products
    .filter((p) => !existingSet.has(String(p.id)))
    .map((p) => ({
      establishment_id: establishmentId,
      product_id: p.id,
      quantity: 0,
      unit_label: normalizeUnitLabel((p as any).default_unit_label) ?? "UN",
      min_qty: 0,
      med_qty: 0,
      max_qty: 0,
      location: "Estoque Principal",
    }));

  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("stock_balances")
      .insert(rowsToInsert);

    if (insertError) {
      console.error("Erro ao criar estoque inicial:", insertError);
      throw new Error("Não foi possível criar o estoque inicial.");
    }
  }

  for (const product of products) {
    await ensureStockBalanceForProduct({
      supabase,
      establishmentId,
      productId: String((product as any).id),
      unitLabel: (product as any).default_unit_label ?? "UN",
    });
  }
}

export async function getInventorySessionWithItems(): Promise<{
  session: InventorySessionRow;
  items: InventoryItemRow[];
} | null> {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const { data: sessions, error: sessError } = await supabase
    .from("inventory_sessions")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("status", "open")
    .order("started_at", { ascending: false })
    .limit(1);

  if (sessError) {
    console.error("Erro ao buscar sessão de inventário:", sessError);
    throw new Error("Não foi possível carregar a sessão de inventário.");
  }

  const session = sessions?.[0] as InventorySessionRow | undefined;
  if (!session) return null;

  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select(
      `
      id,
      session_id,
      product_id,
      counted_quantity,
      unit_label,
      product:products (
        id,
        name
      )
    `
    )
    .eq("session_id", session.id)
    .order("id");

  if (itemsError) {
    console.error("Erro ao buscar itens do inventário:", itemsError);
    throw new Error("Não foi possível carregar os itens da sessão.");
  }

  const normalizedItems = (items ?? []).map((row: any) => {
    const raw = row.product as any;
    let product: any = null;

    if (Array.isArray(raw)) {
      product = raw.length > 0 ? raw[0] : null;
    } else if (raw && typeof raw === "object") {
      product = raw;
    }

    return {
      ...row,
      unit_label: normalizeUnitLabel(row?.unit_label),
      product,
    };
  }) as InventoryItemRow[];

  return {
    session,
    items: normalizedItems,
  };
}

export async function startInventorySession(): Promise<InventorySessionRow> {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const existing = await getInventorySessionWithItems();
  if (existing?.session) {
    return existing.session;
  }

  const { data, error } = await supabase
    .from("inventory_sessions")
    .insert({
      establishment_id: establishmentId,
      status: "open",
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    console.error("Erro ao iniciar sessão de inventário:", error);
    throw new Error("Não foi possível iniciar o inventário.");
  }

  return data as InventorySessionRow;
}

export async function addInventoryItem(input: AddInventoryItemInput) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const counted = normalizeNumber(input.counted_quantity, 0);
  const unit = normalizeUnitLabel(input.unit_label);

  if (!input.session_id || !input.product_id || unit === null || counted < 0) {
    throw new Error("Dados inválidos para registrar a contagem do item.");
  }

  const session = await getOpenInventorySessionOwned(
    supabase,
    establishmentId,
    input.session_id
  );

  const { error: upsertError } = await supabase.from("inventory_items").upsert(
    {
      session_id: session.id,
      product_id: input.product_id,
      counted_quantity: counted,
      unit_label: unit,
    },
    {
      onConflict: "session_id,product_id,unit_label",
    } as any
  );

  if (upsertError) {
    const msg = String((upsertError as any)?.message ?? "");
    const code = String((upsertError as any)?.code ?? "");

    if (
      msg.toLowerCase().includes("on conflict") ||
      msg.toLowerCase().includes("does not exist") ||
      code === "42703" ||
      code === "42P10"
    ) {
      const { error: insertError } = await supabase
        .from("inventory_items")
        .insert({
          session_id: session.id,
          product_id: input.product_id,
          counted_quantity: counted,
          unit_label: unit,
        });

      if (insertError) {
        console.error("Erro ao adicionar item de inventário:", insertError);
        throw new Error("Não foi possível registrar a contagem do item.");
      }

      return;
    }

    console.error("Erro ao adicionar item de inventário (upsert):", upsertError);
    throw new Error("Não foi possível registrar a contagem do item.");
  }
}

export async function updateInventoryItem(
  itemId: string,
  countedQuantity: number
) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const safeQty = normalizeNumber(countedQuantity, -1);
  if (safeQty < 0) {
    throw new Error("A quantidade contada deve ser zero ou maior.");
  }

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, session_id")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    console.error("Erro ao localizar item do inventário:", itemError);
    throw new Error("Item de inventário não encontrado.");
  }

  await getOpenInventorySessionOwned(
    supabase,
    establishmentId,
    String((item as any).session_id)
  );

  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({
      counted_quantity: safeQty,
    })
    .eq("id", itemId);

  if (updateError) {
    console.error("Erro ao atualizar item contado:", updateError);
    throw new Error("Não foi possível atualizar o item contado.");
  }

  revalidatePath("/dashboard/estoque");
}

export async function deleteInventoryItem(itemId: string) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, session_id")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    console.error("Erro ao localizar item do inventário:", itemError);
    throw new Error("Item de inventário não encontrado.");
  }

  await getOpenInventorySessionOwned(
    supabase,
    establishmentId,
    String((item as any).session_id)
  );

  const { error: deleteError } = await supabase
    .from("inventory_items")
    .delete()
    .eq("id", itemId);

  if (deleteError) {
    console.error("Erro ao remover item contado:", deleteError);
    throw new Error("Não foi possível remover o item contado.");
  }

  revalidatePath("/dashboard/estoque");
}

export async function listRecentStockMovements(): Promise<
  RecentStockMovementRow[]
> {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const { data, error } = await supabase
    .from("inventory_movements")
    .select(
      "id, product_id, unit_label, qty, direction, movement_type, reason, details, created_at"
    )
    .eq("establishment_id", establishmentId)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Erro ao listar movimentações recentes:", error);
    throw new Error("Não foi possível carregar as movimentações recentes.");
  }

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    product_id: String(row.product_id),
    unit_label: normalizeUnitLabel(row.unit_label),
    qty: normalizeNumber(row.qty, 0),
    direction: row.direction ? String(row.direction) : null,
    movement_type: row.movement_type ? String(row.movement_type) : null,
    reason: row.reason ? String(row.reason) : null,
    details: row.details ?? null,
    created_at: row.created_at ? String(row.created_at) : null,
  }));
}

export async function finalizeInventory(sessionId: string) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const {
    data: authData,
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !authData?.user?.id) {
    console.error("Erro ao obter usuário autenticado:", authError);
    throw new Error("Usuário autenticado não encontrado para finalizar inventário.");
  }

  const session = await getOpenInventorySessionOwned(
    supabase,
    establishmentId,
    sessionId
  );

  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, product_id, counted_quantity, unit_label")
    .eq("session_id", session.id);

  if (itemsError) {
    console.error(
      "Erro ao buscar itens do inventário ao finalizar:",
      itemsError
    );
    throw new Error("Não foi possível carregar os itens do inventário.");
  }

  const consolidated = new Map<
    string,
    { product_id: string; unit_label: string | null; counted_quantity: number }
  >();

  for (const it of items ?? []) {
    const product_id = String((it as any).product_id ?? "").trim();
    const unit_label = normalizeUnitLabel((it as any).unit_label);
    const counted_quantity = normalizeNumber((it as any).counted_quantity, 0);

    if (!product_id) continue;

    const key = `${product_id}__${String(unit_label ?? "").toUpperCase()}`;
    const existing = consolidated.get(key);

    if (!existing) {
      consolidated.set(key, { product_id, unit_label, counted_quantity });
    } else {
      consolidated.set(key, {
        product_id,
        unit_label,
        counted_quantity:
          normalizeNumber(existing.counted_quantity, 0) + counted_quantity,
      });
    }
  }

  for (const item of consolidated.values()) {
    const canonicalUnit = await getProductDefaultUnit({
      supabase,
      establishmentId,
      productId: item.product_id,
    });

    await ensureStockBalanceForProduct({
      supabase,
      establishmentId,
      productId: item.product_id,
      unitLabel: canonicalUnit,
    });
  }

  const { data: currentRows, error: currentErr } = await supabase
    .from("current_stock")
    .select("product_id, unit_label, qty_balance")
    .eq("establishment_id", establishmentId);

  if (currentErr) {
    console.error("Erro ao carregar current_stock ao finalizar inventário:", currentErr);
    throw new Error("Não foi possível carregar o saldo atual do estoque.");
  }

  const currentMap = new Map<string, number>();
  for (const row of currentRows ?? []) {
    const pid = String((row as any).product_id ?? "").trim();
    const unit = String(
      normalizeUnitLabel((row as any).unit_label) ?? ""
    ).toUpperCase();
    const qty = normalizeNumber((row as any).qty_balance, 0);

    if (!pid) continue;

    const key = `${pid}__${unit}`;
    currentMap.set(key, qty);
  }

  const touchedProductIds = new Set<string>();

  for (const item of consolidated.values()) {
    const canonicalUnit = await getProductDefaultUnit({
      supabase,
      establishmentId,
      productId: item.product_id,
    });

    const key = `${item.product_id}__${canonicalUnit}`;
    const currentQty = currentMap.get(key) ?? 0;
    const countedQty = normalizeNumber(item.counted_quantity, 0);
    const diff = countedQty - currentQty;

    touchedProductIds.add(item.product_id);

    const { error: metaUpdateError } = await supabase
      .from("stock_balances")
      .update({
        unit_label: canonicalUnit,
      })
      .eq("establishment_id", establishmentId)
      .eq("product_id", item.product_id);

    if (metaUpdateError) {
      console.error(
        "Erro ao atualizar metadado de unidade em stock_balances:",
        item.product_id,
        metaUpdateError
      );
      throw new Error("Não foi possível sincronizar a unidade estrutural do estoque.");
    }

    if (diff === 0) {
      const { error: quantityMirrorError } = await supabase
        .from("stock_balances")
        .update({
          quantity: countedQty,
          unit_label: canonicalUnit,
        })
        .eq("establishment_id", establishmentId)
        .eq("product_id", item.product_id);

      if (quantityMirrorError) {
        console.error(
          "Erro ao espelhar quantidade em stock_balances:",
          item.product_id,
          quantityMirrorError
        );
        throw new Error(
          "Não foi possível atualizar o espelho de quantidade estrutural do estoque."
        );
      }

      continue;
    }

    const payload: StockMovementInput = {
      establishment_id: establishmentId,
      product_id: item.product_id,
      unit_label: canonicalUnit,
      qty_delta: diff,
      reason: diff > 0 ? "AJUSTE_PARA_MAIS" : "AJUSTE_PARA_MENOS",
      source: "inventory_finalize",
    };

    try {
      await moveStock(supabase as any, payload);
    } catch (moveErr) {
      console.error(
        "Erro ao gerar movimento de ajuste do inventário:",
        item.product_id,
        moveErr
      );
      throw new Error(
        "Não foi possível gerar os movimentos de ajuste para todos os itens do inventário."
      );
    }

    const { error: quantityMirrorError } = await supabase
      .from("stock_balances")
      .update({
        quantity: countedQty,
        unit_label: canonicalUnit,
      })
      .eq("establishment_id", establishmentId)
      .eq("product_id", item.product_id);

    if (quantityMirrorError) {
      console.error(
        "Erro ao espelhar quantidade em stock_balances:",
        item.product_id,
        quantityMirrorError
      );
      throw new Error(
        "Não foi possível atualizar o espelho de quantidade estrutural do estoque."
      );
    }
  }

  const { error: closeError } = await supabase
    .from("inventory_sessions")
    .update({
      finished_at: new Date().toISOString(),
      status: "closed",
    })
    .eq("id", session.id);

  if (closeError) {
    console.error("Erro ao encerrar sessão de inventário:", closeError);
    throw new Error("Não foi possível encerrar o inventário.");
  }

  await dispatchLowStockAlertsForProducts({
    establishmentId,
    productIds: Array.from(touchedProductIds),
    source: "inventory_finalize",
  });

  revalidatePath("/dashboard/estoque");
}

export async function updateStockThresholds(
  balanceId: string,
  min: number,
  med: number,
  max: number
) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const safeMin = normalizeNumber(min, 0);
  const safeMed = normalizeNumber(med, 0);
  const safeMax = normalizeNumber(max, 0);

  if (safeMin < 0 || safeMed < 0 || safeMax < 0) {
    throw new Error("Min/Méd/Máx não podem ser negativos.");
  }

  if (safeMed < safeMin) {
    throw new Error("O valor médio não pode ser menor que o mínimo.");
  }

  if (safeMax < safeMed) {
    throw new Error("O valor máximo não pode ser menor que o médio.");
  }

  const { data: balanceBefore, error: balanceError } = await supabase
    .from("stock_balances")
    .select("id, product_id")
    .eq("id", balanceId)
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (balanceError || !balanceBefore) {
    console.error("Erro ao localizar item de estoque:", balanceError);
    throw new Error("Não foi possível localizar o item para atualizar limites.");
  }

  const { error } = await supabase
    .from("stock_balances")
    .update({
      min_qty: safeMin,
      med_qty: safeMed,
      max_qty: safeMax,
    })
    .eq("id", balanceId)
    .eq("establishment_id", establishmentId);

  if (error) {
    console.error("Erro ao atualizar limites de estoque:", error);
    throw new Error("Não foi possível atualizar Min/Méd/Máx do produto.");
  }

  await dispatchLowStockAlertsForProducts({
    establishmentId,
    productIds: [String((balanceBefore as any).product_id)],
    source: "threshold_update",
  });

  revalidatePath("/dashboard/estoque");
}

export async function getLastClosedInventorySession(): Promise<
  InventorySessionRow | null
> {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const { data, error } = await supabase
    .from("inventory_sessions")
    .select(
      `
        id,
        establishment_id,
        status,
        started_at,
        finished_at
      `
    )
    .eq("establishment_id", establishmentId)
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar último inventário encerrado:", error);
    throw new Error("Não foi possível carregar o último inventário encerrado.");
  }

  const session = (data ?? [])[0] as InventorySessionRow | undefined;

  if (!session) {
    return null;
  }

  return session;
}

export async function createStockMovementAction(
  input: Omit<StockMovementInput, "establishment_id"> & {
    establishment_id?: string;
  }
) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const canonicalUnit = await getProductDefaultUnit({
    supabase,
    establishmentId,
    productId: String((input as any).product_id),
  });

  await ensureStockBalanceForProduct({
    supabase,
    establishmentId,
    productId: String((input as any).product_id),
    unitLabel: canonicalUnit,
  });

  const payload: StockMovementInput = {
    establishment_id: establishmentId,
    product_id: (input as any).product_id,
    unit_label: canonicalUnit,
    qty_delta: (input as any).qty_delta,
    reason: (input as any).reason ?? "adjustment",
    source: (input as any).source ?? "server_action",
  };

  const result = await moveStock(supabase as any, payload);

  if ((payload as any).product_id) {
    await dispatchLowStockAlertsForProducts({
      establishmentId,
      productIds: [String((payload as any).product_id)],
      source: "stock_movement",
    });
  }

  revalidatePath("/dashboard/estoque");
  return result;
}

export async function bulkUpdateStockMeta(items: BulkStockMetaUpdateItem[]) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: true, updated: 0 };
  }

  const consolidated = new Map<string, BulkStockMetaUpdateItem>();

  for (const it of items) {
    const balanceId = (it as any).balance_id as string | undefined;
    const productId = (it as any).product_id as string | undefined;

    if (!balanceId && !productId) continue;

    const key = balanceId ? `b:${balanceId}` : `p:${productId}`;
    consolidated.set(key, it);
  }

  let updated = 0;

  for (const it of consolidated.values()) {
    const balanceId = (it as any).balance_id as string | undefined;
    const productId = (it as any).product_id as string | undefined;

    if (!balanceId && !productId) continue;

    const payload: any = {};

    if ("unit_label" in it) {
      if (productId) {
        payload.unit_label = await getProductDefaultUnit({
          supabase,
          establishmentId,
          productId,
        });
      } else {
        payload.unit_label = normalizeUnitLabel(it.unit_label);
      }
    }

    if ("location" in it) payload.location = it.location ?? null;
    if ("min_qty" in it) payload.min_qty = normalizeNumber(it.min_qty, 0);
    if ("med_qty" in it) payload.med_qty = normalizeNumber(it.med_qty, 0);
    if ("max_qty" in it) payload.max_qty = normalizeNumber(it.max_qty, 0);

    if (
      payload.min_qty !== undefined &&
      payload.med_qty !== undefined &&
      payload.med_qty < payload.min_qty
    ) {
      throw new Error("No CSV, o valor médio não pode ser menor que o mínimo.");
    }

    if (
      payload.med_qty !== undefined &&
      payload.max_qty !== undefined &&
      payload.max_qty < payload.med_qty
    ) {
      throw new Error("No CSV, o valor máximo não pode ser menor que o médio.");
    }

    if (Object.keys(payload).length === 0) continue;

    let q = supabase
      .from("stock_balances")
      .update(payload)
      .eq("establishment_id", establishmentId);

    if (balanceId) q = q.eq("id", balanceId);
    else q = q.eq("product_id", productId as string);

    const { error } = await q;

    if (error) {
      console.error("[bulkUpdateStockMeta] erro ao atualizar item:", it, error);
      throw new Error(
        "Falha ao atualizar um ou mais itens via upload. Verifique o CSV e tente novamente."
      );
    }

    if (productId) {
      await ensureStockBalanceForProduct({
        supabase,
        establishmentId,
        productId,
        unitLabel: payload.unit_label,
      });
    }

    updated += 1;
  }

  const touchedProductIds = Array.from(
    new Set(
      Array.from(consolidated.values())
        .map((it) => (it as any).product_id)
        .filter(Boolean)
        .map(String)
    )
  );

  if (touchedProductIds.length > 0) {
    await dispatchLowStockAlertsForProducts({
      establishmentId,
      productIds: touchedProductIds,
      source: "bulk_meta_update",
    });
  }

  revalidatePath("/dashboard/estoque");
  return { ok: true, updated };
}

export async function zeroStockBalanceAction(input: {
  product_id: string;
  unit_label?: string | null;
  reason?: string;
}) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const productId = String(input.product_id ?? "").trim();

  if (!productId) {
    throw new Error("Produto inválido para zerar saldo.");
  }

  const canonicalUnit = await getProductDefaultUnit({
    supabase,
    establishmentId,
    productId,
  });

  await ensureStockBalanceForProduct({
    supabase,
    establishmentId,
    productId,
    unitLabel: canonicalUnit,
  });

  const { data: currentRows, error: currentErr } = await supabase
    .from("current_stock")
    .select("qty_balance, unit_label")
    .eq("establishment_id", establishmentId)
    .eq("product_id", productId);

  if (currentErr) {
    console.error("[zeroStockBalanceAction] erro ao consultar current_stock:", currentErr);
    throw new Error("Não foi possível consultar o saldo atual do produto.");
  }

  const currentQty = (currentRows ?? []).reduce((acc: number, row: any) => {
    const rowUnit = normalizeUnitLabel(row.unit_label) ?? "UN";
    if (rowUnit !== canonicalUnit) return acc;
    return acc + normalizeNumber(row.qty_balance, 0);
  }, 0);

  await supabase
    .from("stock_balances")
    .update({
      quantity: currentQty > 0 ? currentQty : 0,
      unit_label: canonicalUnit,
    })
    .eq("establishment_id", establishmentId)
    .eq("product_id", productId);

  if (currentQty !== 0) {
    await moveStock(supabase as any, {
      establishment_id: establishmentId,
      product_id: productId,
      unit_label: canonicalUnit,
      qty_delta: -currentQty,
      reason: input.reason || "ZERAR_SALDO_ESTOQUE",
      source: "manual_zero_stock_modal",
    });
  }

  const { error: mirrorError } = await supabase
    .from("stock_balances")
    .update({
      quantity: 0,
      unit_label: canonicalUnit,
    })
    .eq("establishment_id", establishmentId)
    .eq("product_id", productId);

  if (mirrorError) {
    console.error("[zeroStockBalanceAction] erro ao zerar stock_balances:", mirrorError);
    throw new Error("Saldo zerado por movimento, mas falhou ao atualizar o espelho do estoque.");
  }

  await dispatchLowStockAlertsForProducts({
    establishmentId,
    productIds: [productId],
    source: "stock_movement",
  });

  revalidatePath("/dashboard/estoque");

  return { ok: true, previousQty: currentQty, newQty: 0 };
}