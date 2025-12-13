"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Dados de exemplo para produtividade
const produtividadeExemplo = [
  {
    id: 1,
    colaborador: "João Silva",
    cargo: "Padeiro",
    totalPesoKg: 45.5,
    valorPesoRs: 850.30,
    totalUnidades: 120,
    valorUnidadesRs: 540.00,
    valorTotalRs: 1390.30,
    periodo: "2024-01"
  },
  {
    id: 2,
    colaborador: "Maria Santos",
    cargo: "Confeiteira",
    totalPesoKg: 32.8,
    valorPesoRs: 920.40,
    totalUnidades: 85,
    valorUnidadesRs: 765.50,
    valorTotalRs: 1685.90,
    periodo: "2024-01"
  },
  {
    id: 3,
    colaborador: "Pedro Costa",
    cargo: "Chefe de Cozinha",
    totalPesoKg: 28.2,
    valorPesoRs: 1120.80,
    totalUnidades: 95,
    valorUnidadesRs: 890.20,
    valorTotalRs: 2011.00,
    periodo: "2024-01"
  },
  {
    id: 4,
    colaborador: "Ana Oliveira",
    cargo: "Masseira",
    totalPesoKg: 38.7,
    valorPesoRs: 695.60,
    totalUnidades: 110,
    valorUnidadesRs: 495.80,
    valorTotalRs: 1191.40,
    periodo: "2024-01"
  },
  {
    id: 5,
    colaborador: "Carlos Mendes",
    cargo: "Auxiliar de Cozinha",
    totalPesoKg: 22.1,
    valorPesoRs: 398.50,
    totalUnidades: 75,
    valorUnidadesRs: 337.50,
    valorTotalRs: 736.00,
    periodo: "2024-01"
  }
];

const periodosDisponiveis = [
  { value: "hoje", label: "Hoje" },
  { value: "semana", label: "Esta Semana" },
  { value: "mes", label: "Este Mês" },
  { value: "ano", label: "Este Ano" },
  { value: "2024-01", label: "Janeiro 2024" },
  { value: "2023-12", label: "Dezembro 2023" }
];

export default function ProdutividadePage() {
  const [produtividade] = useState(produtividadeExemplo);
  const [periodoSelecionado, setPeriodoSelecionado] = useState("mes");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatWeight = (value: number) => {
    return `${value.toFixed(1)} kg`;
  };

  const calcularTotais = () => {
    return produtividade.reduce((acc, item) => ({
      totalPeso: acc.totalPeso + item.totalPesoKg,
      totalUnidades: acc.totalUnidades + item.totalUnidades,
      valorTotal: acc.valorTotal + item.valorTotalRs
    }), { totalPeso: 0, totalUnidades: 0, valorTotal: 0 });
  };

  const rankingOrdenado = [...produtividade].sort((a, b) => b.valorTotalRs - a.valorTotalRs);
  const totais = calcularTotais();

  const getRankingPosition = (colaboradorId: number) => {
    return rankingOrdenado.findIndex(item => item.id === colaboradorId) + 1;
  };

  const getRankingBadge = (position: number) => {
    if (position === 1) return { color: "bg-yellow-500", icon: "🥇", text: "1º" };
    if (position === 2) return { color: "bg-gray-400", icon: "🥈", text: "2º" };
    if (position === 3) return { color: "bg-amber-600", icon: "🥉", text: "3º" };
    return { color: "bg-blue-500", icon: "🏅", text: `${position}º` };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produtividade</h1>
          <p className="text-gray-600">Ranking e métricas de desempenho dos colaboradores</p>
        </div>
        <div className="flex space-x-2">
          <Select value={periodoSelecionado} onValueChange={setPeriodoSelecionado}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Selecionar período" />
            </SelectTrigger>
            <SelectContent>
              {periodosDisponiveis.map((periodo) => (
                <SelectItem key={periodo.value} value={periodo.value}>
                  {periodo.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline">
            <span className="mr-2">📊</span>
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Colaboradores</CardTitle>
            <span className="text-2xl">👥</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{produtividade.length}</div>
            <p className="text-xs text-muted-foreground">
              Ativos no período
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produção Total (Peso)</CardTitle>
            <span className="text-2xl">⚖️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatWeight(totais.totalPeso)}</div>
            <p className="text-xs text-muted-foreground">
              Peso total produzido
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produção Total (Unidades)</CardTitle>
            <span className="text-2xl">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totais.totalUnidades}</div>
            <p className="text-xs text-muted-foreground">
              Unidades produzidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totais.valorTotal)}</div>
            <p className="text-xs text-muted-foreground">
              Valor total produzido
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Ranking Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top 3 */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="mr-2">🏆</span>
                Top 3 Colaboradores
              </CardTitle>
              <CardDescription>
                Melhores desempenhos do período
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {rankingOrdenado.slice(0, 3).map((item, index) => {
                const badge = getRankingBadge(index + 1);
                return (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Badge className={`${badge.color} text-white`}>
                        {badge.icon} {badge.text}
                      </Badge>
                      <div>
                        <p className="font-medium">{item.colaborador}</p>
                        <p className="text-sm text-gray-600">{item.cargo}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">{formatCurrency(item.valorTotalRs)}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Gráfico de Performance - Placeholder */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Performance por Colaborador</CardTitle>
              <CardDescription>
                Comparativo de produção em valor (R$)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <span className="text-4xl mb-2 block">📊</span>
                  <p className="text-gray-600">Gráfico de barras será implementado</p>
                  <p className="text-sm text-gray-500">com biblioteca de charts (recharts)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle>Produtividade Detalhada</CardTitle>
          <CardDescription>
            Métricas completas de todos os colaboradores
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ranking</TableHead>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Peso (kg)</TableHead>
                <TableHead>Valor Peso</TableHead>
                <TableHead>Unidades</TableHead>
                <TableHead>Valor Unidades</TableHead>
                <TableHead>Total Geral</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rankingOrdenado.map((item) => {
                const position = getRankingPosition(item.id);
                const badge = getRankingBadge(position);
                return (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge className={`${badge.color} text-white`}>
                        {badge.icon} {badge.text}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{item.colaborador}</TableCell>
                    <TableCell>{item.cargo}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{formatWeight(item.totalPesoKg)}</p>
                        <p className="text-sm text-green-600">{formatCurrency(item.valorPesoRs)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {formatCurrency(item.valorPesoRs)}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.totalUnidades} un</p>
                        <p className="text-sm text-green-600">{formatCurrency(item.valorUnidadesRs)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {formatCurrency(item.valorUnidadesRs)}
                    </TableCell>
                    <TableCell className="font-bold text-lg text-green-700">
                      {formatCurrency(item.valorTotalRs)}
                    </TableCell>
                    <TableCell>
                      <div className="flex space-x-1">
                        <Button size="sm" variant="outline">
                          📊
                        </Button>
                        <Button size="sm" variant="outline">
                          📋
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resumo Final */}
      <Card className="bg-gradient-to-r from-blue-50 to-green-50">
        <CardHeader>
          <CardTitle className="text-center">📈 Resumo do Período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{formatWeight(totais.totalPeso)}</p>
              <p className="text-sm text-gray-600">Total em Peso</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{totais.totalUnidades} un</p>
              <p className="text-sm text-gray-600">Total em Unidades</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(totais.valorTotal)}</p>
              <p className="text-sm text-gray-600">Valor Total Produzido</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}