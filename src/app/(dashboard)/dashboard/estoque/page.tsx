"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Dados de exemplo para estoque
const estoqueExemplo = [
  {
    id: 1,
    produto: "Farinha de Trigo",
    quantidade: 25.5,
    unidade: "kg",
    minimo: 10,
    medio: 25,
    maximo: 50,
    valor: 4.50,
    local: "Estoque Seco",
    status: "normal"
  },
  {
    id: 2,
    produto: "Açúcar Cristal",
    quantidade: 8.2,
    unidade: "kg",
    minimo: 5,
    medio: 15,
    maximo: 30,
    valor: 3.20,
    local: "Estoque Seco",
    status: "baixo"
  },
  {
    id: 3,
    produto: "Ovos",
    quantidade: 45,
    unidade: "un",
    minimo: 50,
    medio: 100,
    maximo: 200,
    valor: 0.45,
    local: "Geladeira",
    status: "critico"
  },
  {
    id: 4,
    produto: "Leite Integral",
    quantidade: 22.0,
    unidade: "lt",
    minimo: 10,
    medio: 20,
    maximo: 40,
    valor: 4.80,
    local: "Geladeira",
    status: "normal"
  },
  {
    id: 5,
    produto: "Manteiga",
    quantidade: 4.5,
    unidade: "kg",
    minimo: 2,
    medio: 5,
    maximo: 10,
    valor: 18.90,
    local: "Geladeira",
    status: "normal"
  }
];

const statusConfig = {
  critico: { label: "Crítico", color: "bg-red-500", textColor: "text-red-700" },
  baixo: { label: "Baixo", color: "bg-yellow-500", textColor: "text-yellow-700" },
  normal: { label: "Normal", color: "bg-green-500", textColor: "text-green-700" }
};

export default function EstoquePage() {
  const [estoque] = useState(estoqueExemplo);
  const [showInventario, setShowInventario] = useState(false);
  const [inventarioAtivo, setInventarioAtivo] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const calcularValorTotal = () => {
    return estoque.reduce((acc, item) => acc + (item.quantidade * item.valor), 0);
  };

  const getItensPorStatus = (status: string) => {
    return estoque.filter(item => item.status === status);
  };

  const iniciarInventario = () => {
    setInventarioAtivo(true);
    setShowInventario(true);
  };

  const encerrarInventario = () => {
    setInventarioAtivo(false);
    setShowInventario(false);
    // TODO: Implementar lógica de encerramento
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Estoque</h1>
          <p className="text-gray-600">Controle de estoque atual e inventário</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <span className="mr-2">📥</span>
            Entrada
          </Button>
          <Button variant="outline">
            <span className="mr-2">📤</span>
            Saída
          </Button>
          <Button onClick={iniciarInventario}>
            <span className="mr-2">📋</span>
            {inventarioAtivo ? "Continuar Inventário" : "Iniciar Inventário"}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <span className="text-2xl">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{estoque.length}</div>
            <p className="text-xs text-muted-foreground">
              Produtos cadastrados
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(calcularValorTotal())}</div>
            <p className="text-xs text-muted-foreground">
              Valor do estoque
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Crítico</CardTitle>
            <span className="text-2xl">🚨</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {getItensPorStatus('critico').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Itens abaixo do mínimo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Baixo</CardTitle>
            <span className="text-2xl">⚠️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {getItensPorStatus('baixo').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Itens próximos ao mínimo
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {(getItensPorStatus('critico').length > 0 || getItensPorStatus('baixo').length > 0) && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-yellow-800">⚠️ Alertas de Estoque</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {getItensPorStatus('critico').length > 0 && (
                <p className="text-sm text-red-700">
                  <strong>{getItensPorStatus('critico').length} itens</strong> estão com estoque crítico e precisam de reposição urgente.
                </p>
              )}
              {getItensPorStatus('baixo').length > 0 && (
                <p className="text-sm text-yellow-700">
                  <strong>{getItensPorStatus('baixo').length} itens</strong> estão com estoque baixo.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Estoque */}
      <Card>
        <CardHeader>
          <CardTitle>Estoque Atual</CardTitle>
          <CardDescription>
            Lista completa de produtos em estoque
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Mín/Méd/Máx</TableHead>
                <TableHead>Valor Unit.</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estoque.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.produto}</TableCell>
                  <TableCell>
                    {item.quantidade} {item.unidade}
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {item.minimo}/{item.medio}/{item.maximo}
                  </TableCell>
                  <TableCell>{formatCurrency(item.valor)}</TableCell>
                  <TableCell>{formatCurrency(item.quantidade * item.valor)}</TableCell>
                  <TableCell>{item.local}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="secondary" 
                      className={`${statusConfig[item.status as keyof typeof statusConfig]?.color} text-white`}
                    >
                      {statusConfig[item.status as keyof typeof statusConfig]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button size="sm" variant="outline">
                        ✏️
                      </Button>
                      <Button size="sm" variant="outline">
                        📊
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Inventário */}
      {showInventario && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                {inventarioAtivo ? "Inventário em Andamento" : "Iniciar Inventário"}
              </h3>
              <Button variant="ghost" onClick={() => setShowInventario(false)}>
                ✕
              </Button>
            </div>

            {!inventarioAtivo ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="local">Local/Setor</Label>
                    <Input id="local" placeholder="Ex: Estoque Seco" />
                  </div>
                  <div>
                    <Label htmlFor="responsavel">Responsável</Label>
                    <Input id="responsavel" value="Admin User" disabled />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowInventario(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={iniciarInventario}>
                    Iniciar Contagem
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>Inventário iniciado!</strong> Adicione os itens contados abaixo.
                  </p>
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="produto">Produto</Label>
                    <Input id="produto" placeholder="Nome do produto" />
                  </div>
                  <div>
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input id="quantidade" type="number" placeholder="0" />
                  </div>
                  <div>
                    <Label htmlFor="unidade">Unidade</Label>
                    <Input id="unidade" placeholder="kg, un, lt" />
                  </div>
                </div>

                <Button className="w-full">
                  <span className="mr-2">➕</span>
                  Adicionar Item
                </Button>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Itens Contados (0)</h4>
                  <p className="text-sm text-gray-600">
                    Nenhum item foi contado ainda.
                  </p>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowInventario(false)}>
                    Fechar
                  </Button>
                  <Button variant="destructive" onClick={encerrarInventario}>
                    Encerrar Inventário
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}