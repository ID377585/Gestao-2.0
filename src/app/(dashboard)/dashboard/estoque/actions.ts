// src/app/(dashboard)/dashboard/estoque/actions.ts
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

// ✅ NOVO: action única para movimento de estoque (padronizada)
import { moveStock, type StockMovementInput } from "@/lib/stock/moveStock";

// ==== Tipagens auxiliares de retorno/entrada ====

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
  } | null;
};

// ✅ NOVO: tipagem da VIEW public.current_stock (saldo por movimentos)
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

// ✅ NOVO: bulk update de metadados do estoque (thresholds/local/unidade)
export type BulkStockMetaUpdateItem = {
  // um deles deve existir
  balance_id?: string;
  product_id?: string;

  unit_label?: string | null;
  location?: string | null;
  min_qty?: number | null;
  med_qty?: number | null;
  max_qty?: number | null;
};

// =======================================================
// HELPER: supabase + establishment do usuário logado
// =======================================================
async function getSupabaseAndEstablishment() {
  const supabase = await createSupabaseServerClient();

  // helper de membership no formato novo
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

// =======================================================
// 1) LISTAR ESTOQUE ATUAL
//    ✅ Mantém stock_balances para thresholds/local/id,
//    ✅ mas agora retorna quantity = current_stock.qty_balance (movimentos)
// =======================================================

export async function listCurrentStock(): Promise<StockBalanceRow[]> {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  // 1) Base: stock_balances + products (metadados do item)
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
      product:products!stock_balances_product_id_fkey (
        id,
        name,
        price,
        default_unit_label
      )
    `
    )
    .eq("establishment_id", establishmentId)
    .order("id");

  if (error) {
    console.error("Erro ao listar estoque:", error);
    throw new Error("Erro ao carregar estoque atual.");
  }

  // Normaliza o relacionamento product:products
  const normalized = (data ?? []).map((row: any) => {
    const raw = row.product as any;
    let product: any = null;

    if (Array.isArray(raw)) {
      product = raw.length > 0 ? raw[0] : null;
    } else if (raw && typeof raw === "object") {
      product = raw;
    } else {
      product = null;
    }

    return {
      ...row,
      product,
    };
  }) as StockBalanceRow[];

  // 2) Saldo real: view current_stock (derivada de inventory_movements)
  const { data: cs, error: csErr } = await supabase
    .from("current_stock")
    .select("establishment_id, product_id, unit_label, qty_balance")
    .eq("establishment_id", establishmentId);

  if (csErr) {
    console.error("Erro ao listar current_stock:", csErr);
    throw new Error("Erro ao carregar saldo do estoque (current_stock).");
  }

  const currentRows = (cs ?? []) as CurrentStockRow[];

  // 3) Monta mapa: por product_id, com total e por unidade
  const byProduct = new Map<
    string,
    { total: number; byUnit: Map<string, number> }
  >();

  for (const r of currentRows) {
    const pid = String(r.product_id);
    const unit = String(r.unit_label ?? "");
    const qty = Number(r.qty_balance ?? 0);

    if (!byProduct.has(pid)) {
      byProduct.set(pid, { total: 0, byUnit: new Map() });
    }

    const entry = byProduct.get(pid)!;
    entry.total += qty;
    entry.byUnit.set(unit, (entry.byUnit.get(unit) ?? 0) + qty);
  }

  // 4) Retorna o mesmo shape que o front já espera:
  //    row.quantity agora reflete qty_balance (movimentos)
  const merged = normalized.map((row) => {
    const pid = String(row.product_id);
    const unit = String(row.unit_label ?? "");

    const entry = byProduct.get(pid);
    if (!entry) {
      // sem movimentos -> saldo 0
      return { ...row, quantity: 0 };
    }

    // tenta casar por unidade
    const qtyByUnit = entry.byUnit.get(unit);
    if (qtyByUnit !== undefined) {
      return { ...row, quantity: qtyByUnit };
    }

    // fallback: total do produto (somando todas as unidades)
    return { ...row, quantity: entry.total };
  });

  return merged;
}

// =======================================================
// 2) LISTAR PRODUTOS PARA INVENTÁRIO (tabela products)
// =======================================================

export async function listProductsForInventory() {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const { data, error } = await supabase
    .from("products")
    .select("id, name, default_unit_label, is_active")
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
    })) ?? []
  );
}

// =======================================================
// 3) CRIAR ESTOQUE INICIAL A PARTIR DE PRODUCTS (seed)
// =======================================================

export async function seedInitialStockFromProducts() {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  // produtos ativos
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

  // estoque já existente para esses produtos
  const { data: existingBalances, error: balError } = await supabase
    .from("stock_balances")
    .select("product_id")
    .eq("establishment_id", establishmentId);

  if (balError) {
    console.error("Erro ao carregar estoques existentes:", balError);
    throw new Error("Não foi possível verificar estoque existente.");
  }

  const existingSet = new Set(
    (existingBalances ?? []).map((b) => (b as any).product_id as string)
  );

  const rowsToInsert = products
    .filter((p) => !existingSet.has(p.id as string))
    .map((p) => ({
      establishment_id: establishmentId,
      product_id: p.id,
      quantity: 0,
      // Normalize default unit labels to uppercase, fallback to "UN"
      unit_label: ((p as any).default_unit_label ?? "UN").toUpperCase(),
      min_qty: 0,
      med_qty: 0,
      max_qty: 0,
      location: "Estoque Principal",
    }));

  if (rowsToInsert.length === 0) return;

  const { error: insertError } = await supabase
    .from("stock_balances")
    .insert(rowsToInsert);

  if (insertError) {
    console.error("Erro ao criar estoque inicial:", insertError);
    throw new Error("Não foi possível criar o estoque inicial.");
  }
}

// =======================================================
// 4) INVENTÁRIO – SESSÃO (inventory_sessions)
// =======================================================

export async function getInventorySessionWithItems(): Promise<{
  session: InventorySessionRow;
  items: InventoryItemRow[];
} | null> {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  // última sessão "open" para o estabelecimento
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

  // Normaliza o relacionamento product:products (array ou objeto)
  const normalizedItems = (items ?? []).map((row: any) => {
    const raw = row.product as any;
    let product: any = null;

    if (Array.isArray(raw)) {
      product = raw.length > 0 ? raw[0] : null;
    } else if (raw && typeof raw === "object") {
      product = raw;
    } else {
      product = null;
    }

    return {
      ...row,
      product,
    };
  }) as InventoryItemRow[];

  return {
    session,
    items: normalizedItems,
  };
}

// Cria uma nova sessão de inventário
export async function startInventorySession(): Promise<InventorySessionRow> {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  // se já tiver uma em aberto, reaproveita
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

// =======================================================
// 5) INVENTÁRIO – ADICIONAR ITEM (inventory_items)
// =======================================================

export async function addInventoryItem(input: AddInventoryItemInput) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  // Segurança extra: valida se a sessão pertence ao mesmo estabelecimento
  const { data: session, error: sessionError } = await supabase
    .from("inventory_sessions")
    .select("id, establishment_id, status, finished_at")
    .eq("id", input.session_id)
    .single();

  if (sessionError || !session) {
    console.error("Sessão de inventário não encontrada:", sessionError);
    throw new Error("Sessão de inventário não encontrada.");
  }

  if ((session as any).establishment_id !== establishmentId) {
    throw new Error(
      "Sessão de inventário não pertence ao estabelecimento atual."
    );
  }

  // se já tiver finished_at, consideramos encerrado
  if ((session as any).finished_at) {
    throw new Error(
      "Não é possível adicionar itens em um inventário encerrado."
    );
  }

  const { error: insertError } = await supabase.from("inventory_items").insert({
    session_id: input.session_id,
    product_id: input.product_id,
    counted_quantity: input.counted_quantity,
    // Normalize unit label to uppercase before storing
    unit_label: input.unit_label.toUpperCase(),
  });

  if (insertError) {
    console.error("Erro ao adicionar item de inventário:", insertError);
    throw new Error("Não foi possível registrar a contagem do item.");
  }
}

// =======================================================
// 6) INVENTÁRIO – FINALIZAR (atualiza stock_balances)
// =======================================================

export async function finalizeInventory(sessionId: string) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  // Carrega sessão
  const { data: session, error: sessionError } = await supabase
    .from("inventory_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    console.error(
      "Sessão de inventário não encontrada ao finalizar:",
      sessionError
    );
    throw new Error("Sessão de inventário não encontrada.");
  }

  if ((session as any).establishment_id !== establishmentId) {
    throw new Error(
      "Sessão de inventário não pertence ao estabelecimento atual."
    );
  }

  // se já tiver finished_at, consideramos encerrada
  if ((session as any).finished_at) {
    throw new Error("Esta sessão de inventário já foi encerrada.");
  }

  // Carrega itens da sessão
  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, product_id, counted_quantity, unit_label")
    .eq("session_id", sessionId);

  if (itemsError) {
    console.error(
      "Erro ao buscar itens do inventário ao finalizar:",
      itemsError
    );
    throw new Error("Não foi possível carregar os itens do inventário.");
  }

  // Atualiza estoque para cada item contado
  for (const item of items ?? []) {
    const { error: updateError } = await supabase
      .from("stock_balances")
      .update({
        quantity: (item as any).counted_quantity,
        // Normalize unit labels to uppercase; if unit_label is falsy, set null
        unit_label: (item as any).unit_label
          ? String((item as any).unit_label).toUpperCase()
          : null,
      })
      .eq("establishment_id", establishmentId)
      .eq("product_id", (item as any).product_id);

    if (updateError) {
      console.error(
        "Erro ao atualizar saldo de estoque para o produto:",
        (item as any).product_id,
        updateError
      );
      throw new Error(
        "Não foi possível atualizar os saldos de estoque para todos os itens."
      );
    }
  }

  // Marca sessão como encerrada apenas com finished_at
  const { error: closeError } = await supabase
    .from("inventory_sessions")
    .update({
      finished_at: new Date().toISOString(),
      // não mexemos em status aqui para evitar conflito com o ENUM
    })
    .eq("id", sessionId);

  if (closeError) {
    console.error("Erro ao encerrar sessão de inventário:", closeError);
    throw new Error("Não foi possível encerrar o inventário.");
  }
}

// =======================================================
// 7) ATUALIZAR MÍN / MÉD / MÁX (stock_balances)
// =======================================================

export async function updateStockThresholds(
  balanceId: string,
  min: number,
  med: number,
  max: number
) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  const { error } = await supabase
    .from("stock_balances")
    .update({
      min_qty: min,
      med_qty: med,
      max_qty: max,
    })
    .eq("id", balanceId)
    .eq("establishment_id", establishmentId);

  if (error) {
    console.error("Erro ao atualizar limites de estoque:", error);
    throw new Error("Não foi possível atualizar Min/Méd/Máx do produto.");
  }
}

// =======================================================
// 8) BUSCAR ÚLTIMO INVENTÁRIO ENCERRADO
// =======================================================

export async function getLastClosedInventorySession(): Promise<
  InventorySessionRow | null
> {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  // ✅ Busca APENAS inventários encerrados (finished_at preenchido)
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
    .not("finished_at", "is", null) // finished_at IS NOT NULL
    .order("finished_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Erro ao buscar último inventário encerrado:", error);
    throw new Error("Não foi possível carregar o último inventário encerrado.");
  }

  const session = (data ?? [])[0] as InventorySessionRow | undefined;

  if (!session) {
    console.log(
      "[getLastClosedInventorySession] Nenhuma sessão encerrada (finished_at preenchido) encontrada para este estabelecimento."
    );
    return null;
  }

  return session;
}

// =======================================================
// 9) ✅ NOVO: SERVER ACTION ÚNICA PARA MOVIMENTO DE ESTOQUE
//    (padroniza com /api/stock-movements)
// =======================================================

export async function createStockMovementAction(
  input: Omit<StockMovementInput, "establishment_id"> & {
    establishment_id?: string;
  }
) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  // Força establishment do usuário logado (evita spoof via client)
  const payload: StockMovementInput = {
    establishment_id: establishmentId,
    product_id: (input as any).product_id,
    // Normalize unit label to uppercase when creating movements
    unit_label: String((input as any).unit_label ?? "").toUpperCase(),
    qty_delta: (input as any).qty_delta,
    reason: (input as any).reason ?? "adjustment",
    source: (input as any).source ?? "server_action",
  };

  return moveStock(supabase as any, payload);
}

// =======================================================
// 10) ✅ NOVO: BULK UPDATE (CSV Upload) - metadados do estoque
//     Atualiza: unit_label, location, min_qty, med_qty, max_qty em stock_balances
// =======================================================

export async function bulkUpdateStockMeta(items: BulkStockMetaUpdateItem[]) {
  const { supabase, establishmentId } = await getSupabaseAndEstablishment();

  if (!Array.isArray(items) || items.length === 0) {
    return { ok: true, updated: 0 };
  }

  let updated = 0;

  for (const it of items) {
    const balanceId = (it as any).balance_id as string | undefined;
    const productId = (it as any).product_id as string | undefined;

    if (!balanceId && !productId) continue;

    const payload: any = {};
    if ("unit_label" in it) {
      // Convert supplied unit labels to uppercase. When empty, interpret as null.
      payload.unit_label = it.unit_label
        ? String(it.unit_label).toUpperCase()
        : null;
    }
    if ("location" in it) payload.location = it.location ?? null;
    if ("min_qty" in it) payload.min_qty = it.min_qty ?? 0;
    if ("med_qty" in it) payload.med_qty = it.med_qty ?? 0;
    if ("max_qty" in it) payload.max_qty = it.max_qty ?? 0;

    // não atualiza se payload veio vazio
    if (Object.keys(payload).length === 0) continue;

    let q = supabase.from("stock_balances").update(payload).eq(
      "establishment_id",
      establishmentId
    );

    if (balanceId) q = q.eq("id", balanceId);
    else q = q.eq("product_id", productId as string);

    const { error } = await q;

    if (error) {
      console.error("[bulkUpdateStockMeta] erro ao atualizar item:", it, error);
      throw new Error(
        "Falha ao atualizar um ou mais itens via upload. Verifique o CSV e tente novamente."
      );
    }

    updated += 1;
  }

  return { ok: true, updated };
}
