// src/app/(dashboard)/dashboard/produtividade/page.tsx
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatDate(date: string | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}
function formatMinutes(min: number | null | undefined) {
  if (!min || min <= 0) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  const horas = Math.floor(min / 60);
  const resto = Math.round(min % 60);
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

export default async function ProdutividadePage() {
  const supabase = await createSupabaseServerClient();
  const membership = await getActiveMembershipOrRedirect();

  const establishmentId = membership.establishmentId ?? membership.unitId;
  if (!establishmentId) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Produtividade</h1>
        <p className="text-sm text-muted-foreground">
          Membership sem establishmentId/unitId. Verifique sua tabela de
          memberships.
        </p>
      </div>
    );
  }

  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(now.getDate() - 14);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // 1) Pedidos do estabelecimento (7 dias) - mantém seu cálculo
  const { data: ordersData } = await supabase
    .from("orders")
    .select("id, status, created_at")
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false });
  const safeOrders = ordersData ?? [];

  // 2) Eventos (timeline)
  const { data: eventsData } = await supabase
    .from("order_status_events")
    .select("id, order_id, from_status, to_status, created_at, created_by, action")
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: true });
  const safeEvents = eventsData ?? [];

  // ====== Basic metrics (kept from original) ======
  const totalPedidos = safeOrders.length;
  const entregues = safeOrders.filter((o) => o.status === "entregue").length;
  const cancelados = safeOrders.filter((o) => o.status === "cancelado").length;
  const ativos = safeOrders.filter(
    (o) => !["entregue", "cancelado"].includes(o.status)
  ).length;

  const porStatus: Record<string, number> = {};
  for (const o of safeOrders) {
    porStatus[o.status] = (porStatus[o.status] ?? 0) + 1;
  }

  // Tempo médio (pedido criado -> entregue) e médio produção (aceito -> em_separacao)
  type OrderTime = { createdAt: Date; deliveredAt?: Date; acceptedAt?: Date; separatedAt?: Date };
  const timesByOrder = new Map<string, OrderTime>();
  for (const o of safeOrders) {
    timesByOrder.set(o.id, {
      createdAt: new Date(o.created_at),
    });
  }
  for (const ev of safeEvents) {
    const entry = timesByOrder.get(ev.order_id);
    if (!entry) continue;
    if (ev.to_status === "entregue" && !entry.deliveredAt) {
      entry.deliveredAt = new Date(ev.created_at);
    }
    if (ev.to_status === "aceitou_pedido" && !entry.acceptedAt) {
      entry.acceptedAt = new Date(ev.created_at);
    }
    if (ev.to_status === "em_separacao" && !entry.separatedAt) {
      entry.separatedAt = new Date(ev.created_at);
    }
  }

  let somaMinutos = 0, qtdComTempo = 0;
  for (const [, t] of timesByOrder) {
    if (t.deliveredAt) {
      const diffMin = (t.deliveredAt.getTime() - t.createdAt.getTime()) / (1000 * 60);
      if (diffMin > 0) { somaMinutos += diffMin; qtdComTempo++; }
    }
  }
  const tempoMedioEntregaMin = qtdComTempo > 0 ? somaMinutos / qtdComTempo : undefined;

  let somaMinutosProd = 0, qtdComTempoProd = 0;
  for (const [, t] of timesByOrder) {
    if (t.acceptedAt && t.separatedAt) {
      const diffMin = (t.separatedAt.getTime() - t.acceptedAt.getTime()) / (1000 * 60);
      if (diffMin > 0) { somaMinutosProd += diffMin; qtdComTempoProd++; }
    }
  }
  const tempoMedioProducaoMin = qtdComTempoProd > 0 ? somaMinutosProd / qtdComTempoProd : undefined;

  // ========= Ranking de colaboradores (últimos 7 dias) =========
  // Usamos production_productivity: soma qty_produced, soma duration_minutes (horas)
    // fetch raw rows for last 7 days and aggregate client-side
  const { data: collRows, error: collRowsErr } = await supabase
    .from("production_productivity")
    .select("collaborator_id, qty_produced, duration_minutes, created_at")
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString());

  if (collRowsErr) {
    throw new Error(collRowsErr.message);
  }

  const collMap: Record<string, { total_qty: number; total_minutes: number }> = {};
  (collRows ?? []).forEach((r: any) => {
    const id = r.collaborator_id ?? "unknown";
    if (!collMap[id]) collMap[id] = { total_qty: 0, total_minutes: 0 };
    collMap[id].total_qty += Number(r.qty_produced ?? 0);
    collMap[id].total_minutes += Number(r.duration_minutes ?? 0);
  });

  const collStats = Object.entries(collMap).map(([collaborator_id, v]) => ({
    collaborator_id,
    total_qty: v.total_qty,
    total_minutes: v.total_minutes,
  })).sort((a, b) => b.total_qty - a.total_qty);


  const collaboratorIds = collStats.map((c) => c.collaborator_id).filter(Boolean);
  let profileMap: Record<string, { full_name?: string; sector?: string }> = {};
  if (collaboratorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, sector")
      .in("id", collaboratorIds);
    (profiles ?? []).forEach((p: any) => {
      profileMap[p.id] = { full_name: p.full_name, sector: p.sector };
    });
  }

  const rankingUsuarios = collStats
    .map((c) => ({
      id: c.collaborator_id,
      name: profileMap[c.collaborator_id]?.full_name ?? c.collaborator_id,
      sector: profileMap[c.collaborator_id]?.sector ?? "-",
      qty: c.total_qty,
      minutes: c.total_minutes,
      hours: Math.round((c.total_minutes / 60) * 10) / 10,
    }))
    .sort((a, b) => b.qty - a.qty);

  // Top-3 (para o gráfico)
  const top3 = rankingUsuarios.slice(0, 3);
  const maxTopQty = Math.max(...top3.map((t) => t.qty), 1);

  // ========= Produtos mais produzidos (7 dias) =========
    const { data: prodRows, error: prodRowsErr } = await supabase
    .from("production_productivity")
    .select("product_id, qty_produced, created_at")
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString());

  if (prodRowsErr) {
    throw new Error(prodRowsErr.message);
  }

  const prodMap: Record<string, number> = {};
  (prodRows ?? []).forEach((r: any) => {
    const pid = r.product_id;
    if (!pid) return;
    prodMap[pid] = (prodMap[pid] ?? 0) + Number(r.qty_produced ?? 0);
  });

  const prodStatsArray = Object.entries(prodMap)
    .map(([product_id, total_qty]) => ({ product_id, total_qty }))
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 10);


  const productIds = (prodStatsRaw ?? []).map((p: any) => p.product_id).filter(Boolean);
  let productsMap: Record<string, any> = {};
  if (productIds.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, default_unit_label, price")
      .in("id", productIds);
    (products ?? []).forEach((p: any) => {
      productsMap[p.id] = p;
    });
  }
    const productsMostProduced = prodStatsArray.map((r: any) => ({
    product_id: r.product_id,
    total_qty: Number(r.total_qty ?? 0),
    product: productsMap[r.product_id] ?? null,
    value_total: (productsMap[r.product_id]?.price ?? 0) * Number(r.total_qty ?? 0),
  }));


  // ========= Forecast de 2 semanas (média diária últimos 14 dias * 14) =========
  // Usamos order_items para estimar saída (se existir). Se não houver, fallback para production_productivity.
  // Order_items usually: order_items has qty and product_id and created_at (or order -> created_at), we'll try order_items.created_at or join order.created_at.
  const { data: sales30 } = await supabase
    .from("order_items")
    .select("product_id, total_qty:sum(qty)")
    .eq("establishment_id", establishmentId)
    .gte("created_at", fourteenDaysAgo.toISOString())
    .group("product_id")
    .order("total_qty", { ascending: false });

  // build forecast array for top products
  const forecasts: Array<{ product_id: string; avg_daily: number; forecast_14: number; product?: any }> = [];
  const salesMap: Record<string, number> = {};
  (sales30 ?? []).forEach((r: any) => {
    salesMap[r.product_id] = Number(r.total_qty ?? 0);
  });

  // For each product in productsMap or in order_items, compute avg daily:
  const allProductIds = Array.from(new Set([...Object.keys(productsMap), ...Object.keys(salesMap)])).slice(0, 200);
  if (allProductIds.length > 0) {
    // fetch product data if missing
    const missing = allProductIds.filter((id) => !productsMap[id]);
    if (missing.length > 0) {
      const { data: moreProducts } = await supabase
        .from("products")
        .select("id, name, default_unit_label, price")
        .in("id", missing);
      (moreProducts ?? []).forEach((p: any) => (productsMap[p.id] = p));
    }

    for (const pid of allProductIds) {
      const qtyLast14 = salesMap[pid] ?? 0;
      const avgDaily = qtyLast14 / 14;
      forecasts.push({
        product_id: pid,
        avg_daily: Math.round(avgDaily * 100) / 100,
        forecast_14: Math.round(avgDaily * 14 * 100) / 100,
        product: productsMap[pid] ?? null,
      });
    }
  }

  // Sort by forecast descending
  forecasts.sort((a, b) => b.forecast_14 - a.forecast_14);

  // ========= Top products by production value (KG / R$) - use production_productivity =========
  const { data: prodValueRaw } = await supabase
    .from("production_productivity")
    .select("product_id, total_qty:sum(qty_produced)")
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .group("product_id")
    .order("total_qty", { ascending: false })
    .limit(10);

  const topByValue = (prodValueRaw ?? []).map((r: any) => {
    const p = productsMap[r.product_id];
    const qty = Number(r.total_qty ?? 0);
    return {
      product_id: r.product_id,
      qty,
      product: p ?? null,
      value_total: (p?.price ?? 0) * qty,
    };
  });

  // ======== Top users data truncated to top 20 for display =======
  const rankingTop20 = rankingUsuarios.slice(0, 20);

  // RENDER
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-gray-900">Produtividade</h1>
          <p className="text-gray-600 max-w-prose mx-auto sm:mx-0">
            Visão de desempenho — últimos 7 dias.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Papel atual: <strong>{membership.role ?? "—"}</strong> • Período:{" "}
            <strong>
              {formatDate(sevenDaysAgo.toISOString())} – {formatDate(now.toISOString())}
            </strong>
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <form
            action={async () => {
              "use server";
              revalidatePath("/dashboard/produtividade");
            }}
            className="w-full sm:w-auto"
          >
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              🔄 Atualizar
            </Button>
          </form>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Pedidos no período</CardTitle>
            <span>📊</span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold">{totalPedidos}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Somando todos os status</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Ativos</CardTitle>
            <span>⚙️</span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold">{ativos}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Em qualquer etapa</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Tempo médio até entrega</CardTitle>
            <span>⏱</span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold">{formatMinutes(tempoMedioEntregaMin)}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Baseado em {qtdComTempo} pedidos entregues</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Tempo médio de produção</CardTitle>
            <span>🏭</span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold">{formatMinutes(tempoMedioProducaoMin)}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Aceito → em_separação ({qtdComTempoProd})</p>
          </CardContent>
        </Card>
      </div>

      {/* Top-3 gráfico + ranking */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top 3 Colaboradores (quantidade produzida)</CardTitle>
            <CardDescription>Visual rápido dos 3 melhores</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {top3.length === 0 ? <div className="text-sm text-muted-foreground">Nenhum dado de produção.</div> : (
                <div className="space-y-3">
                  {top3.map((u, idx) => (
                    <div key={u.id} className="flex items-center gap-3">
                      <div className="w-10 text-xs text-muted-foreground">#{idx + 1}</div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="font-medium">{u.name}</div>
                            <div className="text-xs text-muted-foreground">{u.sector}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{u.qty}</div>
                            <div className="text-xs text-muted-foreground">{u.hours} h</div>
                          </div>
                        </div>

                        <div className="h-3 bg-slate-200 rounded mt-2 overflow-hidden">
                          <div
                            style={{ width: `${(u.qty / Math.max(maxTopQty, 1)) * 100}%` }}
                            className="h-3 bg-green-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking (Top 20)</CardTitle>
            <CardDescription>Usuários por quantidade produzida (7 dias)</CardDescription>
          </CardHeader>
          <CardContent>
            {rankingTop20.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro.</p> : (
              <div className="space-y-2">
                {rankingTop20.map((r, idx) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                      <div>
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.sector}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{r.qty}</div>
                      <div className="text-xs text-muted-foreground">{r.hours} h</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Produtos mais produzidos & Forecast */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Produtos mais produzidos (7 dias)</CardTitle>
            <CardDescription>Quantidade e valor estimado</CardDescription>
          </CardHeader>
          <CardContent>
            {productsMostProduced.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum dado.</p> : (
              <div className="space-y-2">
                {productsMostProduced.map((p) => (
                  <div key={p.product_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{p.product?.name ?? p.product_id}</div>
                      <div className="text-xs text-muted-foreground">{p.product?.default_unit_label ?? "UN"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{p.total_qty}</div>
                      <div className="text-xs text-muted-foreground">R$ {p.value_total?.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Previsão 2 semanas (média diária × 14)</CardTitle>
            <CardDescription>Produtos com maior necessidade prevista</CardDescription>
          </CardHeader>
          <CardContent>
            {forecasts.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados para previsão.</p> : (
              <div className="space-y-2">
                {forecasts.slice(0, 20).map((f) => (
                  <div key={f.product_id} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium">{f.product?.name ?? f.product_id}</div>
                      <div className="text-xs text-muted-foreground">{f.product?.default_unit_label ?? "UN"}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{f.forecast_14}</div>
                      <div className="text-xs text-muted-foreground">média diária: {f.avg_daily}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Observações */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
            <CardDescription>Como evoluir</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc pl-4 space-y-1">
              <li>Adicionar refugo (scrap) por setor: criar registro de refugo em production_productivity ou stock_movements e agregar.</li>
              <li>Melhorar forecast: usar sazonalidade e regressão (ARIMA/Prophet) ao invés de média simples.</li>
              <li>Produção real / rendimento: comparar matéria-prima usada vs produzido.</li>
              <li>Classificação giro (alto/médio/baixo): usar percentis em vendas de 30 dias.</li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados brutos</CardTitle>
            <CardDescription>Fonte: production_productivity, order_items, products, profiles</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>Se quiser, gero endpoints específicos (RPC) que retornam os relatórios já agregados para melhorar performance.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
