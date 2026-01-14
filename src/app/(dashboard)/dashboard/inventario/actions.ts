"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import ExcelJS from "exceljs";

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
  counted: number; // quantidade contada
  current: number; // quantidade no sistema (antes)
  diff: number; // diferença (counted - current)
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
 */
export async function aplicarInventario(
  resumo: InventoryResumoInput[]
): Promise<InventoryApplyResult> {
  if (!Array.isArray(resumo) || resumo.length === 0) {
    return { ok: false, items: [] };
  }

  const { membership, user } = await getActiveMembershipOrRedirect();
  const establishmentId = membership.establishment_id;
  const userId = user.id;
  const supabase = await createSupabaseServerClient();

  const startedAt = new Date().toISOString();

  // 1) Cabeçalho do inventário
  const { data: countInsert, error: countError } = await supabase
    .from("inventory_counts")
    .insert({
      establishment_id: establishmentId,
      started_at: startedAt,
      created_by: userId,
      notes: "Inventário aplicado automaticamente pelo sistema.",
    })
    .select("id")
    .single();

  if (countError || !countInsert) {
    console.error("Erro ao criar inventory_counts:", countError);
    throw new Error("❌ Falha ao criar cabeçalho de inventário.");
  }

  const inventoryCountId = countInsert.id as string;
  const resultItems: InventoryApplyResultItem[] = [];

  // 2) Processa cada item do resumo
  for (const item of resumo) {
    const produto = item.produto?.trim();
    const unidade = item.unidade?.trim();
    const counted = Number(item.totalQtd ?? 0);

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

    // 2.1 – Produto
    const { data: productRow, error: productError } = await supabase
      .from("products")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("name", produto)
      .maybeSingle();

    if (productError) {
      console.error("Erro ao buscar produto:", produto, productError);
    }

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

    // 2.2 – Estoque atual (VIEW current_stock)
    const { data: stockRow, error: stockError } = await supabase
      .from("current_stock")
      .select("qty_balance")
      .eq("establishment_id", establishmentId)
      .eq("product_id", productId)
      .eq("unit_label", unidade)
      .maybeSingle();

    if (stockError) {
      console.error("Erro ao buscar current_stock:", stockError);
    }

    const currentStock = Number(stockRow?.current_stock ?? 0);
    const diff = counted - currentStock;

    // 2.3 – Item no histórico do inventário
    // ATENÇÃO: tabela inventory_count_items NÃO tem product_name / status / error_message
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
      console.error("Erro ao inserir item de inventário:", itemError);
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

    // Se não há diferença, não gera movimento
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

    // 2.4 – Movimento de ajuste (tabela inventory_movements)
    const direction = diff > 0 ? "IN" : "OUT";
    const absQty = Math.abs(diff);

    const { error: moveError } = await supabase
      .from("inventory_movements")
      .insert({
        establishment_id: establishmentId,
        product_id: productId,
        label_id: null,
        order_id: null, // coluna correta no schema
        unit_label: unidade,
        qty: absQty,
        direction,
        movement_type: "ajuste_inventario",
        reason: diff > 0 ? "AJUSTE_PARA_MAIS" : "AJUSTE_PARA_MENOS",
        inventory_count_id: inventoryCountId,
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

  // 2.5 – atualiza resumo no cabeçalho
  const finishedAt = new Date().toISOString();
  const totalItems = resultItems.length;
  const produtosDistintos = new Set(
    resultItems.map((it) => `${it.produto}__${it.unidade}`)
  ).size;

  const { error: headerUpdateError } = await supabase
    .from("inventory_counts")
    .update({
      finished_at: finishedAt,
      total_items: totalItems,
      total_products: produtosDistintos,
    })
    .eq("id", inventoryCountId);

  if (headerUpdateError) {
    console.error(
      "Erro ao atualizar totais em inventory_counts:",
      headerUpdateError
    );
  }

  // 3) Revalidar rotas
  try {
    revalidatePath("/dashboard/estoque");
    revalidatePath("/dashboard/producao");
    revalidatePath("/dashboard/inventario");
    revalidatePath("/dashboard/inventario/historico");
  } catch {
    console.warn("⚠️ Não foi possível revalidar todas as rotas.");
  }

  return {
    ok: true,
    inventoryCountId,
    items: resultItems,
  };
}

/* =============================================================================
 * 📊 RELATÓRIO DE CONCILIAÇÃO / DASHBOARD + EXPORTAÇÃO XLSX
 * =============================================================================
 */

export type InventoryReportRow = {
  item_id: string;
  product_name: string;
  unit_label: string;
  counted_quantity: number;
  system_stock: number;
  difference: number;
  status: "OK" | "DIVERGENTE";
};

export async function getInventoryReport(): Promise<InventoryReportRow[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("run_inventory_report");

  if (error) {
    console.error("Erro ao executar run_inventory_report:", error);
    return [];
  }

  return (data ?? []) as InventoryReportRow[];
}

export async function exportInventarioXLSX(): Promise<string> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase.rpc("run_inventory_report");

  if (error) {
    console.error("Erro ao executar run_inventory_report:", error);
    throw new Error("Erro ao gerar relatório de inventário para XLSX.");
  }

  const rows = (data ?? []) as InventoryReportRow[];

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Inventário");

  sheet.columns = [
    { header: "Produto", key: "product_name", width: 32 },
    { header: "Unidade", key: "unit_label", width: 10 },
    { header: "Quantidade Contada", key: "counted_quantity", width: 22 },
    { header: "Estoque Sistema", key: "system_stock", width: 18 },
    { header: "Diferença", key: "difference", width: 12 },
    { header: "Status", key: "status", width: 15 },
  ];

  rows.forEach((row) => {
    sheet.addRow(row);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  return base64;
}
