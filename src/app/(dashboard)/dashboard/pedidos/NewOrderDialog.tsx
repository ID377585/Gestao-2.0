"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useToast } from "@/hooks/use-toast";
import { createOrderWithItems, type NewOrderItemInput } from "./actions";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { Product } from "@/types/product";

type NewOrderItemFormState = {
  product_id: string;
  quantity: string; // string no form, depois convertemos pra number
  unit_label: string;
};

type NewOrderItemUI = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_label: string;
  unit_price: number;
  total_price: number;
};

export function NewOrderDialog() {
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);

  const [currentItem, setCurrentItem] = useState<NewOrderItemFormState>({
    product_id: "",
    quantity: "",
    unit_label: "",
  });
  const [currentUnitPrice, setCurrentUnitPrice] = useState<number | null>(null);

  const [items, setItems] = useState<NewOrderItemUI[]>([]);

  const orderTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.total_price, 0),
    [items],
  );

  // Carrega produtos ativos do Supabase para o select
  useEffect(() => {
    const loadProducts = async () => {
      const supabase = createSupabaseBrowserClient();

      const { data, error } = await supabase
        .from("products")
        .select("id, name, default_unit_label, price, is_active, establishment_id")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        console.error("Erro ao carregar produtos", error);
        toast({
          title: "Erro ao carregar produtos",
          description:
            "Não foi possível carregar a lista de produtos. Tente novamente mais tarde.",
          variant: "destructive",
        });
        return;
      }

      if (data) {
        setProducts(data as Product[]);
      }
    };

    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function resetAll() {
    setNotes("");
    setItems([]);
    setCurrentItem({
      product_id: "",
      quantity: "",
      unit_label: "",
    });
    setCurrentUnitPrice(null);
  }

  function handleAddItem() {
    const quantityNumber = Number(currentItem.quantity);

    if (!currentItem.product_id || !currentItem.unit_label.trim()) {
      toast({
        title: "Dados de item inválidos",
        description: "Selecione o produto e a unidade antes de adicionar.",
        variant: "destructive",
      });
      return;
    }

    if (!quantityNumber || quantityNumber <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "Informe uma quantidade maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const product = products.find((p) => p.id === currentItem.product_id);

    if (!product) {
      toast({
        title: "Produto inválido",
        description: "Selecione um produto válido na lista.",
        variant: "destructive",
      });
      return;
    }

    const unit_price = product.price ?? 0;
    const total_price = unit_price * quantityNumber;

    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        quantity: quantityNumber,
        unit_label: currentItem.unit_label.trim(),
        unit_price,
        total_price,
      },
    ]);

    // limpa linha atual
    setCurrentItem({
      product_id: "",
      quantity: "",
      unit_label: "",
    });
    setCurrentUnitPrice(null);
  }

  async function handleCreateOrder() {
    if (creating) return;

    if (items.length === 0) {
      toast({
        title: "Adicione pelo menos 1 item",
        description:
          "Inclua ao menos um insumo na lista de itens antes de criar o pedido.",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);

      // O server ainda espera apenas product_name, unit_label, quantity
      const payloadItems: NewOrderItemInput[] = items.map((item) => ({
        product_name: item.product_name,
        unit_label: item.unit_label,
        quantity: item.quantity,
      }));

      const result = await createOrderWithItems({
        notes,
        items: payloadItems,
      });

      toast({
        title: "Pedido criado",
        description: "Pedido e itens foram salvos com sucesso.",
      });

      setOpen(false);
      resetAll();

      if (result?.id) {
        router.push(`/dashboard/pedidos/${result.id}`);
      } else {
        router.refresh();
      }
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Erro ao criar pedido",
        description: error?.message ?? "Erro inesperado ao criar o pedido.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  }

  const currentLineTotal =
    currentItem.quantity && currentUnitPrice != null
      ? Number(currentItem.quantity || 0) * currentUnitPrice
      : null;

  return (
    <>
      {/* Botão que abre o diálogo */}
      <Button onClick={() => setOpen(true)}>Novo Pedido</Button>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) {
            resetAll();
          }
        }}
      >
        <DialogContent className="w-full max-w-2xl bg-white">
          <DialogHeader>
            <DialogTitle>Novo Pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Observações internas */}
            <div className="space-y-2">
              <Label htmlFor="notes">Observações internas do pedido</Label>
              <Textarea
                id="notes"
                placeholder="Observações internas do pedido..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={creating}
              />
              <p className="text-xs text-muted-foreground">
                Essas observações ficarão registradas no pedido.
              </p>
            </div>

            {/* =========================
            📦 ITENS DO PEDIDO
            ========================= */}
            <div className="border rounded-lg p-4 space-y-4">
              <h2 className="text-lg font-semibold mb-2">Itens do Pedido</h2>

              {/* Lista de itens já adicionados */}
              {items.length > 0 ? (
                <div className="mt-2 rounded-md border">
                  <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-2 border-b px-3 py-2 text-xs font-medium text-muted-foreground">
                    <span>Produto</span>
                    <span className="text-right">Qtd.</span>
                    <span className="text-right">Un.</span>
                    <span className="text-right">Preço</span>
                  </div>

                  {items.map((item, index) => (
                    <div
                      key={item.product_id + "-" + index}
                      className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-2 px-3 py-2 text-sm items-center"
                    >
                      <span>{item.product_name}</span>
                      <span className="text-right">{item.quantity}</span>
                      <span className="text-right">{item.unit_label}</span>
                      <span className="text-right">
                        {item.total_price.toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nenhum item ainda. Adicione acima 👇
                </p>
              )}

              {/* Formulário de item (linha atual) */}
              <div className="space-y-2">
                <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2 items-end">
                  {/* Produto */}
                  <div className="flex flex-col gap-1">
                    <Label>Produto</Label>
                    <Select
                      value={currentItem.product_id}
                      onValueChange={(value) => {
                        setCurrentItem((prev) => ({
                          ...prev,
                          product_id: value,
                        }));
                        const product = products.find((p) => p.id === value);
                        if (product) {
                          setCurrentItem((prev) => ({
                            ...prev,
                            product_id: value,
                            unit_label: product.default_unit_label ?? "",
                          }));
                          setCurrentUnitPrice(product.price ?? 0);
                        } else {
                          setCurrentUnitPrice(null);
                        }
                      }}
                      disabled={creating}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantidade */}
                  <div className="flex flex-col gap-1">
                    <Label>Qtd.</Label>
                    <Input
                      type="number"
                      placeholder="Qtd."
                      value={currentItem.quantity}
                      onChange={(e) =>
                        setCurrentItem((prev) => ({
                          ...prev,
                          quantity: e.target.value,
                        }))
                      }
                      min={0}
                      step={1}
                      disabled={creating}
                    />
                  </div>

                  {/* Unidade */}
                  <div className="flex flex-col gap-1">
                    <Label>Un.</Label>
                    <Input
                      type="text"
                      placeholder="Un."
                      value={currentItem.unit_label}
                      onChange={(e) =>
                        setCurrentItem((prev) => ({
                          ...prev,
                          unit_label: e.target.value,
                        }))
                      }
                      disabled={creating}
                    />
                  </div>

                  {/* Preço linha */}
                  <div className="flex flex-col gap-1 text-right">
                    <Label>Preço</Label>
                    <div className="text-sm font-medium">
                      {currentLineTotal != null
                        ? currentLineTotal.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })
                        : "--"}
                    </div>
                  </div>

                  {/* Botão adicionar */}
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      onClick={handleAddItem}
                      disabled={creating}
                      className="bg-green-600 text-white hover:bg-green-700"
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Valor total do pedido */}
              <div className="mt-4 flex justify-end">
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">
                    Valor Total
                  </div>
                  <div className="text-xl font-semibold">
                    {orderTotal.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Botões finais */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setOpen(false)}
                disabled={creating}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={handleCreateOrder}
                disabled={creating}
              >
                {creating ? "Criando..." : "Criar Pedido"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
