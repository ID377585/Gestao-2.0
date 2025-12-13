"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Interfaces
interface Estabelecimento {
  id: number;
  nome: string;
  prazoEntregaDias: number;
  endereco: string;
  telefone: string;
}

interface Insumo {
  id: number;
  nome: string;
  unidade: string;
  precoCompra: number;
  categoria: string;
  estoqueAtual: number;
}

interface ItemPedido {
  id: number;
  insumoId: number;
  produtoNome: string;
  quantidade: number;
  unidade: string;
  precoCustoUnitario: number;
  precoCustoTotal: number;
}

interface Pedido {
  id: number;
  estabelecimento: string;
  dataEntrega: string;
  valorTotal: number;
  status: string;
  itens: number;
  progresso: number;
}

// Dados de exemplo para estabelecimentos
const estabelecimentosExemplo: Estabelecimento[] = [
  {
    id: 1,
    nome: "Restaurante Bella Vista",
    prazoEntregaDias: 2,
    endereco: "Rua das Flores, 123",
    telefone: "(11) 1234-5678"
  },
  {
    id: 2,
    nome: "Padaria São João",
    prazoEntregaDias: 1,
    endereco: "Av. Principal, 456",
    telefone: "(11) 9876-5432"
  },
  {
    id: 3,
    nome: "Hotel Cinco Estrelas",
    prazoEntregaDias: 3,
    endereco: "Rua Hoteleira, 789",
    telefone: "(11) 1111-2222"
  }
];

// Dados de exemplo para insumos
const insumosExemplo: Insumo[] = [
  {
    id: 1,
    nome: "Farinha de Trigo",
    unidade: "kg",
    precoCompra: 4.50,
    categoria: "Farinhas",
    estoqueAtual: 25.5
  },
  {
    id: 2,
    nome: "Açúcar Cristal",
    unidade: "kg",
    precoCompra: 3.20,
    categoria: "Açúcares",
    estoqueAtual: 18.2
  },
  {
    id: 3,
    nome: "Ovos",
    unidade: "un",
    precoCompra: 0.45,
    categoria: "Proteínas",
    estoqueAtual: 120
  },
  {
    id: 4,
    nome: "Leite Integral",
    unidade: "lt",
    precoCompra: 4.80,
    categoria: "Laticínios",
    estoqueAtual: 22.0
  },
  {
    id: 5,
    nome: "Manteiga",
    unidade: "kg",
    precoCompra: 18.90,
    categoria: "Laticínios",
    estoqueAtual: 4.5
  },
  {
    id: 6,
    nome: "Fermento Biológico",
    unidade: "kg",
    precoCompra: 12.00,
    categoria: "Fermentos",
    estoqueAtual: 2.8
  },
  {
    id: 7,
    nome: "Sal Refinado",
    unidade: "kg",
    precoCompra: 2.10,
    categoria: "Temperos",
    estoqueAtual: 6.0
  }
];

