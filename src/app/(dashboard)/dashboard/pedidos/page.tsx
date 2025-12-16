"use client";

import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* -------------------------------------------------------------------------- */
/* Types */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/* Mock Data */
/* -------------------------------------------------------------------------- */

const estabelecimentos: Estabelecimento[] = [
  {
    id: 1,
    nome: "Restaurante Bella Vista",
    prazoEntregaDias: 2,
    endereco: "Rua das Flores, 123",
    telefone: "(11) 1234-5678",
  },
  {
    id: 2,
    nome: "Padaria São João",
    prazoEntregaDias: 1,
    endereco: "Av. Principal, 456",
    telefone: "(11) 9876-5432",
  },
];

const insumos: Insumo[] = [
  {
    id: 1,
    nome: "Farinha de Trigo",
    unidade: "kg",
    precoCompra: 4.5,
    categoria: "Farinhas",
    estoqueAtual: 25,
  },
  {
    id: 2,
    nome: "Açúcar Cristal",
    unidade: "kg",
    precoCompra: 3.2,
    categoria: "Açúcares",
    estoqueAtual: 18,
  },
];

const pedidosExemplo: Pedido[] = [
  {
    id: 1,
    estabelecimento: "Restaurante Bella Vista",
    dataEntrega: "2024-01-15",
    valorTotal: 450.8,
    status: "criado",
    itens: 8,
    progresso: 10,
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers */
/* -------------------------------------------------------------------------- */

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const formatDate = (date: string) => new Date(date).toLocaleDateString("pt-BR");

/* -------------------------------------------------------------------------- */
/* Page */
/* -------------------------------------------------------------------------- */

export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosExemplo);
  const [openDialog, setOpenDialog] = useState(false);

  const [estabelecimento, setEstabelecimento] =
    useState<Estabelecimento | null>(null);
  const [insumoSelecionado, setInsumoSelecionado] =
    useState<Insumo | null>(null);
  const [quantidade, setQuantidade] = useState("");
  const [itens, setItens] = useState<ItemPedido[]>([]);
  const [observacoes, setObservacoes] = useState("");

  const calcularEntrega = (est: Estabelecimento) => {
    const d = new Date();
    d.setDate(d.getDate() + est.prazoEntregaDias);
    return d.toISOString().split("T")[0];
  };

  const totalPedido = itens.reduce((acc, i) => acc + i.precoCustoTotal, 0);

  const adicionarItem = () => {
    if (!insumoSelecionado || !quantidade) return;

    const qtd = Number(quantidade);
    if (!Number.isFinite(qtd) || qtd <= 0) return;
    if (qtd > insumoSelecionado.estoqueAtual) return;

    setItens((prev) => [
      ...prev,
      {
        id: Date.now(),
        insumoId: insumoSelecionado.id,
        produtoNome: insumoSelecionado.nome,
        quantidade: qtd,
        unidade: insumoSelecionado.unidade,
        precoCustoUnitario: insumoSelecionado.precoCompra,
        precoCustoTotal: qtd * insumoSelecionado.precoCompra,
      },
    ]);

    setQuantidade("");
    setInsumoSelecionado(null);
  };

  const registrarPedido = () => {
    if (!estabelecimento || itens.length === 0) return;

    setPedidos((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        estabelecimento: estabelecimento.nome,
        dataEntrega: calcularEntrega(estabelecimento),
        valorTotal: totalPedido,
        status: "criado",
        itens: itens.length,
        progresso: 10,
      },
    ]);

    setItens([]);
    setObservacoes("");
    setEstabelecimento(null);
    setOpenDialog(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader />

      <div className="flex justify-end">
        <Button onClick={() => setOpenDialog(true)}>Novo Pedido</Button>
      </div>

      {/* LISTA */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <CardDescription>Lista de pedidos criados</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pedidos.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>#{p.id}</TableCell>
                  <TableCell>{p.estabelecimento}</TableCell>
                  <TableCell>{formatDate(p.dataEntrega)}</TableCell>
                  <TableCell>{formatCurrency(p.valorTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* MODAL */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>Novo Pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Estabelecimento</Label>
              <Select
                value={estabelecimento?.id.toString() || ""}
                onValueChange={(v) =>
                  setEstabelecimento(
                    estabelecimentos.find((e) => e.id.toString() === v) || null
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecionar" />
                </SelectTrigger>
                <SelectContent>
                  {estabelecimentos.map((e) => (
                    <SelectItem key={e.id} value={e.id.toString()}>
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Produto</Label>
                <Select
                  value={insumoSelecionado?.id.toString() || ""}
                  onValueChange={(v) =>
                    setInsumoSelecionado(
                      insumos.find((i) => i.id.toString() === v) || null
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    {insumos.map((i) => (
                      <SelectItem key={i.id} value={i.id.toString()}>
                        {i.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                />
              </div>

              <div className="flex items-end">
                <Button className="w-full" onClick={adicionarItem}>
                  Adicionar
                </Button>
              </div>
            </div>

            {itens.length > 0 && (
              <div className="text-right text-lg font-semibold">
                Total: {formatCurrency(totalPedido)}
              </div>
            )}

            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações"
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={registrarPedido}>Registrar Pedido</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
