"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

/**
 * Entrada vinda do RESUMO do inventário
 * (produto, unidade e total contado).
 */
export type InventoryResumoInput = {
  produto: string;
  unidade: string;
  totalQtd: number;
};

/**
 * Retorno por item processado
 */
export type InventoryApplyResultItem = {
  produto: string;
  unidade: string;
  counted: number;   // quantidade contada
  current: number;   // quantidade no sistema (antes)
  diff: number;      // diferença (counted - current)
  productId?: string | null;
  status: "ok" | "warning" | "not_found";
  errorMessage?: string;
};

/**
 * Retorno final da action
 */
export type InventoryApplyResult = {
  ok: boolean;
  inventoryCountId?: string;
  items: InventoryApplyResultItem[];
};

/**
 * ==================================================================================
 * 📌  ACTION PRINCIPAL: aplicarInventario
 * ==================================================================================
 *
 * FLUXO:
 * 1. Cria cabeçalho: `inventory_counts`
 * 2. Para cada item do resumo:
 *    - Valida nome/produto/unidade
 *    - Busca product_id na tabela products
 *    - Lê estoque atual na view inventory_current_stock
 *    - Calcula diff (contado - atual)
 *    - Insere item em inventory_count_items
 *    - Se diff != 0 → insere ajuste em inventory_movements
 * 3. Revalida páginas que exibem estoque
 * 4. Retorna relatório por item para a UI mostrar resultado
 */
export async function aplicarInventario(
  resumo: InventoryResumoInput[]
): Promise<InventoryApplyResult> {

  // 🛑 Entrada inválida
  if (!Array.isArray(resumo) || resumo.length === 0) {
    return { ok: false, items: [] };
  }

  // 🔐 Contexto do usuário
  const { membership, user } = await getActiveMembershipOrRedirect();
  const establishmentId = membership.establishment_id;
  const userId = user.id;
  const supabase = await createSupabaseServerClient();

  const nowISO = new Date().toISOString();

  // 📌 1) Cabeçalho do inventário
  const { data: countInsert, error: countError } = await supabase
    .from("inventory_counts")
    .insert({
      establishment_id: establishmentId,
      started_at: nowISO,
      ended_at: nowISO,
      created_by: userId,
      notes: "Inventário aplicado automaticamente pelo sistema.",
    })
    .select("id")
    .single();

  if (countError || !countInsert) {
    console.error("Erro ao criar inventory_counts:", countError);
    throw new Error("❌ Falha ao criar cabeçalho de inventário.");
  }

  const inventoryCountId = countInsert.id;
  const resultItems: InventoryApplyResultItem[] = [];

  // 📌 2) Processa cada item
  for (const item of resumo) {
    const produto = item.produto?.trim();
    const unidade = item.unidade?.trim();
    const counted = Number(item.totalQtd ?? 0);

    // ❌ Valida entrada
    if (!produto || !unidade || counted < 0) {
      resultItems.push({
        produto: produto || "",
        unidade: unidade || "",
        counted,
        current: 0,
        diff: 0,
        status: "not_found",
        errorMessage:
          "Entrada inválida: produto/unidade ausente ou quantidade negativa.",
      });
      continue;
    }

    // 🔎 Busca produto
    const { data: productRow, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("name", produto)
      .maybeSingle();

    if (productError) {
      console.error("Erro ao buscar produto:", produto, productError);
    }

    // ❌ Produto não encontrado
    if (!productRow?.id) {
      resultItems.push({
        produto,
        unidade,
        counted,
        current: 0,
        diff: 0,
        status: "not_found",
        errorMessage: "Produto não encontrado na tabela products.",
      });
      continue;
    }

    const productId = productRow.id as string;

    // 📊 Consulta estoque atual na VIEW
    const { data: stockRow, error: stockError } = await supabase
      .from("inventory_current_stock")
      .select("current_stock")
      .eq("establishment_id", establishmentId)
      .eq("product_id", productId)
      .eq("unit_label", unidade)
      .maybeSingle();

    if (stockError) {
      console.error("Erro ao buscar current_stock:", stockError);
    }

    const currentStock = Number(stockRow?.current_stock ?? 0);
    const diff = counted - currentStock;

    // 📌 2.3 Salva histórico do item no inventário
    const { error: itemError } = await supabase
      .from("inventory_count_items")
      .insert({
        inventory_count_id: inventoryCountId,
        product_id: productId,
        unit_label: unidade,
        counted_qty: counted,
        current_stock_before: currentStock,
        diff_qty: diff,
      });

    if (itemError) {
      console.error("Erro ao inserir item:", itemError);
      resultItems.push({
        produto,
        unidade,
        counted,
        current: currentStock,
        diff,
        productId,
        status: "warning",
        errorMessage: "Item salvo, mas falhou ao registrar no histórico.",
      });
      continue;
    }

    // ⚠️ Nenhuma diferença → OK, mas não gera movimento
    if (diff === 0) {
      resultItems.push({
        produto,
        unidade,
        counted,
        current: currentStock,
        diff,
        productId,
        status: "ok",
      });
      continue;
    }

    // 🔄 Se houver diferença → AJUSTE
    const direction = diff > 0 ? "IN" : "OUT";
    const absQty = Math.abs(diff);

    const { error: moveError } = await supabase
      .from("inventory_movements")
      .insert({
        establishment_id: establishmentId,
        product_id: productId,
        unit_label: unidade,
        qty: absQty,
        direction,
        movement_type: "ajuste_inventario",
        reason: diff > 0 ? "AJUSTE_PARA_MAIS" : "AJUSTE_PARA_MENOS",
        inventory_count_id: inventoryCountId,
        related_order_id: null,
        created_by: userId,
        details: {
          system_before: currentStock,
          counted,
          difference: diff,
        },
      });

    if (moveError) {
      console.error("Erro ao criar movimento de ajuste:", moveError);
      resultItems.push({
        produto,
        unidade,
        counted,
        current: currentStock,
        diff,
        productId,
        status: "warning",
        errorMessage:
          "Item salvo, mas falhou ao criar movimento de ajuste de estoque.",
      });
      continue;
    }

    // 🎉 Sucesso total
    resultItems.push({
      produto,
      unidade,
      counted,
      current: currentStock,
      diff,
      productId,
      status: "ok",
    });
  }

  // 📌 3) Revalidar telas importantes
  try {
    revalidatePath("/dashboard/estoque");
    revalidatePath("/dashboard/producao");
    revalidatePath("/dashboard/inventario");
  } catch {
    console.warn("⚠️ Não foi possível revalidar todas as rotas.");
  }

  // 📌 4) Retorno final
  return {
    ok: true,
    inventoryCountId,
    items: resultItems,
  };
}
