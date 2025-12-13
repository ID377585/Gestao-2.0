"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ItemPedido {
  id: number;
  insumoId: number;
  produtoNome: string;
  quantidade: number;
  unidade: string;
  precoCustoUnitario: number;
  precoCustoTotal: number;
}

interface PedidoDetalhado {
  id: number;
  estabelecimento: {
    nome: string;
    endereco: string;
    telefone: string;
    email: string;
  };
  dataPedido: string;
  horaPedido: string;
  dataEntrega: string;
  status: string;
  valorTotal: number;
  quemCriou: string;
  observacoes?: string;
  itensPedido: ItemPedido[];
}

interface PedidoDetalhesProps {
  pedido: PedidoDetalhado;
  onClose: () => void;
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

export function PedidoDetalhes({ pedido, onClose }: PedidoDetalhesProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (data: string, hora: string) => {
    return `${formatDate(data)} às ${hora}`;
  };

  const handleImprimirPedido = () => {
    // TODO: Implementar impressão
    window.open(`/api/print/pedido/${pedido.id}?formato=html&print=true`, '_blank');
  };

  const handleEnviarEmail = () => {
    // TODO: Implementar envio por email
    alert(`Email será enviado para ${pedido.estabelecimento.email}`);
  };

  const handleDuplicarPedido = () => {
    // TODO: Implementar duplicação
    alert("Funcionalidade de duplicar pedido será implementada");
  };

  const handleIniciarPreparo = () => {
    // TODO: Implementar mudança de status
    alert("Pedido movido para 'Em Preparo'");
  };

  const handleCancelarPedido = () => {
    if (confirm("Tem certeza que deseja cancelar este pedido?")) {
      // TODO: Implementar cancelamento
      alert("Pedido cancelado");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-2xl font-bold">Pedido #{pedido.id}</h3>
            <p className="text-gray-600">{pedido.estabelecimento.nome}</p>
          </div>
          <div className="flex items-center space-x-3">
            <Badge 
              className={`${statusConfig[pedido.status as keyof typeof statusConfig]?.color} text-white px-3 py-1`}
            >
              {statusConfig[pedido.status as keyof typeof statusConfig]?.label}
            </Badge>
            <Button variant="ghost" onClick={onClose}>
              ✕
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {/* Informações do Pedido */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="mr-2">📋</span>
                  Dados do Pedido
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Número:</p>
                    <p className="font-semibold">#{pedido.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Status:</p>
                    <Badge className={`${statusConfig[pedido.status as keyof typeof statusConfig]?.color} text-white`}>
                      {statusConfig[pedido.status as keyof typeof statusConfig]?.label}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-gray-600">Data do Pedido:</p>
                    <p className="font-semibold">{formatDateTime(pedido.dataPedido, pedido.horaPedido)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Entrega Prevista:</p>
                    <p className="font-semibold">{formatDate(pedido.dataEntrega)}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Criado por:</p>
                    <p className="font-semibold">{pedido.quemCriou}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Total de Itens:</p>
                    <p className="font-semibold">{pedido.itensPedido.length}</p>
                  </div>
                </div>
                <div className="pt-3 border-t">
                  <p className="text-gray-600">Valor Total:</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(pedido.valorTotal)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="mr-2">🏢</span>
                  Estabelecimento
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600">Nome:</p>
                    <p className="font-semibold">{pedido.estabelecimento.nome}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Endereço:</p>
                    <p className="font-semibold">{pedido.estabelecimento.endereco}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Telefone:</p>
                    <p className="font-semibold">{pedido.estabelecimento.telefone}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Email:</p>
                    <p className="font-semibold">{pedido.estabelecimento.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Observações */}
          {pedido.observacoes && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <span className="mr-2">📝</span>
                  Observações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm bg-yellow-50 p-3 rounded-lg border-l-4 border-yellow-400">
                  {pedido.observacoes}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Lista Detalhada de Itens */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="mr-2">📦</span>
                  Itens do Pedido ({pedido.itensPedido.length})
                </div>
                <Badge variant="outline" className="text-lg px-3 py-1">
                  Total: {formatCurrency(pedido.valorTotal)}
                </Badge>
              </CardTitle>
              <CardDescription>
                Lista completa de todos os produtos solicitados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Preço Unitário</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status Item</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pedido.itensPedido.map((item, index) => (
                    <TableRow key={item.id} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{index + 1}</TableCell>
                      <TableCell className="font-medium">{item.produtoNome}</TableCell>
                      <TableCell className="text-right font-semibold">{item.quantidade}</TableCell>
                      <TableCell>{item.unidade}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.precoCustoUnitario)}</TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        {formatCurrency(item.precoCustoTotal)}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant="secondary" 
                          className={`${statusConfig[pedido.status as keyof typeof statusConfig]?.color} text-white`}
                        >
                          {statusConfig[pedido.status as keyof typeof statusConfig]?.label}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Resumo Financeiro */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Subtotal</p>
                    <p className="text-lg font-semibold">{formatCurrency(pedido.valorTotal)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Desconto</p>
                    <p className="text-lg font-semibold text-red-600">R$ 0,00</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Total Final</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(pedido.valorTotal)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ações do Pedido */}
          <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleImprimirPedido}>
                <span className="mr-2">🖨️</span>
                Imprimir Pedido
              </Button>
              <Button variant="outline" onClick={handleEnviarEmail}>
                <span className="mr-2">📧</span>
                Enviar por Email
              </Button>
              <Button variant="outline" onClick={handleDuplicarPedido}>
                <span className="mr-2">📋</span>
                Duplicar Pedido
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {pedido.status === "criado" && (
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleIniciarPreparo}>
                  <span className="mr-2">▶️</span>
                  Iniciar Preparo
                </Button>
              )}
              {pedido.status !== "cancelado" && pedido.status !== "entrega_concluida" && (
                <Button variant="destructive" onClick={handleCancelarPedido}>
                  <span className="mr-2">❌</span>
                  Cancelar Pedido
                </Button>
              )}
              <Button onClick={onClose}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}