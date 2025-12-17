"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    custoTotal: 12.5,
    custoPorPorcao: 0.25,
    margemLucro: 200,
    precoVenda: 0.75,
    ingredientes: [
      {
        id: 1,
        nome: "Farinha de Trigo",
        quantidade: 1000,
        unidade: "g",
        precoUnitario: 4.5,
        custoIngrediente: 4.5,
        fatorCorrecao: 1.0,
        fatorCoccao: 0.9,
      },
      {
        id: 2,
        nome: "Água",
        quantidade: 600,
        unidade: "ml",
        precoUnitario: 0.01,
        custoIngrediente: 0.6,
        fatorCorrecao: 1.0,
        fatorCoccao: 1.0,
      },
      {
        id: 3,
        nome: "Fermento Biológico",
        quantidade: 20,
        unidade: "g",
        precoUnitario: 12.0,
        custoIngrediente: 2.4,
        fatorCorrecao: 1.0,
        fatorCoccao: 1.0,
      },
      {
        id: 4,
        nome: "Sal",
        quantidade: 20,
        unidade: "g",
        precoUnitario: 2.1,
        custoIngrediente: 0.42,
        fatorCorrecao: 1.0,
        fatorCoccao: 1.0,
      },
    ],
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
      {
        id: 5,
        nome: "Farinha de Trigo",
        quantidade: 300,
        unidade: "g",
        precoUnitario: 4.5,
        custoIngrediente: 1.35,
        fatorCorrecao: 1.0,
        fatorCoccao: 1.0,
      },
      {
        id: 6,
        nome: "Açúcar",
        quantidade: 200,
        unidade: "g",
        precoUnitario: 3.2,
        custoIngrediente: 0.64,
        fatorCorrecao: 1.0,
        fatorCoccao: 1.0,
      },
      {
        id: 7,
        nome: "Ovos",
        quantidade: 3,
        unidade: "un",
        precoUnitario: 0.45,
        custoIngrediente: 1.35,
        fatorCorrecao: 1.0,
        fatorCoccao: 1.0,
      },
      {
        id: 8,
        nome: "Chocolate em Pó",
        quantidade: 100,
        unidade: "g",
        precoUnitario: 15.0,
        custoIngrediente: 1.5,
        fatorCorrecao: 1.0,
        fatorCoccao: 1.0,
      },
    ],
  },
];

