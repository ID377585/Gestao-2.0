"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Interface para ingredientes da ficha técnica
interface Ingrediente {
  id: number;
  nome: string;
  quantidade: number;
  unidade: string;
  precoUnitario: number;
  custoIngrediente: number;
  fatorCorrecao: number;
  fatorCoccao: number;
}

// Interface para ficha técnica
interface FichaTecnica {
  id: number;
  nome: string;
  categoria: string;
  rendimento: number;
  pesoPorcao: number;
  tempoPreparo: number;
  custoTotal: number;
  custoPorPorcao: number;
  margemLucro: number;
  precoVenda: number;
  ingredientes: Ingrediente[];
}

// Dados de exemplo
const fichasTecnicasExemplo: FichaTecnica[] = [
  {
    id: 1,
    nome: "Pão Francês",
    categoria: "Panificação",
    rendimento: 50,
    pesoPorcao: 50,
    tempoPreparo: 180,
    custoTotal: 12.50,
    custoPorPorcao: 0.25,
    margemLucro: 200,
    precoVenda: 0.75,
    ingredientes: [
      { id: 1, nome: "Farinha de Trigo", quantidade: 1000, unidade: "g", precoUnitario: 4.50, custoIngrediente: 4.50, fatorCorrecao: 1.0, fatorCoccao: 0.9 },
      { id: 2, nome: "Água", quantidade: 600, unidade: "ml", precoUnitario: 0.01, custoIngrediente: 0.60, fatorCorrecao: 1.0, fatorCoccao: 1.0 },
      { id: 3, nome: "Fermento Biológico", quantidade: 20, unidade: "g", precoUnitario: 12.00, custoIngrediente: 2.40, fatorCorrecao: 1.0, fatorCoccao: 1.0 },
      { id: 4, nome: "Sal", quantidade: 20, unidade: "g", precoUnitario: 2.10, custoIngrediente: 0.42, fatorCorrecao: 1.0, fatorCoccao: 1.0 }
    ]
  },
  {
    id: 2,
    nome: "Bolo de Chocolate",
    categoria: "Confeitaria",
    rendimento: 12,
    pesoPorcao: 80,
    tempoPreparo: 90,
    custoTotal: 18.75,
    custoPorPorcao: 1.56,
    margemLucro: 180,
    precoVenda: 4.37,
    ingredientes: [
      { id: 5, nome: "Farinha de Trigo", quantidade: 300, unidade: "g", precoUnitario: 4.50, custoIngrediente: 1.35, fatorCorrecao: 1.0, fatorCoccao: 1.0 },
      { id: 6, nome: "Açúcar", quantidade: 200, unidade: "g", precoUnitario: 3.20, custoIngrediente: 0.64, fatorCorrecao: 1.0, fatorCoccao: 1.0 },
      { id: 7, nome: "Ovos", quantidade: 3, unidade: "un", precoUnitario: 0.45, custoIngrediente: 1.35, fatorCorrecao: 1.0, fatorCoccao: 1.0 },
      { id: 8, nome: "Chocolate em Pó", quantidade: 100, unidade: "g", precoUnitario: 15.00, custoIngrediente: 1.50, fatorCorrecao: 1.0, fatorCoccao: 1.0 }
    ]
  }
];

