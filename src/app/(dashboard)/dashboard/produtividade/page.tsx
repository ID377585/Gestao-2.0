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

// Mesmos rótulos de status usados no módulo de pedidos/produção
const STATUS_LABEL: Record<string, string> = {
  pedido_criado: "Pedido criado",
  aceitou_pedido: "Pedido aceito",
  em_preparo: "Em preparo",
  em_separacao: "Em separação",
  em_faturamento: "Em faturamento",
  em_transporte: "Em transporte",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function getStatusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

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

  // janela de análise: últimos 7 dias
  const now = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 7);

  // 1) Pedidos do estabelecimento
  const { data: orders, error: ordersErr } = await supabase
    .from("orders")
    .select("id, status, created_at")
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: false });

  if (ordersErr) {
    throw new Error(ordersErr.message);
  }

  const safeOrders = orders ?? [];

  // 2) Eventos de status (timeline) dos últimos 7 dias
  const { data: events, error: eventsErr } = await supabase
    .from("order_status_events")
    .select(
      "id, order_id, from_status, to_status, created_at, created_by, action",
    )
    .eq("establishment_id", establishmentId)
    .gte("created_at", sevenDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  if (eventsErr) {
    throw new Error(eventsErr.message);
  }

  const safeEvents = events ?? [];

  // ======= MÉTRICAS BÁSICAS =======

  const totalPedidos = safeOrders.length;
  const entregues = safeOrders.filter((o) => o.status === "entregue").length;
  const cancelados = safeOrders.filter((o) => o.status === "cancelado").length;
  const ativos = safeOrders.filter(
    (o) => !["entregue", "cancelado"].includes(o.status),
  ).length;

  // Pedidos por status
  const porStatus: Record<string, number> = {};
  for (const o of safeOrders) {
    porStatus[o.status] = (porStatus[o.status] ?? 0) + 1;
  }

  // Tempo médio total até entrega (pedido_criado -> entregue)
  type OrderTime = { createdAt: Date; deliveredAt?: Date };
  const timesByOrder = new Map<string, OrderTime>();

  for (const o of safeOrders) {
    timesByOrder.set(o.id, {
      createdAt: new Date(o.created_at),
      deliveredAt: undefined,
    });
  }

  for (const ev of safeEvents) {
    if (ev.to_status === "entregue") {
      const entry = timesByOrder.get(ev.order_id);
      if (entry && !entry.deliveredAt) {
        entry.deliveredAt = new Date(ev.created_at);
      }
    }
  }

  let somaMinutos = 0;
  let qtdComTempo = 0;

  for (const [, t] of timesByOrder) {
    if (t.deliveredAt) {
      const diffMs = t.deliveredAt.getTime() - t.createdAt.getTime();
      const diffMin = diffMs / (1000 * 60);
      if (diffMin > 0) {
        somaMinutos += diffMin;
        qtdComTempo += 1;
      }
    }
  }

  const tempoMedioEntregaMin =
    qtdComTempo > 0 ? somaMinutos / qtdComTempo : undefined;

  // Top usuários por quantidade de eventos (atividade operacional)
  const eventosPorUsuario: Record<string, number> = {};
  for (const ev of safeEvents) {
    if (!ev.created_by) continue;
    eventosPorUsuario[ev.created_by] =
      (eventosPorUsuario[ev.created_by] ?? 0) + 1;
  }

  const rankingUsuarios = Object.entries(eventosPorUsuario)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header (responsivo no mobile) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold text-gray-900">Produtividade</h1>
          <p className="text-gray-600 max-w-prose mx-auto sm:mx-0">
            Visão de desempenho dos pedidos e operação nos últimos 7 dias.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Papel atual: <strong>{membership.role ?? "—"}</strong> • Período:{" "}
            <strong>
              {formatDate(sevenDaysAgo.toISOString())} –{" "}
              {formatDate(now.toISOString())}
            </strong>
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {/* Botão de atualizar usando Server Action + revalidatePath */}
          <form
            action={async () => {
              "use server";
              revalidatePath("/dashboard/produtividade");
            }}
            className="w-full sm:w-auto"
          >
            <Button type="submit" variant="outline" className="w-full sm:w-auto">
              <span className="mr-2">🔄</span>
              Atualizar
            </Button>
          </form>
        </div>
      </div>

      {/* Cards principais (2 por linha no mobile) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Pedidos no período
            </CardTitle>
            <span className="text-xl sm:text-2xl">📊</span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold">{totalPedidos}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Somando todos os status
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Ativos
            </CardTitle>
            <span className="text-xl sm:text-2xl">⚙️</span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold">{ativos}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Em qualquer etapa do fluxo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Entregues
            </CardTitle>
            <span className="text-xl sm:text-2xl">✅</span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold">{entregues}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Concluídos no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">
              Cancelados
            </CardTitle>
            <span className="text-xl sm:text-2xl">🛑</span>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-xl sm:text-2xl font-bold">{cancelados}</div>
            <p className="text-[11px] sm:text-xs text-muted-foreground">
              Fora do fluxo normal
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Segunda linha: status + tempo médio */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Pedidos por status */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos por status</CardTitle>
            <CardDescription>
              Distribuição dos pedidos nas etapas do fluxo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.keys(porStatus).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido encontrado no período selecionado.
              </p>
            ) : (
              Object.entries(porStatus)
                .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
                .map(([status, qtd]) => (
                  <div
                    key={status}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{getStatusLabel(status)}</Badge>
                    </div>
                    <div className="font-semibold">{qtd}</div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        {/* Tempo médio */}
        <Card>
          <CardHeader>
            <CardTitle>Tempo médio até entrega</CardTitle>
            <CardDescription>
              Do momento em que o pedido foi criado até o status{" "}
              <strong>entregue</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-sm text-muted-foreground">
                  Tempo médio total
                </div>
                <div className="text-3xl font-bold">
                  {formatMinutes(tempoMedioEntregaMin)}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                Baseado em {qtdComTempo} pedido
                {qtdComTempo === 1 ? "" : "s"} com status entregue.
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              * Essa métrica considera o <code>created_at</code> do pedido e o
              primeiro evento em que o status se torna <code>entregue</code>.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking de atividade operacional + observações */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Atividade operacional</CardTitle>
            <CardDescription>
              Usuários que mais registraram eventos (aceites, avanços,
              cancelamentos, etc.) nos últimos 7 dias.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {rankingUsuarios.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum evento registrado no período.
              </p>
            ) : (
              rankingUsuarios.map(([userId, qtd], idx) => (
                <div
                  key={userId}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <span className="font-mono text-xs truncate max-w-[220px]">
                      {userId}
                    </span>
                  </div>
                  <span className="font-semibold">{qtd} eventos</span>
                </div>
              ))
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Em breve dá pra trocar o ID pelo nome do colaborador usando a
              tabela de perfis/memberships.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Observações</CardTitle>
            <CardDescription>
              Como evoluir esse módulo de produtividade.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <ul className="list-disc space-y-1 pl-4">
              <li>Quebrar tempos por etapa (preparo, separação, transporte).</li>
              <li>
                Gerar ranking por unidade (quando tiver múltiplas unidades por
                organização).
              </li>
              <li>
                Filtros por período (hoje, 7 dias, 30 dias) e por unidade.
              </li>
              <li>
                Mostrar tempo médio específico da produção (do aceitar até
                em_separacao).
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
