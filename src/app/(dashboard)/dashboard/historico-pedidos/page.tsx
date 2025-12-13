"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Interface para histórico de pedidos
interface HistoricoPedido {
  id: number;
  dataEntrega: string;
  estabelecimento: string;
  status: string;
  valorTotal: number;
  totalItens: number;
  criadoPor: string;
  tempoEntrega: number; // em horas
  observacoes?: string;
}

// Dados de exemplo
const historicoPedidosExemplo: HistoricoPedido[] = [
  {
    id: 1,
    dataEntrega: "2024-01-15",
    estabelecimento: "Restaurante Bella Vista",
    status: "entrega_concluida",
    valorTotal: 450.80,
    totalItens: 8,
    criadoPor: "Admin User",
    tempoEntrega: 48,
    observacoes: "Entrega realizada no prazo"
  },
  {
    id: 2,
    dataEntrega: "2024-01-14",
    estabelecimento: "Padaria São João",
    status: "entrega_concluida",
    valorTotal: 280.50,
    totalItens: 5,
    criadoPor: "João Silva",
    tempoEntrega: 24
  },
  {
    id: 3,
    dataEntrega: "2024-01-13",
    estabelecimento: "Hotel Cinco Estrelas",
    status: "entrega_concluida",
    valorTotal: 1250.00,
    totalItens: 15,
    criadoPor: "Maria Santos",
    tempoEntrega: 72
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
    observacoes: "Cancelado pelo cliente"
  },
  {
    id: 5,
    dataEntrega: "2024-01-11",
    estabelecimento: "Padaria São João",
    status: "entrega_concluida",
    valorTotal: 180.30,
    totalItens: 4,
    criadoPor: "Pedro Costa",
    tempoEntrega: 36
  },
  {
    id: 6,
    dataEntrega: "2024-01-10",
    estabelecimento: "Hotel Cinco Estrelas",
    status: "entrega_concluida",
    valorTotal: 890.25,
    totalItens: 12,
    criadoPor: "Ana Oliveira",
    tempoEntrega: 60
  },
  {
    id: 7,
    dataEntrega: "2024-01-09",
    estabelecimento: "Restaurante Bella Vista",
    status: "entrega_concluida",
    valorTotal: 675.40,
    totalItens: 9,
    criadoPor: "Carlos Mendes",
    tempoEntrega: 42
  },
  {
    id: 8,
    dataEntrega: "2024-01-08",
    estabelecimento: "Padaria São João",
    status: "entrega_concluida",
    valorTotal: 195.80,
    totalItens: 3,
    criadoPor: "João Silva",
    tempoEntrega: 18
  }
];

const statusConfig = {
  entrega_concluida: { label: "Concluído", color: "bg-green-500", textColor: "text-green-700" },
  cancelado: { label: "Cancelado", color: "bg-red-500", textColor: "text-red-700" }
};

