"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardStatGrid } from "@/components/dashboard/DashboardStatGrid";
import { DashboardTableShell } from "@/components/dashboard/DashboardTableShell";
import { SortableHeader } from "@/components/dashboard/SortableHeader";
import { TablePagination } from "@/components/dashboard/TablePagination";
import { usePaginatedSort } from "@/hooks/usePaginatedSort";

interface HistoricoPedido {
  id: number;
  dataEntrega: string;
  estabelecimento: string;
  status: string;
  valorTotal: number;
  totalItens: number;
  criadoPor: string;
  tempoEntrega: number;
  observacoes?: string;
}

const historicoPedidosExemplo: HistoricoPedido[] = [
  {
    id: 1,
    dataEntrega: "2024-01-15",
    estabelecimento: "Restaurante Bella Vista",
    status: "entrega_concluida",
    valorTotal: 450.8,
    totalItens: 8,
    criadoPor: "Admin User",
    tempoEntrega: 48,
    observacoes: "Entrega realizada no prazo",
  },
  {
    id: 2,
    dataEntrega: "2024-01-14",
    estabelecimento: "Padaria São João",
    status: "entrega_concluida",
    valorTotal: 280.5,
    totalItens: 5,
    criadoPor: "João Silva",
    tempoEntrega: 24,
  },
  {
    id: 3,
    dataEntrega: "2024-01-13",
    estabelecimento: "Hotel Cinco Estrelas",
    status: "entrega_concluida",
    valorTotal: 1250.0,
    totalItens: 15,
    criadoPor: "Maria Santos",
    tempoEntrega: 72,
  },
  {
    id: 4,
    dataEntrega: "2024-01-12",
    estabelecimento: "Restaurante Bella Vista",
    status: "cancelado",
    valorTotal: 320.75,
    totalItens: 6,
    criadoPor: "Admin User",
    tempoEntrega: 0,
    observacoes: "Cancelado pelo cliente",
  },
  {
    id: 5,
    dataEntrega: "2024-01-11",
    estabelecimento: "Padaria São João",
    status: "entrega_concluida",
    valorTotal: 180.3,
    totalItens: 4,
    criadoPor: "Pedro Costa",
    tempoEntrega: 36,
  },
  {
    id: 6,
    dataEntrega: "2024-01-10",
    estabelecimento: "Hotel Cinco Estrelas",
    status: "entrega_concluida",
    valorTotal: 890.25,
    totalItens: 12,
    criadoPor: "Ana Oliveira",
    tempoEntrega: 60,
  },
  {
    id: 7,
    dataEntrega: "2024-01-09",
    estabelecimento: "Restaurante Bella Vista",
    status: "entrega_concluida",
    valorTotal: 675.4,
    totalItens: 9,
    criadoPor: "Carlos Mendes",
    tempoEntrega: 42,
  },
  {
    id: 8,
    dataEntrega: "2024-01-08",
    estabelecimento: "Padaria São João",
    status: "entrega_concluida",
    valorTotal: 195.8,
    totalItens: 3,
    criadoPor: "João Silva",
    tempoEntrega: 18,
  },
];

const statusConfig = {
  entrega_concluida: {
    label: "Concluído",
    badgeClassName: "bg-green-500 text-white hover:bg-green-500",
  },
  cancelado: {
    label: "Cancelado",
    badgeClassName: "bg-red-500 text-white hover:bg-red-500",
  },
} as const;

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("pt-BR");
}

