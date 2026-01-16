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

/* ------------------ helpers ------------------ */
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

function Top3BarChart({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="space-y-2">
      {items.map((it, idx) => (
        <div key={it.label} className="flex items-center gap-3">
          <div className="w-6 text-xs text-muted-foreground">#{idx + 1}</div>
          <div className="w-full">
            <div className="flex items-center justify-between mb-1">
              <div className="text-sm truncate">{it.label}</div>
              <div className="text-xs font-semibold">{it.value.toFixed(0)}</div>
            </div>
            <div className="h-3 bg-slate-100 rounded overflow-hidden">
              <div
                className="h-3 bg-emerald-500"
                style={{ width: `${(it.value / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------ page ------------------ */
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

  // janela de análise
  const now = new Date();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  const fourteenDaysAgo = new Date(now);
  fourteenDaysAgo.setDate(now.getDate() - 14);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // ---------- fetch raw data ----------
  // 1) Orders (7 dias)
  const { data: ordersData, error: ordersErr } = await supabase
    .from("orders")
    .select("id, status, created_at")
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false });
  if (ordersErr) throw new Error(ordersErr.message);
  const safeOrders = ordersData ?? [];

  // 2) Order timeline events (7 dias)
  const { data: eventsData, error: eventsErr } = await supabase
    .from("order_status_events")
    .select("id, order_id, from_status, to_status, created_at, created_by, action")
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: true });
  if (eventsErr) throw new Error(eventsErr.message);
  const safeEvents = eventsData ?? [];

  // 3) order_line_items para forecast (últimos 14 dias)
  const { data: orderItems14, error: orderItemsErr } = await supabase
    .from("order_line_items")
    .select("id, order_id, product_id, quantity, created_at")
    .eq("establishment_id", establishmentId)
    .gte("created_at", fourteenDaysAgo.toISOString())
    .order("created_at", { ascending: false });
  if (orderItemsErr) throw new Error(orderItemsErr.message);
  const orderItems = orderItems14 ?? [];

  // 4) order_line_items (30 dias) -> para mapear production_productivity
  const { data: orderLine30Rows, error: orderLine30Err } = await supabase
    .from("order_line_items")
    .select("id, product_id, created_at")
    .eq("establishment_id", establishmentId)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: false });
  if (orderLine30Err) throw new Error(orderLine30Err.message);
  const orderLine30 = orderLine30Rows ?? [];
  const orderLineIds = orderLine30.map((r: any) => r.id).filter(Boolean);

  // 5) production_productivity: **não** filtramos por establishment_id (alguns esquemas não têm essa coluna).
  //    Em vez disso, filtramos por order_item_id (obtidos acima). Se não houver orderLineIds, pulamos.
  let productionRows: any[] = [];
  if (orderLineIds.length > 0) {
    const { data: prodRows, error: prodRowsErr } = await supabase
      .from("production_productivity")
      .select(
        "id, order_item_id, collaborator_id, product_id, qty_produced, unit_label, started_at, finished_at, duration_minutes, created_at"
      )
      .in("order_item_id", orderLineIds)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false });

    if (prodRowsErr) throw new Error(prodRowsErr.message);
    productionRows = prodRows ?? [];
  } else {
    productionRows = [];
  }

  // 6) losses (7 dias) para refugo
  const { data: lossesRows, error: lossesErr } = await supabase
    .from("losses")
    .select("id, user_id, product_id, qty, created_at")
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString());
  if (lossesErr) throw new Error(lossesErr.message);
  const losses = lossesRows ?? [];

  // ---------- Basic KPIs (orders/events) ----------
  const totalPedidos = safeOrders.length;
  const entregues = safeOrders.filter((o) => o.status === "entregue").length;
  const cancelados = safeOrders.filter((o) => o.status === "cancelado").length;
  const ativos = safeOrders.filter((o) => !["entregue", "cancelado"].includes(o.status)).length;

  const porStatus: Record<string, number> = {};
  for (const o of safeOrders) porStatus[o.status] = (porStatus[o.status] ?? 0) + 1;

  // Tempo médio: pedido criado -> entregue ; aceito -> em_separacao
  type OrderTime = { createdAt: Date; deliveredAt?: Date; acceptedAt?: Date; separatedAt?: Date };
  const timesByOrder = new Map<string, OrderTime>();
  for (const o of safeOrders) timesByOrder.set(o.id, { createdAt: new Date(o.created_at) });
  for (const ev of safeEvents) {
    const entry = timesByOrder.get(ev.order_id);
    if (!entry) continue;
    if (ev.to_status === "entregue" && !entry.deliveredAt) entry.deliveredAt = new Date(ev.created_at);
    if (ev.to_status === "aceitou_pedido" && !entry.acceptedAt) entry.acceptedAt = new Date(ev.created_at);
    if (ev.to_status === "em_separacao" && !entry.separatedAt) entry.separatedAt = new Date(ev.created_at);
  }

  let somaMinutos = 0, qtdComTempo = 0, somaMinutosProd = 0, qtdComTempoProd = 0;
  for (const [, t] of timesByOrder) {
    if (t.deliveredAt) {
      const diffMin = (t.deliveredAt.getTime() - t.createdAt.getTime()) / (1000 * 60);
      if (diffMin > 0) { somaMinutos += diffMin; qtdComTempo++; }
    }
    if (t.acceptedAt && t.separatedAt) {
      const diffMin = (t.separatedAt.getTime() - t.acceptedAt.getTime()) / (1000 * 60);
      if (diffMin > 0) { somaMinutosProd += diffMin; qtdComTempoProd++; }
    }
  }
  const tempoMedioEntregaMin = qtdComTempo > 0 ? somaMinutos / qtdComTempo : undefined;
  const tempoMedioProducaoMin = qtdComTempoProd > 0 ? somaMinutosProd / qtdComTempoProd : undefined;

  // ---------- Ranking colaboradores (agregação client-side) ----------
  const collMap: Record<string, { total_qty: number; total_minutes: number }> = {};
  for (const r of productionRows) {
    const id = r.collaborator_id ?? "unknown";
    if (!collMap[id]) collMap[id] = { total_qty: 0, total_minutes: 0 };
    collMap[id].total_qty += Number(r.qty_produced ?? 0);
    // prefere duration_minutes, senão calcula a partir de timestamps
    const dur =
      r.duration_minutes ??
      (r.started_at && r.finished_at ? ((new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()) / 60000) : 0);
    collMap[id].total_minutes += Number(dur ?? 0);
  }

  const collStats = Object.entries(collMap)
    .map(([collaborator_id, v]) => ({ collaborator_id, total_qty: v.total_qty, total_minutes: v.total_minutes }))
    .sort((a, b) => b.total_qty - a.total_qty);

  const collaboratorIds = collStats.map((c) => c.collaborator_id).filter(Boolean);
  let profileMap: Record<string, { full_name?: string; sector?: string }> = {};
  if (collaboratorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, sector")
      .in("id", collaboratorIds);
    (profiles ?? []).forEach((p: any) => { profileMap[p.id] = { full_name: p.full_name, sector: p.sector }; });
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

  const top3 = rankingUsuarios.slice(0, 3);
  const maxTopQty = Math.max(...top3.map((t) => t.qty), 1);

  // ---------- Produtos mais produzidos (agreg client-side) ----------
  const prodMap: Record<string, number> = {};
  for (const r of productionRows) {
    const pid = r.product_id;
    if (!pid) continue;
    prodMap[pid] = (prodMap[pid] ?? 0) + Number(r.qty_produced ?? 0);
  }
  const prodStatsArray = Object.entries(prodMap)
    .map(([product_id, total_qty]) => ({ product_id, total_qty }))
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 10);

  // ---------- carregar dados de products (necessários) ----------
  const productsNeeded = new Set<string>();
  prodStatsArray.forEach((p) => p.product_id && productsNeeded.add(p.product_id));
  (orderItems ?? []).forEach((oi) => oi.product_id && productsNeeded.add(oi.product_id));
  orderLine30.forEach((l) => l.product_id && productsNeeded.add(l.product_id));
  const productIdsArr = Array.from(productsNeeded).filter(Boolean);

  let productsMap: Record<string, any> = {};
  if (productIdsArr.length > 0) {
    const { data: products } = await supabase
      .from("products")
      .select("id, name, default_unit_label, price, standard_cost")
      .in("id", productIdsArr);
    (products ?? []).forEach((p: any) => { productsMap[p.id] = p; });
  }

  const productsMostProduced = prodStatsArray.map((r: any) => ({
    product_id: r.product_id,
    total_qty: Number(r.total_qty ?? 0),
    product: productsMap[r.product_id] ?? null,
    value_total: (productsMap[r.product_id]?.price ?? 0) * Number(r.total_qty ?? 0),
  }));

  // ---------- Forecast 2 semanas (média diária últimos 14 dias) ----------
  const salesMap: Record<string, number> = {};
  for (const s of orderItems) {
    const pid = s.product_id;
    if (!pid) continue;
    salesMap[pid] = (salesMap[pid] ?? 0) + Number(s.quantity ?? 0);
  }

  const forecasts: Array<{ product_id: string; avg_daily: number; forecast_14: number; product?: any }> = [];
  const allProductIds = Array.from(new Set([...Object.keys(productsMap), ...Object.keys(salesMap)])).slice(0, 200);
  for (const pid of allProductIds) {
    const qtyLast14 = Number(salesMap[pid] ?? 0);
    const avgDaily = qtyLast14 / 14;
    forecasts.push({
      product_id: pid,
      avg_daily: Math.round(avgDaily * 100) / 100,
      forecast_14: Math.round(avgDaily * 14 * 100) / 100,
      product: productsMap[pid] ?? null,
    });
  }
  forecasts.sort((a, b) => b.forecast_14 - a.forecast_14);

  // ---------- Top by value ----------
  const topByValue = Object.entries(prodMap).map(([product_id, qty]) => {
    const p = productsMap[product_id];
    return {
      product_id,
      qty,
      product: p ?? null,
      value_total: (p?.price ?? 0) * Number(qty ?? 0),
    };
  }).sort((a, b) => b.qty - a.qty).slice(0, 10);

  // ---------- Produção por setor ----------
  const productionBySectorMap: Record<string, { qty_produced: number; value_br: number; hours_active: number }> = {};
  for (const r of productionRows) {
    const cid = r.collaborator_id ?? "unknown";
    const sector = profileMap[cid]?.sector ?? "(sem setor)";
    const qty = Number(r.qty_produced ?? 0);
    const p = productsMap[r.product_id];
    const value = qty * (p?.standard_cost ?? 0);
    const hours = Number(r.duration_minutes ?? 0) / 60;
    if (!productionBySectorMap[sector]) productionBySectorMap[sector] = { qty_produced: 0, value_br: 0, hours_active: 0 };
    productionBySectorMap[sector].qty_produced += qty;
    productionBySectorMap[sector].value_br += value;
    productionBySectorMap[sector].hours_active += hours;
  }
  const productionBySector = Object.entries(productionBySectorMap).map(([sector, v]) => ({
    sector, qty_produced: v.qty_produced, value_br: v.value_br, hours_active: v.hours_active,
  })).sort((a, b) => b.qty_produced - a.qty_produced);

  // ---------- Refugo por setor ----------
  const refugoMap: Record<string, { qty_refugo: number; value_br: number }> = {};
  for (const l of losses) {
    const userSector = profileMap[l.user_id ?? ""]?.sector ?? "(sem setor)";
    const qty = Number(l.qty ?? 0);
    const prod = productsMap[l.product_id];
    const value = qty * (prod?.standard_cost ?? 0);
    if (!refugoMap[userSector]) refugoMap[userSector] = { qty_refugo: 0, value_br: 0 };
    refugoMap[userSector].qty_refugo += qty;
    refugoMap[userSector].value_br += value;
  }
  const refugoBySectorList = Object.entries(refugoMap).map(([sector, v]) => ({ sector, qty_refugo: v.qty_refugo, value_br: v.value_br }))
    .sort((a, b) => b.qty_refugo - a.qty_refugo);

  // ---------- produtos produzidos por setor (lista) ----------
  const producedBySectorProductRaw: Record<string, Record<string, number>> = {};
  for (const r of productionRows) {
    const cid = r.collaborator_id ?? "unknown";
    const sector = profileMap[cid]?.sector ?? "(sem setor)";
    const pid = r.product_id ?? "(sem produto)";
    if (!producedBySectorProductRaw[sector]) producedBySectorProductRaw[sector] = {};
    producedBySectorProductRaw[sector][pid] = (producedBySectorProductRaw[sector][pid] ?? 0) + Number(r.qty_produced ?? 0);
  }
  const producedBySectorProduct: any[] = [];
  for (const sector of Object.keys(producedBySectorProductRaw)) {
    for (const pid of Object.keys(producedBySectorProductRaw[sector])) {
      producedBySectorProduct.push({
        sector,
        product_id: pid,
        name: productsMap[pid]?.name ?? pid,
        qty_produced: producedBySectorProductRaw[sector][pid],
        value_br: producedBySectorProductRaw[sector][pid] * (productsMap[pid]?.standard_cost ?? 0)
      });
    }
  }

  // ---------- render ----------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold">Produtividade</h1>
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

      {/* Top-3 e ranking */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Top 3 Colaboradores (quantidade produzida)</CardTitle>
            <CardDescription>Visual rápido dos 3 melhores</CardDescription>
          </CardHeader>
          <CardContent>
            {top3.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhum dado de produção.</div>
            ) : (
              <div className="space-y-3">
                <Top3BarChart items={top3.map(u => ({ label: `${u.name} • ${u.sector}`, value: u.qty }))} />
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
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ranking (Top 20)</CardTitle>
            <CardDescription>Usuários por quantidade produzida (últimos 30 dias)</CardDescription>
          </CardHeader>
          <CardContent>
            {rankingUsuarios.slice(0, 20).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum registro.</p>
            ) : (
              <div className="space-y-2">
                {rankingUsuarios.slice(0, 20).map((r, idx) => (
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

      {/* Produtos / Forecast / Produção por setor / Refugo */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Produtos mais produzidos (últimos 30 dias)</CardTitle>
            <CardDescription>Quantidade e valor estimado</CardDescription>
          </CardHeader>
          <CardContent>
            {productsMostProduced.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum dado.</p>
            ) : (
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
            {forecasts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados para previsão.</p>
            ) : (
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Produção por setor</CardTitle></CardHeader>
          <CardContent>
            {productionBySector.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum dado.</p> : (
              productionBySector.map((s) => (
                <div key={s.sector} className="flex items-center justify-between border p-2 rounded mb-2">
                  <div>
                    <div className="font-medium">{s.sector}</div>
                    <div className="text-xs text-muted-foreground">{Number(s.qty_produced).toFixed(2)} UN</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">R$ {Number(s.value_br).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{Number(s.hours_active).toFixed(2)} h</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Refugo por setor</CardTitle></CardHeader>
          <CardContent>
            {refugoBySectorList.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum refugo registrado no período.</p> : (
              refugoBySectorList.map((r) => (
                <div key={r.sector} className="flex items-center justify-between border p-2 rounded mb-2">
                  <div>
                    <div className="font-medium">{r.sector}</div>
                    <div className="text-xs text-muted-foreground">{Number(r.qty_refugo).toFixed(2)} UN</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">R$ {Number(r.value_br).toFixed(2)}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Observações */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Produtos por giro (14d)</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc pl-4">
              {Object.entries(salesMap).slice(0, 20).map(([pid, qty]) => (
                <li key={pid} className="py-1 flex justify-between">
                  <div>{productsMap[pid]?.name ?? pid}</div>
                  <div className="text-xs text-muted-foreground">{Number(qty).toFixed(0)}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Produtos sazonais</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Sazonalidade simples baseada em 8 semanas (média comparativa). Para análise avançada, usar série temporal.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
