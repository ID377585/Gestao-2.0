"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Interface para os dados de produção
interface ProducaoItem {
  id: number;
  pedidoId: number;
  produto: string;
  quantidade: number;
  unidade: string;
  status: "pendente" | "em_preparo" | "finalizado";
  colaborador: string | null;
  tempoInicio: string | null;
  tempoEstimado: number;
  estabelecimento: string;
}

// Dados de exemplo para KDS
const producaoExemplo: ProducaoItem[] = [
  {
    id: 1,
    pedidoId: 2,
    produto: "Pão Francês",
    quantidade: 50,
    unidade: "un",
    status: "pendente",
    colaborador: null,
    tempoInicio: null,
    tempoEstimado: 45,
    estabelecimento: "Padaria São João"
  },
  {
    id: 2,
    pedidoId: 3,
    produto: "Bolo de Chocolate",
    quantidade: 2,
    unidade: "un",
    status: "em_preparo",
    colaborador: "João Silva",
    tempoInicio: "2024-01-15T08:30:00",
    tempoEstimado: 90,
    estabelecimento: "Hotel Cinco Estrelas"
  },
  {
    id: 3,
    pedidoId: 1,
    produto: "Massa de Pizza",
    quantidade: 5,
    unidade: "kg",
    status: "em_preparo",
    colaborador: "Maria Santos",
    tempoInicio: "2024-01-15T09:00:00",
    tempoEstimado: 60,
    estabelecimento: "Restaurante Bella Vista"
  },
  {
    id: 4,
    pedidoId: 3,
    produto: "Croissant",
    quantidade: 24,
    unidade: "un",
    status: "finalizado",
    colaborador: "Pedro Costa",
    tempoInicio: "2024-01-15T07:00:00",
    tempoEstimado: 120,
    estabelecimento: "Hotel Cinco Estrelas"
  }
];



export default function ProducaoPage() {
  const [producoes, setProducoes] = useState<ProducaoItem[]>(producaoExemplo);

  const calcularTempoDecorrido = (tempoInicio: string | null) => {
    if (!tempoInicio) return 0;
    const inicio = new Date(tempoInicio);
    const agora = new Date();
    return Math.floor((agora.getTime() - inicio.getTime()) / (1000 * 60)); // em minutos
  };

  const calcularProgresso = (tempoInicio: string | null, tempoEstimado: number) => {
    if (!tempoInicio) return 0;
    const tempoDecorrido = calcularTempoDecorrido(tempoInicio);
    return Math.min((tempoDecorrido / tempoEstimado) * 100, 100);
  };

  const iniciarPreparo = (id: number) => {
    setProducoes(prev => prev.map(p => 
      p.id === id 
        ? { ...p, status: "em_preparo", tempoInicio: new Date().toISOString() }
        : p
    ));
  };

  const finalizarPreparo = (id: number) => {
    setProducoes(prev => prev.map(p => 
      p.id === id 
        ? { ...p, status: "finalizado" }
        : p
    ));
  };



  const getPorStatus = (status: string) => {
    return producoes.filter(p => p.status === status);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produção - KDS</h1>
          <p className="text-gray-600">Kitchen Display System - Monitor de Cozinha</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <span className="mr-2">🔄</span>
            Atualizar
          </Button>
          <Button>
            <span className="mr-2">⚙️</span>
            Configurações
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <span className="text-2xl">⏳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getPorStatus('pendente').length}</div>
            <p className="text-xs text-muted-foreground">
              Aguardando início
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Preparo</CardTitle>
            <span className="text-2xl">👨‍🍳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getPorStatus('em_preparo').length}</div>
            <p className="text-xs text-muted-foreground">
              Em produção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Finalizados</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getPorStatus('finalizado').length}</div>
            <p className="text-xs text-muted-foreground">
              Hoje
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <span className="text-2xl">⏱️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">75min</div>
            <p className="text-xs text-muted-foreground">
              Por produção
            </p>
          </CardContent>
        </Card>
      </div>

      {/* KDS Board */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pendentes */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Pendentes</h2>
              <Badge variant="secondary">{getPorStatus('pendente').length}</Badge>
            </div>
          </div>
          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {getPorStatus('pendente').map((item) => (
              <Card key={item.id} className="border-l-4 border-l-gray-400">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">#{item.pedidoId} - {item.produto}</CardTitle>
                    <Badge variant="secondary" className="bg-gray-500 text-white">
                      Pendente
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {item.estabelecimento}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Quantidade:</span>
                      <span className="font-medium">{item.quantidade} {item.unidade}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tempo estimado:</span>
                      <span>{item.tempoEstimado}min</span>
                    </div>
                    <div className="pt-2">
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => iniciarPreparo(item.id)}
                      >
                        <span className="mr-2">▶️</span>
                        Iniciar Preparo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Em Preparo */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Em Preparo</h2>
              <Badge variant="secondary">{getPorStatus('em_preparo').length}</Badge>
            </div>
          </div>
          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {getPorStatus('em_preparo').map((item) => (
              <Card key={item.id} className="border-l-4 border-l-blue-400">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">#{item.pedidoId} - {item.produto}</CardTitle>
                    <Badge variant="secondary" className="bg-blue-500 text-white">
                      Em Preparo
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {item.estabelecimento}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Quantidade:</span>
                      <span className="font-medium">{item.quantidade} {item.unidade}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Colaborador:</span>
                      <span className="font-medium">{item.colaborador || "Não atribuído"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tempo decorrido:</span>
                      <span>{calcularTempoDecorrido(item.tempoInicio)}min</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>Progresso:</span>
                        <span>{Math.round(calcularProgresso(item.tempoInicio, item.tempoEstimado))}%</span>
                      </div>
                      <Progress 
                        value={calcularProgresso(item.tempoInicio, item.tempoEstimado)} 
                        className="h-2" 
                      />
                    </div>
                    <div className="pt-2">
                      <Button 
                        size="sm" 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => finalizarPreparo(item.id)}
                      >
                        <span className="mr-2">✅</span>
                        Finalizar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Finalizados */}
        <div className="bg-white rounded-lg border">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Finalizados</h2>
              <Badge variant="secondary">{getPorStatus('finalizado').length}</Badge>
            </div>
          </div>
          <div className="p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {getPorStatus('finalizado').map((item) => (
              <Card key={item.id} className="border-l-4 border-l-green-400">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">#{item.pedidoId} - {item.produto}</CardTitle>
                    <Badge variant="secondary" className="bg-green-500 text-white">
                      Finalizado
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">
                    {item.estabelecimento}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Quantidade:</span>
                      <span className="font-medium">{item.quantidade} {item.unidade}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Colaborador:</span>
                      <span className="font-medium">{item.colaborador}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Tempo total:</span>
                      <span>{calcularTempoDecorrido(item.tempoInicio)}min</span>
                    </div>
                    <div className="pt-2">
                      <Badge variant="outline" className="w-full justify-center">
                        <span className="mr-2">✅</span>
                        Concluído
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}