"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null")
    return null;
  return v;
}

function safeStr(v: any): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function safeNum(v: any): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function uuid() {
  return crypto.randomUUID();
}

async function getAuthenticatedUserId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const userId = normalizeId(authData?.user?.id);

  if (authErr || !userId) {
    throw new Error("Usuário não autenticado.");
  }

  return userId;
}

async function assertActiveMembershipForEstablishment(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  establishmentId: string;
}) {
  const { data, error } = await params.supabase
    .from("memberships")
    .select("id")
    .eq("user_id", params.userId)
    .eq("establishment_id", params.establishmentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Erro ao validar membership:", error);
    throw new Error("Não foi possível validar acesso ao estabelecimento.");
  }

  if (!data?.id) {
    throw new Error("Você não tem acesso ao estabelecimento selecionado.");
  }
}

async function assertProductBelongsToEstablishment(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  establishmentId: string;
  productId: string;
}) {
  const { data, error } = await params.supabase
    .from("products")
    .select("id")
    .eq("id", params.productId)
    .eq("establishment_id", params.establishmentId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Erro ao validar produto da transferência:", error);
    throw new Error("Não foi possível validar o produto selecionado.");
  }

  if (!data?.id) {
    throw new Error("Produto inválido para o estabelecimento de origem.");
  }
}

export async function getTransferOptions() {
  const supabase = await createSupabaseServerClient();

  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = normalizeId((membership as any)?.establishment_id);

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado para o usuário atual.");
  }

  const userId = await getAuthenticatedUserId(supabase);

  const { data: memberships, error: memErr } = await supabase
    .from("memberships")
    .select("establishment_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (memErr) {
    console.error("Erro ao listar memberships:", memErr);
    throw new Error("Não foi possível carregar unidades do usuário.");
  }

  const establishmentIds = Array.from(
    new Set(
      (memberships ?? [])
        .map((m: any) => normalizeId(m?.establishment_id))
        .filter(Boolean) as string[],
    ),
  );

  if (establishmentIds.length === 0) establishmentIds.push(establishmentId);

  const { data: establishments, error: estErr } = await supabase
    .from("establishments")
    .select("id, name")
    .in("id", establishmentIds)
    .order("name", { ascending: true });

  if (estErr) {
    console.error("Erro ao listar establishments:", estErr);
    throw new Error("Não foi possível carregar estabelecimentos.");
  }

  return {
    establishmentId,
    establishments: (establishments ?? []).map((e: any) => ({
      id: String(e.id),
      name: String(e.name ?? "Sem nome"),
    })),
  };
}

export async function searchProductsForTransfer(params: {
  establishmentId: string;
  q: string;
  limit?: number;
}) {
  const supabase = await createSupabaseServerClient();
  const userId = await getAuthenticatedUserId(supabase);

  const establishmentId = normalizeId(params.establishmentId);
  const q = String(params.q ?? "").trim();
  const limit = Math.min(Math.max(Number(params.limit ?? 20), 1), 50);

  if (!establishmentId) return [];

  await assertActiveMembershipForEstablishment({
    supabase,
    userId,
    establishmentId,
  });

  const query = q.length > 0 ? q : "";

  let db = supabase
    .from("products")
    .select("id, name, default_unit_label")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(limit);

  if (query) {
    db = db.ilike("name", `%${query}%`);
  }

  const { data, error } = await db;

  if (error) {
    console.error("Erro ao buscar produtos (transfer):", error);
    throw new Error("Não foi possível buscar produtos.");
  }

  return (data ?? []).map((p: any) => ({
    id: String(p.id),
    name: String(p.name),
    default_unit_label: (p as any).default_unit_label ?? null,
  }));
}

export type TransferListItem = {
  transfer_id: string;
  created_at: string;
  product_id: string;
  product_name: string | null;
  unit_label: string;
  qty: number;
  direction: "IN" | "OUT";
  counterparty_establishment_id: string | null;
  reason: string | null;
  movement_id: string;
  details: any;
};

type RawMoveRow = {
  id: string;
  created_at: string;
  product_id: string;
  unit_label: string;
  qty: any;
  direction: "IN" | "OUT";
  movement_type: string;
  reason: string | null;
  details: any;
  products?: { name?: string | null } | null;
};