export default function FichasTecnicasPage() {
  const [fichasTecnicas, setFichasTecnicas] = useState<FichaTecnica[]>(
    fichasTecnicasExemplo
  );

  const [fichaSelecionada, setFichaSelecionada] = useState<FichaTecnica | null>(
    null
  );

  const [showNovaFicha, setShowNovaFicha] = useState(false);

  // ✅ Edição (modal)
  const [showEditarFicha, setShowEditarFicha] = useState(false);
  const [fichaEditando, setFichaEditando] = useState<FichaTecnica | null>(null);

  // Campos simples de edição (exemplo)
  const [editNome, setEditNome] = useState("");
  const [editCategoria, setEditCategoria] = useState("");
  const [editRendimento, setEditRendimento] = useState<number>(0);
  const [editPesoPorcao, setEditPesoPorcao] = useState<number>(0);
  const [editTempoPreparo, setEditTempoPreparo] = useState<number>(0);
  const [editMargemLucro, setEditMargemLucro] = useState<number>(0);
  const [editPrecoVenda, setEditPrecoVenda] = useState<number>(0);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const calcularCMV = (custoPorPorcao: number, precoVenda: number) => {
    if (!precoVenda) return "0.0";
    return ((custoPorPorcao / precoVenda) * 100).toFixed(1);
  };

  const calcularLucroUnitario = (precoVenda: number, custoPorPorcao: number) =>
    precoVenda - custoPorPorcao;

  const custoMedio = useMemo(() => {
    if (!fichasTecnicas.length) return 0;
    return (
      fichasTecnicas.reduce((acc, f) => acc + f.custoPorPorcao, 0) /
      fichasTecnicas.length
    );
  }, [fichasTecnicas]);

  const cmvMedio = useMemo(() => {
    if (!fichasTecnicas.length) return 0;
    return (
      fichasTecnicas.reduce(
        (acc, f) => acc + parseFloat(calcularCMV(f.custoPorPorcao, f.precoVenda)),
        0
      ) / fichasTecnicas.length
    );
  }, [fichasTecnicas]);

  const margemMedia = useMemo(() => {
    if (!fichasTecnicas.length) return 0;
    return (
      fichasTecnicas.reduce((acc, f) => acc + f.margemLucro, 0) /
      fichasTecnicas.length
    );
  }, [fichasTecnicas]);

  // ✅ BOTÃO EDITAR: abre modal e já preenche campos
  const handleEditarFicha = (ficha: FichaTecnica) => {
    setFichaEditando(ficha);
    setEditNome(ficha.nome);
    setEditCategoria(ficha.categoria);
    setEditRendimento(ficha.rendimento);
    setEditPesoPorcao(ficha.pesoPorcao);
    setEditTempoPreparo(ficha.tempoPreparo);
    setEditMargemLucro(ficha.margemLucro);
    setEditPrecoVenda(ficha.precoVenda);
    setShowEditarFicha(true);
  };

  const salvarEdicaoFicha = () => {
    if (!fichaEditando) return;

    setFichasTecnicas((prev) =>
      prev.map((f) =>
        f.id === fichaEditando.id
          ? {
              ...f,
              nome: editNome,
              categoria: editCategoria,
              rendimento: editRendimento,
              pesoPorcao: editPesoPorcao,
              tempoPreparo: editTempoPreparo,
              margemLucro: editMargemLucro,
              precoVenda: editPrecoVenda,
            }
          : f
      )
    );

    setShowEditarFicha(false);
    setFichaEditando(null);
  };

  // ✅ BOTÃO IMPRIMIR: abre print preview real
  const handleImprimirFicha = (ficha: FichaTecnica) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Impressão - ${ficha.nome}</title>
<style>
  body{ font-family: Arial, sans-serif; padding: 24px; }
  h1{ margin: 0 0 6px 0; font-size: 22px; }
  .muted{ color:#555; margin:0 0 16px 0; }
  .grid{ display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .box{ border:1px solid #ddd; border-radius: 10px; padding: 10px; }
  .label{ font-size: 12px; color:#666; margin-bottom: 4px; }
  .value{ font-size: 14px; font-weight: 600; }
  table{ width: 100%; border-collapse: collapse; margin-top: 10px; }
  th,td{ border:1px solid #ddd; padding: 8px; font-size: 12px; }
  th{ background:#f5f5f5; text-align:left; }
  .right{ text-align:right; }
  @media print { body{ padding:0; } }
</style>
</head>
<body>
  <h1>${ficha.nome}</h1>
  <p class="muted">${ficha.categoria}</p>

  <div class="grid">
    <div class="box"><div class="label">Rendimento</div><div class="value">${ficha.rendimento} porções</div></div>
    <div class="box"><div class="label">Peso por porção</div><div class="value">${ficha.pesoPorcao} g</div></div>
    <div class="box"><div class="label">Tempo</div><div class="value">${ficha.tempoPreparo} min</div></div>
    <div class="box"><div class="label">Preço de venda</div><div class="value">${formatCurrency(ficha.precoVenda)}</div></div>
  </div>

  <div class="grid">
    <div class="box"><div class="label">Custo total</div><div class="value">${formatCurrency(ficha.custoTotal)}</div></div>
    <div class="box"><div class="label">Custo por porção</div><div class="value">${formatCurrency(ficha.custoPorPorcao)}</div></div>
    <div class="box"><div class="label">CMV</div><div class="value">${calcularCMV(
      ficha.custoPorPorcao,
      ficha.precoVenda
    )}%</div></div>
    <div class="box"><div class="label">Lucro unitário</div><div class="value">${formatCurrency(
      calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao)
    )}</div></div>
  </div>

  <h2 style="font-size:16px;margin:18px 0 8px 0;">Ingredientes</h2>
  <table>
    <thead>
      <tr>
        <th>Ingrediente</th>
        <th>Qtd</th>
        <th class="right">Preço Unit.</th>
        <th class="right">Custo</th>
        <th class="right">F. Correção</th>
        <th class="right">F. Cocção</th>
      </tr>
    </thead>
    <tbody>
      ${ficha.ingredientes
        .map(
          (i) => `
        <tr>
          <td>${i.nome}</td>
          <td>${i.quantidade} ${i.unidade}</td>
          <td class="right">${formatCurrency(i.precoUnitario)}</td>
          <td class="right">${formatCurrency(i.custoIngrediente)}</td>
          <td class="right">${i.fatorCorrecao.toFixed(3)}</td>
          <td class="right">${i.fatorCoccao.toFixed(3)}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <script>
    window.onload = () => {
      window.focus();
      window.print();
      // window.close(); // se quiser fechar automaticamente depois de imprimir
    }
  </script>
</body>
</html>
    `.trim();

    const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fichas Técnicas</h1>
          <p className="text-gray-600">
            Receitas com cálculo automático de custos e CMV
          </p>
        </div>
        <div className="flex space-x-2">
          <Button type="button" variant="outline">
            <span className="mr-2">📊</span>
            Relatório de Custos
          </Button>
          <Button type="button" onClick={() => setShowNovaFicha(true)}>
            <span className="mr-2">➕</span>
            Nova Ficha Técnica
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Receitas
            </CardTitle>
            <span className="text-2xl">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fichasTecnicas.length}</div>
            <p className="text-xs text-muted-foreground">Receitas cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Médio</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(custoMedio)}</div>
            <p className="text-xs text-muted-foreground">Por porção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV Médio</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cmvMedio.toFixed(1)}%</div>
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
            <div className="text-2xl font-bold">{margemMedia.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Margem de lucro</p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Fichas Técnicas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {fichasTecnicas.map((ficha) => (
          <Card key={ficha.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{ficha.nome}</CardTitle>
                  <CardDescription>{ficha.categoria}</CardDescription>
                </div>
                <Badge variant="secondary">{ficha.rendimento} porções</Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">Custo por porção:</p>
                  <p className="font-bold text-red-600">
                    {formatCurrency(ficha.custoPorPorcao)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Preço de venda:</p>
                  <p className="font-bold text-green-600">
                    {formatCurrency(ficha.precoVenda)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">CMV:</p>
                  <p className="font-bold">
                    {calcularCMV(ficha.custoPorPorcao, ficha.precoVenda)}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Lucro unitário:</p>
                  <p className="font-bold text-blue-600">
                    {formatCurrency(
                      calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao)
                    )}
                  </p>
                </div>
              </div>

              <div className="text-sm text-gray-600">
                <p>⏱️ Tempo: {ficha.tempoPreparo}min</p>
                <p>⚖️ Peso por porção: {ficha.pesoPorcao}g</p>
                <p>🧾 Ingredientes: {ficha.ingredientes.length}</p>
              </div>

              <div className="flex space-x-2">
                {/* Ver detalhes */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={() => setFichaSelecionada(ficha)}
                    >
                      Ver Detalhes
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white text-gray-900">
                    <DialogHeader>
                      <DialogTitle>{ficha.nome}</DialogTitle>
                      <DialogDescription>
                        Ficha técnica completa com ingredientes e custos
                      </DialogDescription>
                    </DialogHeader>

                    {fichaSelecionada && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div>
                            <Label>Categoria</Label>
                            <p className="font-medium">
                              {fichaSelecionada.categoria}
                            </p>
                          </div>
                          <div>
                            <Label>Rendimento</Label>
                            <p className="font-medium">
                              {fichaSelecionada.rendimento} porções
                            </p>
                          </div>
                          <div>
                            <Label>Peso por Porção</Label>
                            <p className="font-medium">
                              {fichaSelecionada.pesoPorcao}g
                            </p>
                          </div>
                          <div>
                            <Label>Tempo de Preparo</Label>
                            <p className="font-medium">
                              {fichaSelecionada.tempoPreparo}min
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                          <div>
                            <Label>Custo Total</Label>
                            <p className="font-bold text-red-600">
                              {formatCurrency(fichaSelecionada.custoTotal)}
                            </p>
                          </div>
                          <div>
                            <Label>Custo por Porção</Label>
                            <p className="font-bold text-red-600">
                              {formatCurrency(fichaSelecionada.custoPorPorcao)}
                            </p>
                          </div>
                          <div>
                            <Label>Preço de Venda</Label>
                            <p className="font-bold text-green-600">
                              {formatCurrency(fichaSelecionada.precoVenda)}
                            </p>
                          </div>
                          <div>
                            <Label>CMV</Label>
                            <p className="font-bold">
                              {calcularCMV(
                                fichaSelecionada.custoPorPorcao,
                                fichaSelecionada.precoVenda
                              )}
                              %
                            </p>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-lg font-semibold mb-4">
                            Ingredientes
                          </h3>
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
                                  <TableCell className="font-medium">
                                    {ingrediente.nome}
                                  </TableCell>
                                  <TableCell>
                                    {ingrediente.quantidade} {ingrediente.unidade}
                                  </TableCell>
                                  <TableCell>
                                    {formatCurrency(ingrediente.precoUnitario)}
                                  </TableCell>
                                  <TableCell className="font-medium text-red-600">
                                    {formatCurrency(ingrediente.custoIngrediente)}
                                  </TableCell>
                                  <TableCell>
                                    {ingrediente.fatorCorrecao.toFixed(3)}
                                  </TableCell>
                                  <TableCell>
                                    {ingrediente.fatorCoccao.toFixed(3)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                </Dialog>

                {/* ✏️ Editar (abre modal local e FUNCIONA agora) */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleEditarFicha(ficha);
                  }}
                  title="Editar ficha"
                >
                  ✏️
                </Button>

                {/* 🖨️ Imprimir (abre print preview real) */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleImprimirFicha(ficha);
                  }}
                  title="Imprimir ficha"
                >
                  🖨️
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ✅ Modal Editar Ficha */}
      {showEditarFicha && fichaEditando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-semibold">Editar Ficha Técnica</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowEditarFicha(false);
                  setFichaEditando(null);
                }}
              >
                ✕
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nome</Label>
                <Input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input
                  value={editCategoria}
                  onChange={(e) => setEditCategoria(e.target.value)}
                />
              </div>
              <div>
                <Label>Rendimento (porções)</Label>
                <Input
                  type="number"
                  value={editRendimento}
                  onChange={(e) => setEditRendimento(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Peso por porção (g)</Label>
                <Input
                  type="number"
                  value={editPesoPorcao}
                  onChange={(e) => setEditPesoPorcao(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Tempo de preparo (min)</Label>
                <Input
                  type="number"
                  value={editTempoPreparo}
                  onChange={(e) => setEditTempoPreparo(Number(e.target.value))}
                />
              </div>
              <div>
                <Label>Margem de lucro (%)</Label>
                <Input
                  type="number"
                  value={editMargemLucro}
                  onChange={(e) => setEditMargemLucro(Number(e.target.value))}
                />
              </div>
              <div className="col-span-2">
                <Label>Preço de venda (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={editPrecoVenda}
                  onChange={(e) => setEditPrecoVenda(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEditarFicha(false);
                  setFichaEditando(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={salvarEdicaoFicha}>
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nova Ficha Técnica (mantido como estava) */}
      {showNovaFicha && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Nova Ficha Técnica</h3>
              <Button type="button" variant="ghost" onClick={() => setShowNovaFicha(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-6">
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

              <div>
                <h4 className="text-lg font-semibold mb-4">Ingredientes</h4>
                <div className="border rounded-lg p-4">
                  <div className="grid grid-cols-6 gap-2 mb-4">
                    <Input placeholder="Ingrediente" />
                    <Input placeholder="Qtd" type="number" />
                    <Input placeholder="Unidade" />
                    <Input placeholder="Preço" type="number" step="0.01" />
                    <Input
                      placeholder="F.Correção"
                      type="number"
                      step="0.001"
                      defaultValue="1.000"
                    />
                    <Button type="button" size="sm">➕</Button>
                  </div>
                  <p className="text-sm text-gray-600">
                    Nenhum ingrediente adicionado ainda.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowNovaFicha(false)}>
                  Cancelar
                </Button>
                <Button type="button">Salvar Ficha Técnica</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