export default function FichasTecnicasPage() {
  const [fichasTecnicas] = useState(fichasTecnicasExemplo);
  const [fichaSelecionada, setFichaSelecionada] = useState<FichaTecnica | null>(null);
  const [showNovaFicha, setShowNovaFicha] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const calcularCMV = (custoPorPorcao: number, precoVenda: number) => {
    return ((custoPorPorcao / precoVenda) * 100).toFixed(1);
  };

  const calcularLucroUnitario = (precoVenda: number, custoPorPorcao: number) => {
    return precoVenda - custoPorPorcao;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fichas Técnicas</h1>
          <p className="text-gray-600">Receitas com cálculo automático de custos e CMV</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <span className="mr-2">📊</span>
            Relatório de Custos
          </Button>
          <Button onClick={() => setShowNovaFicha(true)}>
            <span className="mr-2">➕</span>
            Nova Ficha Técnica
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Receitas</CardTitle>
            <span className="text-2xl">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fichasTecnicas.length}</div>
            <p className="text-xs text-muted-foreground">
              Receitas cadastradas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Médio</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(fichasTecnicas.reduce((acc, f) => acc + f.custoPorPorcao, 0) / fichasTecnicas.length)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por porção
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV Médio</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(fichasTecnicas.reduce((acc, f) => acc + parseFloat(calcularCMV(f.custoPorPorcao, f.precoVenda)), 0) / fichasTecnicas.length).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Custo da mercadoria vendida
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Média</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(fichasTecnicas.reduce((acc, f) => acc + f.margemLucro, 0) / fichasTecnicas.length).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Margem de lucro
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Fichas Técnicas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {fichasTecnicas.map((ficha) => (
          <Card key={ficha.id} className="hover:shadow-lg transition-shadow cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{ficha.nome}</CardTitle>
                  <CardDescription>{ficha.categoria}</CardDescription>
                </div>
                <Badge variant="secondary">
                  {ficha.rendimento} porções
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Custo por porção:</p>
                  <p className="font-bold text-red-600">{formatCurrency(ficha.custoPorPorcao)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Preço de venda:</p>
                  <p className="font-bold text-green-600">{formatCurrency(ficha.precoVenda)}</p>
                </div>
                <div>
                  <p className="text-gray-600">CMV:</p>
                  <p className="font-bold">{calcularCMV(ficha.custoPorPorcao, ficha.precoVenda)}%</p>
                </div>
                <div>
                  <p className="text-gray-600">Lucro unitário:</p>
                  <p className="font-bold text-blue-600">
                    {formatCurrency(calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao))}
                  </p>
                </div>
              </div>
              
              <div className="text-sm text-gray-600">
                <p>⏱️ Tempo: {ficha.tempoPreparo}min</p>
                <p>⚖️ Peso por porção: {ficha.pesoPorcao}g</p>
                <p>🧾 Ingredientes: {ficha.ingredientes.length}</p>
              </div>

              <div className="flex space-x-2">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button 
                      size="sm" 
                      className="flex-1"
                      onClick={() => setFichaSelecionada(ficha)}
                    >
                      Ver Detalhes
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{ficha.nome}</DialogTitle>
                      <DialogDescription>
                        Ficha técnica completa com ingredientes e custos
                      </DialogDescription>
                    </DialogHeader>
                    
                    {fichaSelecionada && (
                      <div className="space-y-6">
                        {/* Informações Gerais */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label>Categoria</Label>
                            <p className="font-medium">{fichaSelecionada.categoria}</p>
                          </div>
                          <div>
                            <Label>Rendimento</Label>
                            <p className="font-medium">{fichaSelecionada.rendimento} porções</p>
                          </div>
                          <div>
                            <Label>Peso por Porção</Label>
                            <p className="font-medium">{fichaSelecionada.pesoPorcao}g</p>
                          </div>
                          <div>
                            <Label>Tempo de Preparo</Label>
                            <p className="font-medium">{fichaSelecionada.tempoPreparo}min</p>
                          </div>
                        </div>

                        {/* Custos */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                          <div>
                            <Label>Custo Total</Label>
                            <p className="font-bold text-red-600">{formatCurrency(fichaSelecionada.custoTotal)}</p>
                          </div>
                          <div>
                            <Label>Custo por Porção</Label>
                            <p className="font-bold text-red-600">{formatCurrency(fichaSelecionada.custoPorPorcao)}</p>
                          </div>
                          <div>
                            <Label>Preço de Venda</Label>
                            <p className="font-bold text-green-600">{formatCurrency(fichaSelecionada.precoVenda)}</p>
                          </div>
                          <div>
                            <Label>CMV</Label>
                            <p className="font-bold">{calcularCMV(fichaSelecionada.custoPorPorcao, fichaSelecionada.precoVenda)}%</p>
                          </div>
                        </div>

                        {/* Ingredientes */}
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Ingredientes</h3>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ingrediente</TableHead>
                                <TableHead>Quantidade</TableHead>
                                <TableHead>Preço Unit.</TableHead>
                                <TableHead>Custo</TableHead>
                                <TableHead>F. Correção</TableHead>
                                <TableHead>F. Cocção</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {fichaSelecionada.ingredientes.map((ingrediente) => (
                                <TableRow key={ingrediente.id}>
                                  <TableCell className="font-medium">{ingrediente.nome}</TableCell>
                                  <TableCell>{ingrediente.quantidade} {ingrediente.unidade}</TableCell>
                                  <TableCell>{formatCurrency(ingrediente.precoUnitario)}</TableCell>
                                  <TableCell className="font-medium text-red-600">
                                    {formatCurrency(ingrediente.custoIngrediente)}
                                  </TableCell>
                                  <TableCell>{ingrediente.fatorCorrecao.toFixed(3)}</TableCell>
                                  <TableCell>{ingrediente.fatorCoccao.toFixed(3)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Análise de Rentabilidade */}
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <h3 className="text-lg font-semibold mb-2">Análise de Rentabilidade</h3>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-sm text-gray-600">Margem de Lucro</p>
                              <p className="text-xl font-bold text-blue-600">{fichaSelecionada.margemLucro}%</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Lucro por Porção</p>
                              <p className="text-xl font-bold text-green-600">
                                {formatCurrency(calcularLucroUnitario(fichaSelecionada.precoVenda, fichaSelecionada.custoPorPorcao))}
                              </p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Lucro Total (Receita)</p>
                              <p className="text-xl font-bold text-purple-600">
                                {formatCurrency(calcularLucroUnitario(fichaSelecionada.precoVenda, fichaSelecionada.custoPorPorcao) * fichaSelecionada.rendimento)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
                
                <Button size="sm" variant="outline">
                  ✏️
                </Button>
                <Button size="sm" variant="outline">
                  🖨️
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Modal Nova Ficha Técnica */}
      {showNovaFicha && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Nova Ficha Técnica</h3>
              <Button variant="ghost" onClick={() => setShowNovaFicha(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="nome">Nome da Receita</Label>
                  <Input id="nome" placeholder="Ex: Pão de Açúcar" />
                </div>
                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input id="categoria" placeholder="Ex: Panificação" />
                </div>
                <div>
                  <Label htmlFor="rendimento">Rendimento (porções)</Label>
                  <Input id="rendimento" type="number" placeholder="Ex: 20" />
                </div>
                <div>
                  <Label htmlFor="peso">Peso por Porção (g)</Label>
                  <Input id="peso" type="number" placeholder="Ex: 50" />
                </div>
                <div>
                  <Label htmlFor="tempo">Tempo de Preparo (min)</Label>
                  <Input id="tempo" type="number" placeholder="Ex: 120" />
                </div>
                <div>
                  <Label htmlFor="margem">Margem de Lucro (%)</Label>
                  <Input id="margem" type="number" placeholder="Ex: 200" />
                </div>
              </div>

              <div>
                <Label htmlFor="modo">Modo de Preparo</Label>
                <Textarea 
                  id="modo" 
                  placeholder="Descreva o modo de preparo da receita..."
                  rows={4}
                />
              </div>

              {/* Ingredientes */}
              <div>
                <h4 className="text-lg font-semibold mb-4">Ingredientes</h4>
                <div className="border rounded-lg p-4">
                  <div className="grid grid-cols-6 gap-2 mb-4">
                    <Input placeholder="Ingrediente" />
                    <Input placeholder="Qtd" type="number" />
                    <Input placeholder="Unidade" />
                    <Input placeholder="Preço" type="number" step="0.01" />
                    <Input placeholder="F.Correção" type="number" step="0.001" defaultValue="1.000" />
                    <Button size="sm">➕</Button>
                  </div>
                  <p className="text-sm text-gray-600">
                    Nenhum ingrediente adicionado ainda.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowNovaFicha(false)}>
                  Cancelar
                </Button>
                <Button>
                  Salvar Ficha Técnica
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}