export async function listTransfers(params?: {
  q?: string;
  direction?: "IN" | "OUT" | "ALL";
  from?: string;
  to?: string;
  limit?: number;
}): Promise<TransferListItem[]> {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = normalizeId((membership as any)?.establishment_id);
  if (!establishmentId) return [];

  const q = safeStr(params?.q)?.toLowerCase() ?? null;
  const dir = params?.direction ?? "ALL";
  const limit = Math.min(Math.max(params?.limit ?? 200, 1), 500);

  let query = supabase
    .from("inventory_movements")
    .select(
      `
      id,
      created_at,
      product_id,
      unit_label,
      qty,
      direction,
      movement_type,
      reason,
      details,
      products ( name )
    `,
    )
    .eq("establishment_id", establishmentId)
    .eq("movement_type", "transferencia")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (dir !== "ALL") query = query.eq("direction", dir);

  if (params?.from) query = query.gte("created_at", `${params.from}T00:00:00.000Z`);
  if (params?.to) query = query.lte("created_at", `${params.to}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) {
    console.error("listTransfers error:", error);
    return [];
  }

  const rows = (data ?? []) as RawMoveRow[];
  const groups = new Map<string, RawMoveRow>();

  for (const r of rows) {
    const transferId =
      safeStr((r as any)?.details?.transfer_id) ??
      safeStr((r as any)?.details?.transferId) ??
      r.id;
    if (!groups.has(transferId)) groups.set(transferId, r);
  }

  const items: TransferListItem[] = [];

  for (const [transfer_id, r] of groups.entries()) {
    const toId = safeStr((r as any)?.details?.to_establishment_id);
    const fromId = safeStr((r as any)?.details?.from_establishment_id);
    const counterparty = r.direction === "OUT" ? toId ?? null : fromId ?? null;
    const productName =
      r?.products?.name ?? safeStr((r as any)?.details?.product_name) ?? null;

    if (q) {
      const hay = [
        transfer_id,
        productName ?? "",
        r.unit_label ?? "",
        r.direction ?? "",
        r.reason ?? "",
        counterparty ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (!hay.includes(q)) continue;
    }

    items.push({
      transfer_id,
      created_at: r.created_at,
      movement_id: r.id,
      product_id: String(r.product_id),
      product_name: productName,
      unit_label: String(r.unit_label),
      qty: safeNum(r.qty),
      direction: r.direction,
      counterparty_establishment_id: counterparty,
      reason: r.reason ?? null,
      details: r.details ?? null,
    });
  }

  return items;
}

export type TransferDetails = {
  transfer_id: string;
  rows: Array<{
    id: string;
    created_at: string;
    product_id: string;
    product_name: string | null;
    unit_label: string;
    qty: number;
    direction: "IN" | "OUT";
    reason: string | null;
    details: any;
  }>;
};

export async function getTransferDetails(
  transferId: string,
): Promise<TransferDetails | null> {
  const supabase = await createSupabaseServerClient();
  const { membership } = await getActiveMembershipOrRedirect();

  const establishmentId = normalizeId((membership as any)?.establishment_id);
  if (!establishmentId) return null;

  const tId = safeStr(transferId);
  if (!tId) return null;

  const { data, error } = await supabase
    .from("inventory_movements")
    .select(
      `
      id,
      created_at,
      product_id,
      unit_label,
      qty,
      direction,
      movement_type,
      reason,
      details,
      products ( name )
    `,
    )
    .eq("establishment_id", establishmentId)
    .eq("movement_type", "transferencia")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("getTransferDetails error:", error);
    return null;
  }

  const rowsAll = (data ?? []) as RawMoveRow[];

  const rows = rowsAll.filter((r) => {
    const id =
      safeStr((r as any)?.details?.transfer_id) ??
      safeStr((r as any)?.details?.transferId) ??
      r.id;
    return id === tId;
  });

  if (rows.length === 0) return null;

  const mapped = rows
    .slice()
    .sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
    .map((r) => ({
      id: r.id,
      created_at: r.created_at,
      product_id: String(r.product_id),
      product_name:
        r?.products?.name ?? safeStr((r as any)?.details?.product_name) ?? null,
      unit_label: String(r.unit_label),
      qty: safeNum(r.qty),
      direction: r.direction,
      reason: r.reason ?? null,
      details: r.details ?? null,
    }));

  return {
    transfer_id: tId,
    rows: mapped,
  };
}

export type CreateTransferInput = {
  to_establishment_id: string;
  notes?: string | null;
  items: Array<{
    product_id: string;
    unit_label: string;
    qty: number;
  }>;
};

async function getAvailableStock(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  establishmentId: string;
  product_id: string;
  unit_label: string;
}) {
  const { supabase, establishmentId, product_id, unit_label } = params;

  const { data, error } = await supabase
    .from("current_stock")
    .select("qty_balance")
    .eq("establishment_id", establishmentId)
    .eq("product_id", product_id)
    .eq("unit_label", unit_label)
    .maybeSingle();

  if (error) {
    console.error("Erro ao consultar saldo:", error);
    throw new Error("Erro ao consultar saldo do estoque.");
  }

  return Number(data?.qty_balance ?? 0);
}

export async function createTransfer(
  params: CreateTransferInput,
): Promise<{ ok: true; transfer_id: string }> {
  const supabase = await createSupabaseServerClient();

  const { membership } = await getActiveMembershipOrRedirect();
  const from_establishment_id = normalizeId((membership as any)?.establishment_id);

  if (!from_establishment_id) {
    throw new Error("Estabelecimento de origem não encontrado para o usuário atual.");
  }

  const created_by = await getAuthenticatedUserId(supabase);

  await assertActiveMembershipForEstablishment({
    supabase,
    userId: created_by,
    establishmentId: from_establishment_id,
  });

  const to_establishment_id = normalizeId(params?.to_establishment_id);
  if (!to_establishment_id) {
    throw new Error("Destino inválido.");
  }

  if (to_establishment_id === from_establishment_id) {
    throw new Error("Origem e destino não podem ser iguais.");
  }

  await assertActiveMembershipForEstablishment({
    supabase,
    userId: created_by,
    establishmentId: to_establishment_id,
  });

  const items = (params?.items ?? [])
    .map((it) => ({
      product_id: normalizeId(it.product_id),
      unit_label: String(it.unit_label ?? "").trim().toUpperCase(),
      qty: safeNum(it.qty),
    }))
    .filter((it) => it.product_id && it.unit_label && it.qty > 0) as Array<{
    product_id: string;
    unit_label: string;
    qty: number;
  }>;

  if (!items.length) {
    throw new Error("Informe ao menos 1 item válido.");
  }

  for (const item of items) {
    await assertProductBelongsToEstablishment({
      supabase,
      establishmentId: from_establishment_id,
      productId: item.product_id,
    });
  }

  const transfer_id = uuid();
  const notes = safeStr(params?.notes) ?? null;

  for (const it of items) {
    const available = await getAvailableStock({
      supabase,
      establishmentId: from_establishment_id,
      product_id: it.product_id,
      unit_label: it.unit_label,
    });

    if (it.qty > available) {
      throw new Error(
        `Saldo insuficiente para o produto (${it.product_id}) na unidade ${it.unit_label}. Disponível: ${available}, solicitado: ${it.qty}.`,
      );
    }
  }

  const outRows = items.map((it) => ({
    establishment_id: from_establishment_id,
    product_id: it.product_id,
    unit_label: it.unit_label,
    qty: it.qty,
    direction: "OUT" as const,
    movement_type: "transferencia",
    reason: "transferencia",
    notes,
    created_by,
    details: {
      transfer_id,
      from_establishment_id,
      to_establishment_id,
    },
  }));

  const inRows = items.map((it) => ({
    establishment_id: to_establishment_id,
    product_id: it.product_id,
    unit_label: it.unit_label,
    qty: it.qty,
    direction: "IN" as const,
    movement_type: "transferencia",
    reason: "transferencia",
    notes,
    created_by,
    details: {
      transfer_id,
      from_establishment_id,
      to_establishment_id,
    },
  }));

  const { error: outErr } = await supabase.from("inventory_movements").insert(outRows);
  if (outErr) {
    console.error("Erro ao inserir OUT:", outErr);
    throw new Error("Não foi possível registrar a saída (origem).");
  }

  const { error: inErr } = await supabase.from("inventory_movements").insert(inRows);
  if (inErr) {
    console.error("Erro ao inserir IN:", inErr);

    try {
      await supabase
        .from("inventory_movements")
        .delete()
        .eq("establishment_id", from_establishment_id)
        .eq("movement_type", "transferencia")
        .contains("details", { transfer_id });
    } catch (e) {
      console.error("Rollback OUT falhou:", e);
    }

    throw new Error("Não foi possível registrar a entrada (destino).");
  }

  revalidatePath("/dashboard/transferencias");

  return { ok: true, transfer_id };
}