export default function HistoricoPedidosPage() {
  const [historico] = useState(historicoPedidosExemplo);
  const [filtroEstabelecimento, setFiltroEstabelecimento] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDataInicio, setFiltroDataInicio] = useState("");
  const [filtroDataFim, setFiltroDataFim] = useState("");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  // Filtrar dados
  const historicoFiltrado = historico.filter(pedido => {
    const matchEstabelecimento = filtroEstabelecimento === "todos" || pedido.estabelecimento === filtroEstabelecimento;
    const matchStatus = filtroStatus === "todos" || pedido.status === filtroStatus;
    
    let matchData = true;
    if (filtroDataInicio && filtroDataFim) {
      const dataEntrega = new Date(pedido.dataEntrega);
      const dataInicio = new Date(filtroDataInicio);
      const dataFim = new Date(filtroDataFim);
      matchData = dataEntrega >= dataInicio && dataEntrega <= dataFim;
    }
    
    return matchEstabelecimento && matchStatus && matchData;
  });

  // Estatísticas
  const pedidosConcluidos = historicoFiltrado.filter(p => p.status === "entrega_concluida");
  const pedidosCancelados = historicoFiltrado.filter(p => p.status === "cancelado");
  const valorTotalPeriodo = pedidosConcluidos.reduce((acc, p) => acc + p.valorTotal, 0);
  const tempoMedioEntrega = pedidosConcluidos.length > 0 
    ? pedidosConcluidos.reduce((acc, p) => acc + p.tempoEntrega, 0) / pedidosConcluidos.length 
    : 0;

  // Estabelecimentos únicos para filtro
  const estabelecimentosUnicos = [...new Set(historico.map(p => p.estabelecimento))];

  // Análise de tendências (últimos 7 dias)
  const ultimosSeteDias = historico.filter(p => {
    const dataEntrega = new Date(p.dataEntrega);
    const seteDiasAtras = new Date();
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    return dataEntrega >= seteDiasAtras;
  });

  const exportarDados = () => {
    // TODO: Implementar exportação para CSV/XLSX
    console.log("Exportar dados:", historicoFiltrado);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Histórico de Pedidos</h1>
          <p className="text-gray-600">Análise histórica para cálculo de ordens de produção e relatórios</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={exportarDados}>
            <span className="mr-2">📊</span>
            Exportar CSV
          </Button>
          <Button variant="outline">
            <span className="mr-2">📈</span>
            Power BI
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Filtre os dados para análise específica
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label>Estabelecimento</Label>
              <Select value={filtroEstabelecimento} onValueChange={setFiltroEstabelecimento}>
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
            
            <div>
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

            <div>
              <Label>Data Início</Label>
              <Input 
                type="date" 
                value={filtroDataInicio}
                onChange={(e) => setFiltroDataInicio(e.target.value)}
              />
            </div>

            <div>
              <Label>Data Fim</Label>
              <Input 
                type="date" 
                value={filtroDataFim}
                onChange={(e) => setFiltroDataFim(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <span className="text-2xl">📋</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{historicoFiltrado.length}</div>
            <p className="text-xs text-muted-foreground">
              No período selecionado
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pedidos Concluídos</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{pedidosConcluidos.length}</div>
            <p className="text-xs text-muted-foreground">
              Taxa: {historicoFiltrado.length > 0 ? ((pedidosConcluidos.length / historicoFiltrado.length) * 100).toFixed(1) : 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(valorTotalPeriodo)}</div>
            <p className="text-xs text-muted-foreground">
              Pedidos concluídos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <span className="text-2xl">⏱️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tempoMedioEntrega.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">
              Tempo de entrega
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Análise de Tendências */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Análise por Estabelecimento</CardTitle>
            <CardDescription>
              Performance dos últimos 7 dias
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {estabelecimentosUnicos.map((estabelecimento) => {
                const pedidosEstabelecimento = ultimosSeteDias.filter(p => p.estabelecimento === estabelecimento);
                const valorEstabelecimento = pedidosEstabelecimento.reduce((acc, p) => acc + p.valorTotal, 0);
                return (
                  <div key={estabelecimento} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{estabelecimento}</p>
                      <p className="text-sm text-gray-600">{pedidosEstabelecimento.length} pedidos</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(valorEstabelecimento)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos Mais Pedidos</CardTitle>
            <CardDescription>
              Base para ordens de produção futuras
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <span className="text-4xl mb-2 block">📊</span>
                <p className="text-gray-600">Análise de produtos será implementada</p>
                <p className="text-sm text-gray-500">com base nos itens dos pedidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico Detalhado</CardTitle>
          <CardDescription>
            Todos os pedidos do período selecionado ({historicoFiltrado.length} registros)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Data Entrega</TableHead>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Itens</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Tempo Entrega</TableHead>
                <TableHead>Criado Por</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historicoFiltrado.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell className="font-medium">#{pedido.id}</TableCell>
                  <TableCell>{formatDate(pedido.dataEntrega)}</TableCell>
                  <TableCell>{pedido.estabelecimento}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={`${statusConfig[pedido.status as keyof typeof statusConfig]?.color} text-white`}
                    >
                      {statusConfig[pedido.status as keyof typeof statusConfig]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>{pedido.totalItens}</TableCell>
                  <TableCell className="font-medium">{formatCurrency(pedido.valorTotal)}</TableCell>
                  <TableCell>
                    {pedido.tempoEntrega > 0 ? `${pedido.tempoEntrega}h` : "-"}
                  </TableCell>
                  <TableCell>{pedido.criadoPor}</TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
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
        </CardContent>
      </Card>

      {/* Insights para Ordens de Produção */}
      <Card className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <span className="mr-2">🎯</span>
            Insights para Ordens de Produção
          </CardTitle>
          <CardDescription>
            Análise baseada no histórico para planejamento futuro
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(valorTotalPeriodo / (historicoFiltrado.length || 1))}</p>
              <p className="text-sm text-gray-600">Ticket Médio</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-2xl font-bold text-green-600">{(pedidosConcluidos.length / (historicoFiltrado.length || 1) * 100).toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Taxa de Sucesso</p>
            </div>
            <div className="text-center p-4 bg-white rounded-lg">
              <p className="text-2xl font-bold text-purple-600">{estabelecimentosUnicos.length}</p>
              <p className="text-sm text-gray-600">Clientes Ativos</p>
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-white rounded-lg">
            <h4 className="font-semibold mb-2">Recomendações:</h4>
            <ul className="text-sm text-gray-700 space-y-1">
              <li>• Manter estoque baseado na média de {(valorTotalPeriodo / pedidosConcluidos.length || 0).toFixed(0)} reais por pedido</li>
              <li>• Tempo médio de entrega de {tempoMedioEntrega.toFixed(0)}h pode ser otimizado</li>
              <li>• {estabelecimentosUnicos[0]} é o cliente com maior volume</li>
              <li>• Taxa de cancelamento de {(pedidosCancelados.length / (historicoFiltrado.length || 1) * 100).toFixed(1)}% precisa ser reduzida</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}