// Dados de exemplo para demonstração
const pedidosExemplo: Pedido[] = [
  {
    id: 1,
    estabelecimento: "Restaurante Bella Vista",
    dataEntrega: "2024-01-15",
    valorTotal: 450.80,
    status: "criado",
    itens: 8,
    progresso: 10
  },
  {
    id: 2,
    estabelecimento: "Padaria São João",
    dataEntrega: "2024-01-14",
    valorTotal: 280.50,
    status: "em_preparo",
    itens: 5,
    progresso: 35
  },
  {
    id: 3,
    estabelecimento: "Hotel Cinco Estrelas",
    dataEntrega: "2024-01-16",
    valorTotal: 1250.00,
    status: "separacao",
    itens: 15,
    progresso: 60
  },
  {
    id: 4,
    estabelecimento: "Restaurante Bella Vista",
    dataEntrega: "2024-01-13",
    valorTotal: 320.75,
    status: "conferencia",
    itens: 6,
    progresso: 80
  },
  {
    id: 5,
    estabelecimento: "Padaria São João",
    dataEntrega: "2024-01-12",
    valorTotal: 180.30,
    status: "saiu_entrega",
    itens: 4,
    progresso: 95
  }
];

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

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosExemplo);
  const [showNewPedidoForm, setShowNewPedidoForm] = useState(false);
  
  // Estados do formulário
  const [estabelecimentoSelecionado, setEstabelecimentoSelecionado] = useState<Estabelecimento | null>(null);
  const [itensPedido, setItensPedido] = useState<ItemPedido[]>([]);
  const [observacoes, setObservacoes] = useState("");
  
  // Estados para adicionar item
  const [insumoSelecionado, setInsumoSelecionado] = useState<Insumo | null>(null);
  const [quantidadeItem, setQuantidadeItem] = useState("");

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

  // Funções do formulário
  const calcularDataEntrega = (estabelecimento: Estabelecimento) => {
    const hoje = new Date();
    hoje.setDate(hoje.getDate() + estabelecimento.prazoEntregaDias);
    return hoje.toISOString().split('T')[0];
  };

  const calcularValorTotalPedido = () => {
    return itensPedido.reduce((acc, item) => acc + item.precoCustoTotal, 0);
  };

  const adicionarItem = () => {
    if (!insumoSelecionado || !quantidadeItem || parseFloat(quantidadeItem) <= 0) {
      alert("Selecione um produto e informe uma quantidade válida");
      return;
    }

    const quantidade = parseFloat(quantidadeItem);
    const precoCustoUnitario = insumoSelecionado.precoCompra;
    const precoCustoTotal = quantidade * precoCustoUnitario;

    // Verificar estoque
    if (quantidade > insumoSelecionado.estoqueAtual) {
      alert(`Estoque insuficiente! Disponível: ${insumoSelecionado.estoqueAtual} ${insumoSelecionado.unidade}`);
      return;
    }

    const novoItem: ItemPedido = {
      id: Date.now(),
      insumoId: insumoSelecionado.id,
      produtoNome: insumoSelecionado.nome,
      quantidade,
      unidade: insumoSelecionado.unidade,
      precoCustoUnitario,
      precoCustoTotal
    };

    setItensPedido(prev => [...prev, novoItem]);
    setInsumoSelecionado(null);
    setQuantidadeItem("");
  };

  const removerItem = (itemId: number) => {
    setItensPedido(prev => prev.filter(item => item.id !== itemId));
  };

  const registrarPedido = () => {
    if (!estabelecimentoSelecionado) {
      alert("Selecione um estabelecimento");
      return;
    }

    if (itensPedido.length === 0) {
      alert("Adicione pelo menos um item ao pedido");
      return;
    }

    const novoPedido: Pedido = {
      id: Math.max(...pedidos.map(p => p.id)) + 1,
      estabelecimento: estabelecimentoSelecionado.nome,
      dataEntrega: calcularDataEntrega(estabelecimentoSelecionado),
      valorTotal: calcularValorTotalPedido(),
      status: "criado",
      itens: itensPedido.length,
      progresso: 10
    };

    setPedidos(prev => [...prev, novoPedido]);
    
    // Limpar formulário
    setEstabelecimentoSelecionado(null);
    setItensPedido([]);
    setObservacoes("");
    setShowNewPedidoForm(false);

    alert(`Pedido #${novoPedido.id} criado com sucesso!\nValor: ${formatCurrency(novoPedido.valorTotal)}\nEntrega: ${formatDate(novoPedido.dataEntrega)}`);
  };

  const cancelarPedido = () => {
    setEstabelecimentoSelecionado(null);
    setItensPedido([]);
    setObservacoes("");
    setInsumoSelecionado(null);
    setQuantidadeItem("");
    setShowNewPedidoForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-600">Kanban de acompanhamento de pedidos em tempo real</p>
        </div>
        <Button 
          onClick={() => setShowNewPedidoForm(true)}
          className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
        >
          <span className="mr-2">➕</span>
          Gerar Pedido
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            <span className="text-2xl">📋</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pedidos.length}</div>
            <p className="text-xs text-muted-foreground">
              +2 desde ontem
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Produção</CardTitle>
            <span className="text-2xl">⚡</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getPedidosPorStatus('em_preparo').length + getPedidosPorStatus('separacao').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Pedidos ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(pedidos.reduce((acc, p) => acc + p.valorTotal, 0))}
            </div>
            <p className="text-xs text-muted-foreground">
              Valor dos pedidos ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregas Hoje</CardTitle>
            <span className="text-2xl">🚚</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pedidos.filter(p => p.dataEntrega === "2024-01-15").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Para hoje
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <div className="bg-white rounded-lg border">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4">Kanban de Pedidos</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 min-h-[600px]">
            {colunas.map((coluna) => (
              <div key={coluna.key} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">{coluna.title}</h3>
                  <Badge variant="secondary">
                    {getPedidosPorStatus(coluna.key).length}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {getPedidosPorStatus(coluna.key).map((pedido) => (
                    <Card key={pedido.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">#{pedido.id}</CardTitle>
                          <Badge 
                            variant="secondary" 
                            className={`${statusConfig[pedido.status as keyof typeof statusConfig]?.color} text-white`}
                          >
                            {statusConfig[pedido.status as keyof typeof statusConfig]?.label}
                          </Badge>
                        </div>
                        <CardDescription className="text-xs">
                          {pedido.estabelecimento}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Valor:</span>
                            <span className="font-medium">{formatCurrency(pedido.valorTotal)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Itens:</span>
                            <span>{pedido.itens}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Entrega:</span>
                            <span>{formatDate(pedido.dataEntrega)}</span>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>Progresso:</span>
                              <span>{pedido.progresso}%</span>
                            </div>
                            <Progress value={pedido.progresso} className="h-2" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de Novo Pedido - Funcional */}
      {showNewPedidoForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Gerar Novo Pedido</h3>
              <Button variant="ghost" onClick={() => setShowNewPedidoForm(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              {/* Seleção de Estabelecimento */}
              <div>
                <Label>Estabelecimento *</Label>
                <Select 
                  value={estabelecimentoSelecionado?.id.toString() || ""} 
                  onValueChange={(value) => {
                    const estabelecimento = estabelecimentosExemplo.find(e => e.id.toString() === value);
                    setEstabelecimentoSelecionado(estabelecimento || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar estabelecimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {estabelecimentosExemplo.map((estabelecimento) => (
                      <SelectItem key={estabelecimento.id} value={estabelecimento.id.toString()}>
                        {estabelecimento.nome} - Entrega em {estabelecimento.prazoEntregaDias} dia(s)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {estabelecimentoSelecionado && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                    <p><strong>Endereço:</strong> {estabelecimentoSelecionado.endereco}</p>
                    <p><strong>Telefone:</strong> {estabelecimentoSelecionado.telefone}</p>
                    <p><strong>Data de Entrega:</strong> {formatDate(calcularDataEntrega(estabelecimentoSelecionado))}</p>
                  </div>
                )}
              </div>

              {/* Adicionar Itens */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-4">Adicionar Itens ao Pedido</h4>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label>Produto</Label>
                    <Select 
                      value={insumoSelecionado?.id.toString() || ""} 
                      onValueChange={(value) => {
                        const insumo = insumosExemplo.find(i => i.id.toString() === value);
                        setInsumoSelecionado(insumo || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {insumosExemplo.map((insumo) => (
                          <SelectItem key={insumo.id} value={insumo.id.toString()}>
                            {insumo.nome} - {formatCurrency(insumo.precoCompra)}/{insumo.unidade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {insumoSelecionado && (
                      <div className="mt-1 text-xs text-gray-600">
                        Estoque: {insumoSelecionado.estoqueAtual} {insumoSelecionado.unidade}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <Label>Quantidade</Label>
                    <Input 
                      type="number" 
                      step="0.1"
                      value={quantidadeItem}
                      onChange={(e) => setQuantidadeItem(e.target.value)}
                      placeholder="0"
                    />
                    {insumoSelecionado && (
                      <div className="mt-1 text-xs text-gray-600">
                        Unidade: {insumoSelecionado.unidade}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-end">
                    <Button onClick={adicionarItem} className="w-full">
                      <span className="mr-2">➕</span>
                      Adicionar
                    </Button>
                  </div>
                </div>

                {/* Preview do Custo */}
                {insumoSelecionado && quantidadeItem && parseFloat(quantidadeItem) > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg text-sm">
                    <p><strong>Preview:</strong> {parseFloat(quantidadeItem)} {insumoSelecionado.unidade} × {formatCurrency(insumoSelecionado.precoCompra)} = <strong>{formatCurrency(parseFloat(quantidadeItem) * insumoSelecionado.precoCompra)}</strong></p>
                  </div>
                )}
              </div>

              {/* Lista de Itens Adicionados */}
              {itensPedido.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-4">Itens do Pedido ({itensPedido.length})</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Quantidade</TableHead>
                        <TableHead>Preço Unit.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itensPedido.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.produtoNome}</TableCell>
                          <TableCell>{item.quantidade} {item.unidade}</TableCell>
                          <TableCell>{formatCurrency(item.precoCustoUnitario)}</TableCell>
                          <TableCell className="font-medium text-green-600">
                            {formatCurrency(item.precoCustoTotal)}
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => removerItem(item.id)}
                            >
                              🗑️
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {/* Total do Pedido */}
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Valor Total do Pedido:</span>
                      <span className="text-2xl font-bold text-green-600">
                        {formatCurrency(calcularValorTotalPedido())}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Observações */}
              <div>
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea 
                  id="observacoes"
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Observações adicionais sobre o pedido..."
                  rows={3}
                />
              </div>

              {/* Resumo do Pedido */}
              {estabelecimentoSelecionado && itensPedido.length > 0 && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-semibold mb-2">Resumo do Pedido</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p><strong>Estabelecimento:</strong> {estabelecimentoSelecionado.nome}</p>
                      <p><strong>Data de Entrega:</strong> {formatDate(calcularDataEntrega(estabelecimentoSelecionado))}</p>
                    </div>
                    <div>
                      <p><strong>Total de Itens:</strong> {itensPedido.length}</p>
                      <p><strong>Valor Total:</strong> {formatCurrency(calcularValorTotalPedido())}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={cancelarPedido}>
                  Cancelar
                </Button>
                <Button 
                  onClick={registrarPedido}
                  disabled={!estabelecimentoSelecionado || itensPedido.length === 0}
                  className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                >
                  <span className="mr-2">💾</span>
                  Registrar Pedido
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}