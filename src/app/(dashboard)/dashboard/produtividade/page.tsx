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

/* ---------- helpers ---------- */
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

/* ---------- page component ---------- */
export default async function ProdutividadePage() {
  const supabase = await createSupabaseServerClient();
  const membership = await getActiveMembershipOrRedirect();
  const establishmentId = membership.establishmentId ?? membership.unitId;
  if (!establishmentId) {
    return (
      <div>
        <h1 className="text-xl font-semibold">Produtividade</h1>
        <p className="text-sm text-muted-foreground">
          Membership sem establishmentId/unitId.
        </p>
      </div>
    );
  }

  // janela de análise (30 dias por padrão)
  const now = new Date();
  const days = 30;
  const sinceDate = new Date();
  sinceDate.setDate(now.getDate() - days);

  // função utilitária para executar SQL cru usando supabase.postgres.query
  const run = async (sql: string, params: any[] = []) => {
    // supabase.postgres.query exists in @supabase/supabase-js v2.x
    const supaAny = supabase as any;
    if (supaAny?.postgres && typeof supaAny.postgres.query === "function") {
      // The client returns an object with { error, data } or { data }
      const res = await supaAny.postgres.query({ sql, params });
      if (res?.error) throw res.error;
      // prefer res?.data, or res?.rows, or res
      if (res?.data) return res.data;
      if (res?.rows) return res.rows;
      return res;
    }

    // fallback: try rpc 'sql_run' (only if you have such RPC); otherwise error
    if (typeof supabase.rpc === "function") {
      const { data, error } = await supabase.rpc("sql_run", { sql });
      if (error) throw error;
      return data;
    }

    throw new Error("Nenhum método válido para executar SQL raw disponível no client Supabase.");
  };

  /* ------------------ SQL queries ------------------ */

  const rankingQ = `
    SELECT
      pp.collaborator_id AS id,
      COALESCE(p.full_name, pp.collaborator_id::text) as full_name,
      COALESCE(p.sector,'(sem setor)') AS sector,
      COALESCE(SUM(pp.qty_produced),0)::numeric AS qty_produced,
      COALESCE(SUM(pp.qty_produced * COALESCE(prod.standard_cost,0)),0)::numeric AS value_br,
      COALESCE(SUM(EXTRACT(epoch FROM (pp.finished_at - pp.started_at))/3600),0)::numeric AS hours_active
    FROM production_productivity pp
    LEFT JOIN profiles p ON pp.collaborator_id = p.id
    LEFT JOIN products prod ON pp.product_id = prod.id
    WHERE pp.establishment_id = $1
      AND pp.started_at >= $2
    GROUP BY pp.collaborator_id, p.full_name, p.sector
    ORDER BY qty_produced DESC NULLS LAST;
  `;

  const topProductsQ = `
    SELECT
      pp.product_id,
      prod.name,
      COALESCE(SUM(pp.qty_produced),0)::numeric AS qty_produced,
      COALESCE(SUM(pp.qty_produced * COALESCE(prod.standard_cost,0)),0)::numeric AS value_br
    FROM production_productivity pp
    LEFT JOIN products prod ON pp.product_id = prod.id
    WHERE pp.establishment_id = $1
      AND pp.started_at >= $2
    GROUP BY pp.product_id, prod.name
    ORDER BY qty_produced DESC
    LIMIT 20;
  `;

  const productionBySectorQ = `
    SELECT
      COALESCE(p.sector,'(sem setor)') AS sector,
      COALESCE(SUM(pp.qty_produced),0)::numeric AS qty_produced,
      COALESCE(SUM(pp.qty_produced * COALESCE(prod.standard_cost,0)),0)::numeric AS value_br,
      COALESCE(SUM(EXTRACT(epoch FROM (pp.finished_at - pp.started_at))/3600),0)::numeric AS hours_active
    FROM production_productivity pp
    LEFT JOIN profiles p ON pp.collaborator_id = p.id
    LEFT JOIN products prod ON pp.product_id = prod.id
    WHERE pp.establishment_id = $1
      AND pp.started_at >= $2
    GROUP BY COALESCE(p.sector,'(sem setor)')
    ORDER BY qty_produced DESC;
  `;

  const refugoBySectorQ = `
    SELECT
      COALESCE(pr.sector,'(sem setor)') AS sector,
      COALESCE(SUM(l.qty),0)::numeric AS qty_refugo,
      COALESCE(SUM(l.qty * COALESCE(prod.standard_cost,0)),0)::numeric AS value_br
    FROM losses l
    LEFT JOIN profiles pr ON l.user_id = pr.id
    LEFT JOIN products prod ON l.product_id = prod.id
    WHERE l.establishment_id = $1
      AND l.created_at >= $2
    GROUP BY COALESCE(pr.sector,'(sem setor)')
    ORDER BY qty_refugo DESC;
  `;

  const producedBySectorProductQ = `
    SELECT
      COALESCE(pr.sector,'(sem setor)') AS sector,
      prod.id as product_id,
      prod.name,
      COALESCE(SUM(pp.qty_produced),0)::numeric AS qty_produced,
      COALESCE(SUM(pp.qty_produced * COALESCE(prod.standard_cost,0)),0)::numeric AS value_br
    FROM production_productivity pp
    LEFT JOIN profiles pr ON pp.collaborator_id = pr.id
    LEFT JOIN products prod ON pp.product_id = prod.id
    WHERE pp.establishment_id = $1
      AND pp.started_at >= $2
    GROUP BY COALESCE(pr.sector,'(sem setor)'), prod.id, prod.name
    ORDER BY sector, qty_produced DESC
    LIMIT 200;
  `;

  const productSales14DaysQ = `
    SELECT oli.product_id, prod.name,
      SUM(oli.quantity)::numeric AS qty_sold_14d,
      COALESCE(SUM(oli.quantity * COALESCE(prod.standard_cost,0)),0)::numeric as value_br
    FROM order_line_items oli
    JOIN orders o ON oli.order_id = o.id
    LEFT JOIN products prod ON oli.product_id = prod.id
    WHERE o.establishment_id = $1
      AND o.created_at >= NOW() - INTERVAL '14 days'
    GROUP BY oli.product_id, prod.name
    ORDER BY qty_sold_14d DESC;
  `;

  const seasonalityQ = `
    WITH daily AS (
      SELECT oli.product_id,
        date_trunc('day', o.created_at) AS day,
        SUM(oli.quantity) AS sold
      FROM order_line_items oli
      JOIN orders o ON oli.order_id = o.id
      WHERE o.establishment_id = $1
        AND o.created_at >= NOW() - INTERVAL '8 weeks'
      GROUP BY oli.product_id, date_trunc('day', o.created_at)
    ),
    recent AS (
      SELECT product_id, AVG(sold)::numeric AS avg_recent
      FROM daily WHERE day >= (date_trunc('day', NOW()) - INTERVAL '28 days')
      GROUP BY product_id
    ),
    prev AS (
      SELECT product_id, AVG(sold)::numeric AS avg_prev
      FROM daily WHERE day < (date_trunc('day', NOW()) - INTERVAL '28 days')
      GROUP BY product_id
    )
    SELECT
      COALESCE(r.product_id, p.product_id) as product_id,
      prod.name,
      COALESCE(r.avg_recent,0) AS avg_recent,
      COALESCE(p.avg_prev,0) AS avg_prev,
      CASE WHEN COALESCE(p.avg_prev,0) = 0 THEN NULL
           ELSE ROUND( (COALESCE(r.avg_recent,0) - COALESCE(p.avg_prev,0)) / NULLIF(p.avg_prev,0) * 100, 2)
      END AS change_pct
    FROM recent r
    FULL JOIN prev p ON r.product_id = p.product_id
    LEFT JOIN products prod ON COALESCE(r.product_id, p.product_id) = prod.id
    ORDER BY change_pct DESC NULLS LAST
    LIMIT 50;
  `;

  const forecast2WeeksQ = `
    SELECT oli.product_id, prod.name,
      SUM(oli.quantity)::numeric AS qty_14d,
      (SUM(oli.quantity)/14.0)::numeric AS avg_daily,
      (SUM(oli.quantity)/14.0 * 14.0)::numeric AS forecast_14d
    FROM order_line_items oli
    JOIN orders o ON oli.order_id = o.id
    LEFT JOIN products prod ON oli.product_id = prod.id
    WHERE o.establishment_id = $1
      AND o.created_at >= NOW() - INTERVAL '14 days'
    GROUP BY oli.product_id, prod.name
    ORDER BY qty_14d DESC;
  `;

  /* ---------- run all queries in parallel ---------- */
  const [
    rankingRes,
    topProductsRes,
    prodBySectorRes,
    refugoBySectorRes,
    prodSectorProductRes,
    sales14Res,
    seasonalityRes,
    forecast2wRes,
  ] = await Promise.all([
    run(rankingQ, [establishmentId, sinceDate.toISOString()]),
    run(topProductsQ, [establishmentId, sinceDate.toISOString()]),
    run(productionBySectorQ, [establishmentId, sinceDate.toISOString()]),
    run(refugoBySectorQ, [establishmentId, sinceDate.toISOString()]),
    run(producedBySectorProductQ, [establishmentId, sinceDate.toISOString()]),
    run(productSales14DaysQ, [establishmentId]),
    run(seasonalityQ, [establishmentId]),
    run(forecast2WeeksQ, [establishmentId]),
  ]);

  const rankingAll = Array.isArray(rankingRes) ? rankingRes : [];
  const rankingEnumerated = rankingAll.map((r: any, idx: number) => ({
    position: idx + 1,
    id: r.id,
    name: r.full_name ?? r.id,
    sector: r.sector ?? "(sem setor)",
    qty_produced: Number(r.qty_produced ?? 0),
    value_br: Number(r.value_br ?? 0),
    hours_active: Number(r.hours_active ?? 0),
  }));

  const top3 = rankingEnumerated.slice(0, 3);
  const topProductsList = Array.isArray(topProductsRes) ? topProductsRes : [];
  const productionBySector = Array.isArray(prodBySectorRes) ? prodBySectorRes : [];
  const refugoBySectorList = Array.isArray(refugoBySectorRes) ? refugoBySectorRes : [];
  const sales14List = Array.isArray(sales14Res) ? sales14Res : [];
  const seasonalityList = Array.isArray(seasonalityRes) ? seasonalityRes : [];
  const forecastList = Array.isArray(forecast2wRes) ? forecast2wRes : [];

  // classify giro by tertiles (simple)
  const salesQtys = sales14List.map((s: any) => Number(s.qty_sold_14d ?? 0)).sort((a, b) => b - a);
  const n = salesQtys.length;
  const highThreshold = salesQtys[Math.floor(Math.max(0, Math.floor(n * 0.33) - 1))] ?? 0;
  const lowThreshold = salesQtys[Math.floor(Math.max(0, Math.floor(n * 0.66) - 1))] ?? 0;
  const productGiroMap: Record<string, "high" | "medium" | "low"> = {};
  for (const s of sales14List) {
    const q = Number(s.qty_sold_14d ?? 0);
    let cat: "high" | "medium" | "low" = "low";
    if (q >= highThreshold) cat = "high";
    else if (q >= lowThreshold) cat = "medium";
    productGiroMap[s.product_id] = cat;
  }

  /* ---------- render UI ---------- */
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Produtividade avançada</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada</p>
        </div>
        <form action={async () => { "use server"; revalidatePath("/dashboard/produtividade"); }}>
          <Button variant="outline">🔄 Atualizar</Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking de colaboradores</CardTitle>
          <CardDescription>Todos os colaboradores — Top 3 em destaque</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <div className="space-y-2">
                {rankingEnumerated.map(u => (
                  <div key={u.id} className="flex items-center justify-between border p-2 rounded">
                    <div className="flex items-center gap-3">
                      <div className="w-8 font-mono text-sm text-muted-foreground">#{u.position}</div>
                      <div>
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.sector}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{u.qty_produced.toFixed(0)} UN</div>
                      <div className="text-xs text-muted-foreground">R$ {u.value_br.toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">{formatMinutes(u.hours_active*60)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <CardTitle className="text-sm">Top 3 (gráfico)</CardTitle>
              <Top3BarChart items={top3.map(t=>({ label: `${t.name} • ${t.sector}`, value: t.qty_produced }))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Produtos mais produzidos (últimos {days} dias)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr><th>Produto</th><th>Qtd</th><th>R$</th></tr>
              </thead>
              <tbody>
                {topProductsList.map((p: any) => (
                  <tr key={p.product_id} className="border-t">
                    <td className="py-2">{p.name}</td>
                    <td>{Number(p.qty_produced).toFixed(2)}</td>
                    <td>R$ {Number(p.value_br).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>Produção por setor</CardTitle></CardHeader>
          <CardContent>
            {productionBySector.map((s: any) => (
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
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Refugo por setor</CardTitle></CardHeader>
          <CardContent>
            {refugoBySectorList.map((r:any) => (
              <div key={r.sector} className="flex items-center justify-between border p-2 rounded mb-2">
                <div>
                  <div className="font-medium">{r.sector}</div>
                  <div className="text-xs text-muted-foreground">{Number(r.qty_refugo).toFixed(2)} UN</div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">R$ {Number(r.value_br).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle>Produtos por giro (14d)</CardTitle></CardHeader>
          <CardContent>
            <ul className="list-disc pl-4">
              {sales14List.map((s:any) => (
                <li key={s.product_id} className="py-1 flex justify-between">
                  <div>{s.name}</div>
                  <div className="text-xs text-muted-foreground">{Number(s.qty_sold_14d).toFixed(0)} — {productGiroMap[s.product_id]}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Produtos sazonais</CardTitle></CardHeader>
          <CardContent>
            {seasonalityList.slice(0,10).map((p:any)=>(
              <div key={p.product_id} className="flex justify-between py-1 border-b">
                <div>{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.change_pct ?? '—'}%</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Previsão 2 semanas</CardTitle></CardHeader>
          <CardContent>
            {forecastList.slice(0,20).map((f:any)=>(
              <div key={f.product_id} className="flex justify-between py-1 border-b">
                <div>{f.name}</div>
                <div className="text-xs text-muted-foreground">{Number(f.forecast_14d).toFixed(0)} UN</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
