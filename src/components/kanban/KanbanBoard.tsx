"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Pedido {
  id: number;
  estabelecimento: string;
  dataEntrega: string;
  valorTotal: number;
  status: string;
  itens: number;
  progresso: number;
}

interface KanbanBoardProps {
  pedidos: Pedido[];
}

const statusConfig = {
  criado: { label: "Criado", color: "bg-gray-500", textColor: "text-gray-700" },
  em_preparo: { label: "Em Preparo", color: "bg-blue-500", textColor: "text-blue-700" },
  separacao: { label: "Separação", color: "bg-yellow-500", textColor: "text-yellow-700" },
  conferencia: { label: "Conferência", color: "bg-orange-500", textColor: "text-orange-700" },
  saiu_entrega: { label: "Saiu p/ Entrega", color: "bg-purple-500", textColor: "text-purple-700" },
  entrega_concluida: { label: "Concluído", color: "bg-green-500", textColor: "text-green-700" },
  cancelado: { label: "Cancelado", color: "bg-red-500", textColor: "text-red-700" }
};

const colunas = [
  { key: "criado", title: "Criado" },
  { key: "em_preparo", title: "Em Preparo" },
  { key: "separacao", title: "Separação" },
  { key: "conferencia", title: "Conferência" },
  { key: "saiu_entrega", title: "Saiu p/ Entrega" },
  { key: "entrega_concluida", title: "Concluído" }
];

export function KanbanBoard({ pedidos }: KanbanBoardProps) {
  const getPedidosPorStatus = (status: string) => {
    return pedidos.filter(pedido => pedido.status === status);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 lg:p-6">
        <h2 className="text-xl font-semibold mb-4">Kanban de Pedidos</h2>
        
        {/* Container com scroll horizontal otimizado */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max lg:min-w-0 lg:grid lg:grid-cols-3 xl:grid-cols-6 lg:gap-2 xl:gap-3 min-h-[600px]">
            {colunas.map((coluna) => (
              <div key={coluna.key} className="bg-gray-50 rounded-lg p-2.5 min-w-[260px] lg:min-w-0 flex-shrink-0">
                {/* Header da coluna */}
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900 text-xs lg:text-sm truncate pr-2">
                    {coluna.title}
                  </h3>
                  <Badge variant="secondary" className="flex-shrink-0 text-xs px-1.5 py-0.5">
                    {getPedidosPorStatus(coluna.key).length}
                  </Badge>
                </div>
                
                {/* Cards dos pedidos */}
                <div className="space-y-2">
                  {getPedidosPorStatus(coluna.key).map((pedido) => (
                    <Card key={pedido.id} className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-gray-300">
                      <CardHeader className="pb-1.5 px-2.5 pt-2.5">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-xs font-semibold">#{pedido.id}</CardTitle>
                          <Badge 
                            variant="secondary" 
                            className={`${statusConfig[pedido.status as keyof typeof statusConfig]?.color} text-white text-xs px-1 py-0.5`}
                          >
                            {statusConfig[pedido.status as keyof typeof statusConfig]?.label}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs leading-tight mt-1">
                          {pedido.estabelecimento}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0 px-2.5 pb-2.5">
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Valor:</span>
                            <span className="font-medium text-green-600">{formatCurrency(pedido.valorTotal)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Itens:</span>
                            <span className="font-medium">{pedido.itens}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-600">Entrega:</span>
                            <span className="font-medium">{formatDate(pedido.dataEntrega)}</span>
                          </div>
                          <div className="space-y-0.5 mt-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-600">Progresso:</span>
                              <span className="font-medium">{pedido.progresso}%</span>
                            </div>
                            <Progress value={pedido.progresso} className="h-1.5" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  
                  {/* Placeholder quando não há pedidos */}
                  {getPedidosPorStatus(coluna.key).length === 0 && (
                    <div className="text-center py-6 text-gray-400">
                      <span className="text-xl block mb-1">📋</span>
                      <p className="text-xs">Nenhum pedido</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Legenda de Status */}
        <div className="mt-4 pt-4 border-t">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Legenda de Status:</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statusConfig).map(([key, config]) => (
              <div key={key} className="flex items-center space-x-1.5">
                <div className={`w-2.5 h-2.5 rounded ${config.color}`}></div>
                <span className="text-xs text-gray-600">{config.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}