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

/**
 * Retorna:
 * - establishmentId (origem padrão do usuário logado)
 * - lista de estabelecimentos acessíveis (para escolher destino)
 */
export async function getTransferOptions() {
  const supabase = await createSupabaseServerClient();

  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = normalizeId((membership as any)?.establishment_id);

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado para o usuário atual.");
  }

  // 1) pega todos establishments vinculados ao usuário (via memberships)
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const userId = normalizeId(authData?.user?.id);

  if (authErr || !userId) {
    throw new Error("Usuário não autenticado.");
  }

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

  // fallback: ao menos o establishment do membership atual
  if (establishmentIds.length === 0) establishmentIds.push(establishmentId);

  // 2) carrega dados dos establishments acessíveis
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

/**
 * Autocomplete de produtos (filtrado por establishment_id)
 */
export async function searchProductsForTransfer(params: {
  establishmentId: string;
  q: string;
  limit?: number;
}) {
  const supabase = await createSupabaseServerClient();
  await getActiveMembershipOrRedirect();

  const establishmentId = normalizeId(params.establishmentId);
  const q = String(params.q ?? "").trim();
  const limit = Math.min(Math.max(Number(params.limit ?? 20), 1), 50);

  if (!establishmentId) return [];

  // se query vazia, retorna lista curta
  const query = q.length > 0 ? q : "";

  let db = supabase
    .from("products")
    .select("id, name, default_unit_label")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .limit(limit);

  if (query) {
    // ilike para autocomplete
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

/* =====================================================================================
   PASSO 4 — HISTÓRICO / LISTAGEM + DETALHE (compatível com inventory_movements)
===================================================================================== */

export type TransferListItem = {
  transfer_id: string;
  created_at: string;

  // produto
  product_id: string;
  product_name: string | null;

  unit_label: string;
  qty: number;

  // "OUT" = enviado / "IN" = recebido
  direction: "IN" | "OUT";

  // contraparte (destino no OUT / origem no IN)
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
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
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

  if (params?.from)
    query = query.gte("created_at", `${params.from}T00:00:00.000Z`);
  if (params?.to) query = query.lte("created_at", `${params.to}T23:59:59.999Z`);

  const { data, error } = await query;
  if (error) {
    console.error("listTransfers error:", error);
    return [];
  }

  const rows = (data ?? []) as RawMoveRow[];

  // Agrupa por transfer_id salvo em details.transfer_id
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

    const productName = r?.products?.name ?? safeStr((r as any)?.details?.product_name) ?? null;

    // filtro textual simples (pós-query)
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

  // Abordagem robusta: busca últimos 500 e filtra em memória pelo details.transfer_id
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
      product_name: r?.products?.name ?? safeStr((r as any)?.details?.product_name) ?? null,
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

/* =====================================================================================
   PASSO 5 — CRIAR TRANSFERÊNCIA (OUT na origem + IN no destino)
   - grava em inventory_movements
   - valida estoque na view inventory_current_stock (se existir)
===================================================================================== */

export type CreateTransferInput = {
  to_establishment_id: string;
  product_id: string; // produto da ORIGEM
  qty: number;
  unit_label: string;
  reason?: string | null;
  notes?: string | null;
};

export async function createTransfer(
  input: CreateTransferInput,
): Promise<{ ok: boolean; transfer_id: string }> {
  const supabase = await createSupabaseServerClient();

  const { membership } = await getActiveMembershipOrRedirect();
  const fromEstablishmentId = normalizeId((membership as any)?.establishment_id);

  if (!fromEstablishmentId) {
    throw new Error("Estabelecimento de origem não encontrado para o usuário atual.");
  }

  // userId
  const { data: authData, error: authErr } = await supabase.auth.getUser();
  const userId = normalizeId(authData?.user?.id);
  if (authErr || !userId) throw new Error("Usuário não autenticado.");

  const toEstablishmentId = normalizeId(input?.to_establishment_id);
  const productIdFrom = normalizeId(input?.product_id);
  const unitLabel = safeStr(input?.unit_label);
  const qty = safeNum(input?.qty);

  if (!toEstablishmentId) throw new Error("Selecione o estabelecimento de destino.");
  if (toEstablishmentId === fromEstablishmentId) {
    throw new Error("O destino não pode ser o mesmo que a origem.");
  }
  if (!productIdFrom) throw new Error("Selecione um produto válido.");
  if (!unitLabel) throw new Error("Informe a unidade (unit_label).");
  if (!(qty > 0)) throw new Error("Informe uma quantidade maior que zero.");

  // 1) Verifica se o usuário tem membership ativo no destino
  const { data: memTo, error: memToErr } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("establishment_id", toEstablishmentId)
    .eq("is_active", true)
    .maybeSingle();

  if (memToErr) {
    console.error("Erro ao validar membership destino:", memToErr);
    throw new Error("Não foi possível validar permissão no destino.");
  }
  if (!memTo?.id) {
    throw new Error("Você não tem acesso ao estabelecimento de destino.");
  }

  // 2) Produto na ORIGEM (precisamos do nome para mapear no destino)
  const { data: prodFrom, error: prodFromErr } = await supabase
    .from("products")
    .select("id, name, default_unit_label")
    .eq("establishment_id", fromEstablishmentId)
    .eq("id", productIdFrom)
    .maybeSingle();

  if (prodFromErr) {
    console.error("Erro ao buscar produto origem:", prodFromErr);
    throw new Error("Não foi possível carregar o produto da origem.");
  }
  if (!prodFrom?.id) throw new Error("Produto não encontrado na origem.");

  const productName = safeStr((prodFrom as any)?.name) ?? "Produto";
  const reason = safeStr(input?.reason) ?? "transferencia";
  const notes = safeStr(input?.notes);

  // 3) Confere estoque atual na ORIGEM (VIEW inventory_current_stock)
  // Se a view não existir / der erro, apenas não bloqueia (best-effort).
  try {
    const { data: stockRow, error: stockErr } = await supabase
      .from("inventory_current_stock")
      .select("current_stock")
      .eq("establishment_id", fromEstablishmentId)
      .eq("product_id", productIdFrom)
      .eq("unit_label", unitLabel)
      .maybeSingle();

    if (!stockErr) {
      const currentStock = Number((stockRow as any)?.current_stock ?? 0);
      if (qty > currentStock) {
        throw new Error(
          `Estoque insuficiente na origem. Disponível: ${currentStock} ${unitLabel}.`,
        );
      }
    }
  } catch (e: any) {
    // se a view não existir ou falhar, não trava a transferência aqui
    // (o ideal é ter RLS/trigger no banco, mas mantemos robusto)
    if (
      typeof e?.message === "string" &&
      e.message.includes("Estoque insuficiente")
    ) {
      throw e;
    }
  }

  // 4) Mapeia produto no DESTINO (por nome)
  const { data: prodTo, error: prodToErr } = await supabase
    .from("products")
    .select("id, name")
    .eq("establishment_id", toEstablishmentId)
    .eq("name", productName)
    .eq("is_active", true)
    .maybeSingle();

  if (prodToErr) {
    console.error("Erro ao buscar produto destino:", prodToErr);
    throw new Error("Não foi possível carregar o produto no destino.");
  }

  if (!prodTo?.id) {
    throw new Error(
      `O produto "${productName}" não existe no destino. Crie/importe o produto no estabelecimento de destino antes de transferir.`,
    );
  }

  const productIdTo = String((prodTo as any).id);

  // 5) ID único da transferência
  // (Node: crypto.randomUUID pode existir; fallback para import("crypto"))
  let transfer_id = "";
  try {
    transfer_id = (globalThis as any)?.crypto?.randomUUID?.() ?? "";
  } catch {}
  if (!transfer_id) {
    const cryptoMod = await import("crypto");
    transfer_id = cryptoMod.randomUUID();
  }

  const nowISO = new Date().toISOString();

  // 6) 2 movimentos: OUT (origem) e IN (destino)
  const outPayload: any = {
    establishment_id: fromEstablishmentId,
    product_id: productIdFrom,
    label_id: null,
    order_id: null,
    unit_label: unitLabel,
    qty,
    direction: "OUT",
    movement_type: "transferencia",
    reason,
    notes: null,
    created_by: userId,
    created_at: nowISO,
    details: {
      transfer_id,
      from_establishment_id: fromEstablishmentId,
      to_establishment_id: toEstablishmentId,
      product_name: productName,
      unit_label: unitLabel,
      qty,
      notes: notes ?? null,
      origin_product_id: productIdFrom,
      destination_product_id: productIdTo,
    },
  };

  const inPayload: any = {
    establishment_id: toEstablishmentId,
    product_id: productIdTo,
    label_id: null,
    order_id: null,
    unit_label: unitLabel,
    qty,
    direction: "IN",
    movement_type: "transferencia",
    reason,
    notes: null,
    created_by: userId,
    created_at: nowISO,
    details: {
      transfer_id,
      from_establishment_id: fromEstablishmentId,
      to_establishment_id: toEstablishmentId,
      product_name: productName,
      unit_label: unitLabel,
      qty,
      notes: notes ?? null,
      origin_product_id: productIdFrom,
      destination_product_id: productIdTo,
    },
  };

  // OUT
  const { error: outErr } = await supabase
    .from("inventory_movements")
    .insert(outPayload);

  if (outErr) {
    console.error("Erro ao criar movimento OUT:", outErr);
    throw new Error("Falha ao registrar saída da origem.");
  }

  // IN
  const { error: inErr } = await supabase.from("inventory_movements").insert(inPayload);

  if (inErr) {
    console.error("Erro ao criar movimento IN:", inErr);

    // best-effort compensação: remove OUT recém criado (evita "sumir estoque" no app)
    try {
      await supabase
        .from("inventory_movements")
        .delete()
        .eq("establishment_id", fromEstablishmentId)
        .eq("movement_type", "transferencia")
        .eq("direction", "OUT")
        .eq("created_by", userId)
        .eq("created_at", nowISO);
    } catch {}

    throw new Error("Falha ao registrar entrada no destino.");
  }

  // Revalidar telas
  try {
    revalidatePath("/dashboard/transferencias");
    revalidatePath("/dashboard/estoque");
  } catch {}

  return { ok: true, transfer_id };
}