export default function HistoricoPedidosPage() {
  const [historico] = useState(historicoPedidosExemplo);
  const [filtroEstabelecimento, setFiltroEstabelecimento] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const historicoFiltrado = useMemo(() => {
    return historico.filter((pedido) => {
      const matchEstabelecimento =
        filtroEstabelecimento === "todos" ||
        pedido.estabelecimento === filtroEstabelecimento;

      const matchStatus =
        filtroStatus === "todos" || pedido.status === filtroStatus;

      let matchData = true;

      if (filtroDataInicio && filtroDataFim) {
        const dataEntrega = new Date(pedido.dataEntrega);
        const dataInicio = new Date(filtroDataInicio);
        const dataFim = new Date(filtroDataFim);
        matchData = dataEntrega >= dataInicio && dataEntrega <= dataFim;
      }

      return matchEstabelecimento && matchStatus && matchData;
    });
  }, [historico, filtroEstabelecimento, filtroStatus, filtroDataInicio, filtroDataFim]);

  const pedidosConcluidos = useMemo(
    () => historicoFiltrado.filter((p) => p.status === "entrega_concluida"),
    [historicoFiltrado]
  );

  const pedidosCancelados = useMemo(
    () => historicoFiltrado.filter((p) => p.status === "cancelado"),
    [historicoFiltrado]
  );

  const valorTotalPeriodo = useMemo(
    () => pedidosConcluidos.reduce((acc, p) => acc + p.valorTotal, 0),
    [pedidosConcluidos]
  );

  const tempoMedioEntrega = useMemo(() => {
    if (pedidosConcluidos.length === 0) return 0;
    return (
      pedidosConcluidos.reduce((acc, p) => acc + p.tempoEntrega, 0) /
      pedidosConcluidos.length
    );
  }, [pedidosConcluidos]);

  const estabelecimentosUnicos = useMemo(
    () => [...new Set(historico.map((p) => p.estabelecimento))],
    [historico]
  );

  const ultimosSeteDias = useMemo(() => {
    return historico.filter((p) => {
      const dataEntrega = new Date(p.dataEntrega);
      const seteDiasAtras = new Date();
      seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
      return dataEntrega >= seteDiasAtras;
    });
  }, [historico]);

  const {
    sortKey,
    sortDirection,
    paginatedRows,
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    handleSort,
    handlePageChange,
    handlePageSizeChange,
  } = usePaginatedSort<HistoricoPedido>({
    rows: historicoFiltrado,
    initialSortKey: "dataEntrega",
    initialSortDirection: "desc",
    initialPageSize: 10,
    accessors: {
      id: (row) => row.id,
      dataEntrega: (row) => row.dataEntrega,
      estabelecimento: (row) => row.estabelecimento,
      status: (row) => row.status,
      totalItens: (row) => row.totalItens,
      valorTotal: (row) => row.valorTotal,
      tempoEntrega: (row) => row.tempoEntrega,
      criadoPor: (row) => row.criadoPor,
    },
  });

  const exportarDados = () => {
    console.log("Exportar dados:", historicoFiltrado);
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Histórico de Pedidos"
        description="Análise histórica para cálculo de ordens de produção, relatórios e acompanhamento operacional."
        actions={
          <>
            <Button variant="outline" onClick={exportarDados}>
              <span className="mr-2">📊</span>
              Exportar CSV
            </Button>
            <Button variant="outline">
              <span className="mr-2">📈</span>
              Power BI
            </Button>
          </>
        }
      />

      <DashboardTableShell
        title="Filtros"
        description="Filtre os dados para análise específica."
        tableWrapperClassName="overflow-visible rounded-none border-0"
      >
        <div className="grid grid-cols-1 gap-4 p-1 md:grid-cols-4">
          <div className="space-y-2">
            <Label>Estabelecimento</Label>
            <Select
              value={filtroEstabelecimento}
              onValueChange={setFiltroEstabelecimento}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os estabelecimentos</SelectItem>
                {estabelecimentosUnicos.map((estabelecimento) => (
                  <SelectItem key={estabelecimento} value={estabelecimento}>
                    {estabelecimento}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="entrega_concluida">Concluídos</SelectItem>
                <SelectItem value="cancelado">Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Data Início</Label>
            <Input
              type="date"
              value={filtroDataInicio}
              onChange={(e) => setFiltroDataInicio(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Data Fim</Label>
            <Input
              type="date"
              value={filtroDataFim}
              onChange={(e) => setFiltroDataFim(e.target.value)}
            />
          </div>
        </div>
      </DashboardTableShell>

      <DashboardStatGrid
        items={[
          {
            title: "Total de Pedidos",
            value: historicoFiltrado.length,
            description: "No período selecionado",
            icon: <span className="text-xl">📋</span>,
          },
          {
            title: "Pedidos Concluídos",
            value: pedidosConcluidos.length,
            description: `Taxa: ${
              historicoFiltrado.length > 0
                ? ((pedidosConcluidos.length / historicoFiltrado.length) * 100).toFixed(1)
                : 0
            }%`,
            icon: <span className="text-xl">✅</span>,
            valueClassName: "text-green-600",
          },
          {
            title: "Valor Total",
            value: formatCurrency(valorTotalPeriodo),
            description: "Pedidos concluídos",
            icon: <span className="text-xl">💰</span>,
          },
          {
            title: "Tempo Médio",
            value: `${tempoMedioEntrega.toFixed(0)}h`,
            description: "Tempo de entrega",
            icon: <span className="text-xl">⏱️</span>,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 space-y-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Análise por Estabelecimento
              </h3>
              <p className="text-sm text-muted-foreground">
                Performance dos últimos 7 dias.
              </p>
            </div>

            <div className="space-y-4">
              {estabelecimentosUnicos.map((estabelecimento) => {
                const pedidosEstabelecimento = ultimosSeteDias.filter(
                  (p) => p.estabelecimento === estabelecimento
                );

                const valorEstabelecimento = pedidosEstabelecimento.reduce(
                  (acc, p) => acc + p.valorTotal,
                  0
                );

                return (
                  <div
                    key={estabelecimento}
                    className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-900"
                  >
                    <div>
                      <p className="font-medium">{estabelecimento}</p>
                      <p className="text-sm text-muted-foreground">
                        {pedidosEstabelecimento.length} pedidos
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">
                        {formatCurrency(valorEstabelecimento)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 space-y-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                Produtos Mais Pedidos
              </h3>
              <p className="text-sm text-muted-foreground">
                Base para ordens de produção futuras.
              </p>
            </div>

            <div className="flex h-64 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-900">
              <div className="text-center">
                <span className="mb-2 block text-4xl">📊</span>
                <p className="text-gray-600 dark:text-slate-300">
                  Análise de produtos será implementada
                </p>
                <p className="text-sm text-muted-foreground">
                  com base nos itens dos pedidos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <DashboardTableShell
        title="Histórico Detalhado"
        description={`Todos os pedidos do período selecionado (${totalItems} registros).`}
        empty={paginatedRows.length === 0}
        emptyState={
          <p className="text-sm text-muted-foreground">
            Nenhum pedido encontrado com os filtros aplicados.
          </p>
        }
        footer={
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHeader
                label="ID"
                columnKey="id"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Data Entrega"
                columnKey="dataEntrega"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Estabelecimento"
                columnKey="estabelecimento"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Status"
                columnKey="status"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <SortableHeader
                label="Itens"
                columnKey="totalItens"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                align="right"
              />
              <SortableHeader
                label="Valor Total"
                columnKey="valorTotal"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                align="right"
              />
              <SortableHeader
                label="Tempo Entrega"
                columnKey="tempoEntrega"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                align="right"
              />
              <SortableHeader
                label="Criado Por"
                columnKey="criadoPor"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
              />
              <TableHead />
            </TableRow>
          </TableHeader>

          <TableBody>
            {paginatedRows.map((pedido) => (
              <TableRow key={pedido.id}>
                <TableCell className="font-medium">#{pedido.id}</TableCell>
                <TableCell>{formatDate(pedido.dataEntrega)}</TableCell>
                <TableCell>{pedido.estabelecimento}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={
                      statusConfig[pedido.status as keyof typeof statusConfig]
                        ?.badgeClassName
                    }
                  >
                    {
                      statusConfig[pedido.status as keyof typeof statusConfig]
                        ?.label
                    }
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{pedido.totalItens}</TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(pedido.valorTotal)}
                </TableCell>
                <TableCell className="text-right">
                  {pedido.tempoEntrega > 0 ? `${pedido.tempoEntrega}h` : "-"}
                </TableCell>
                <TableCell>{pedido.criadoPor}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="outline">
                      👁️
                    </Button>
                    <Button size="sm" variant="outline">
                      📋
                    </Button>
                    <Button size="sm" variant="outline">
                      🖨️
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DashboardTableShell>

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-900 dark:to-slate-800">
        <CardContent className="pt-6">
          <div className="mb-4 space-y-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Insights para Ordens de Produção
            </h3>
            <p className="text-sm text-muted-foreground">
              Análise baseada no histórico para planejamento futuro.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-white p-4 text-center dark:bg-slate-950">
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(valorTotalPeriodo / (historicoFiltrado.length || 1))}
              </p>
              <p className="text-sm text-muted-foreground">Ticket Médio</p>
            </div>

            <div className="rounded-lg bg-white p-4 text-center dark:bg-slate-950">
              <p className="text-2xl font-bold text-green-600">
                {(
                  (pedidosConcluidos.length / (historicoFiltrado.length || 1)) *
                  100
                ).toFixed(1)}
                %
              </p>
              <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
            </div>

            <div className="rounded-lg bg-white p-4 text-center dark:bg-slate-950">
              <p className="text-2xl font-bold text-purple-600">
                {estabelecimentosUnicos.length}
              </p>
              <p className="text-sm text-muted-foreground">Clientes Ativos</p>
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-white p-4 dark:bg-slate-950">
            <h4 className="mb-2 font-semibold">Recomendações:</h4>
            <ul className="space-y-1 text-sm text-gray-700 dark:text-slate-300">
              <li>
                • Manter estoque baseado na média de{" "}
                {(valorTotalPeriodo / (pedidosConcluidos.length || 1)).toFixed(0)} reais
                por pedido
              </li>
              <li>
                • Tempo médio de entrega de {tempoMedioEntrega.toFixed(0)}h pode ser
                otimizado
              </li>
              <li>
                • {estabelecimentosUnicos[0] ?? "Principal cliente"} é o cliente com
                maior volume
              </li>
              <li>
                • Taxa de cancelamento de{" "}
                {(
                  (pedidosCancelados.length / (historicoFiltrado.length || 1)) *
                  100
                ).toFixed(1)}
                % precisa ser reduzida
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}