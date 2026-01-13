"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type TransferItem = {
  id: string;
  sku?: string;
  name: string;
  qty: string; // string para input controlado
  unit: string; // UN, KG, G, L, ML...
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function NovaTransferenciaModal({ open, onOpenChange }: Props) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<TransferItem[]>([
    { id: uid(), sku: "", name: "", qty: "", unit: "UN" },
  ]);

  const canSubmit = useMemo(() => {
    if (!origin.trim()) return false;
    if (!destination.trim()) return false;
    if (origin.trim().toLowerCase() === destination.trim().toLowerCase())
      return false;

    const hasValidItem = items.some((it) => {
      const nameOk = it.name.trim().length > 0;
      const qtyNum = Number(String(it.qty).replace(",", "."));
      const qtyOk = !Number.isNaN(qtyNum) && qtyNum > 0;
      return nameOk && qtyOk;
    });

    return hasValidItem;
  }, [origin, destination, items]);

  function resetForm() {
    setOrigin("");
    setDestination("");
    setNotes("");
    setItems([{ id: uid(), sku: "", name: "", qty: "", unit: "UN" }]);
  }

  function close() {
    onOpenChange(false);
  }

  function addItem() {
    setItems((prev) => [...prev, { id: uid(), sku: "", name: "", qty: "", unit: "UN" }]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));
  }

  function updateItem(id: string, patch: Partial<TransferItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  function handleSubmit() {
    if (!canSubmit) return;

    // Mock do payload — aqui depois você liga com a API
    const payload = {
      origin: origin.trim(),
      destination: destination.trim(),
      notes: notes.trim() || null,
      items: items
        .map((it) => {
          const qty = Number(String(it.qty).replace(",", "."));
          return {
            sku: it.sku?.trim() || null,
            name: it.name.trim(),
            qty,
            unit: it.unit,
          };
        })
        .filter((it) => it.name && it.qty > 0),
    };

    console.log("[transferencias] nova transferencia:", payload);
    alert("Transferência criada (mock). Próximo passo: salvar no banco e baixar do estoque.");

    // Fecha e reseta
    close();
    resetForm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      <DialogContent className="sm:max-w-[900px]">
        <DialogHeader>
          <DialogTitle>Nova Transferência</DialogTitle>
          <DialogDescription>
            Defina origem e destino e informe os itens. (Nesta etapa ainda é mock — em seguida vamos ligar no estoque.)
          </DialogDescription>
        </DialogHeader>

        {/* ORIGEM / DESTINO */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Origem</label>
            <Input
              placeholder="Ex: Estoque Matriz / Unidade A"
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Depois vamos trocar por um Select com as unidades/estoques do estabelecimento.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Destino</label>
            <Input
              placeholder="Ex: Estoque Loja / Unidade B"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
            {origin.trim() &&
              destination.trim() &&
              origin.trim().toLowerCase() === destination.trim().toLowerCase() && (
                <p className="text-xs text-red-600">
                  Origem e destino não podem ser iguais.
                </p>
              )}
          </div>
        </div>

        <Separator />

        {/* ITENS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">Itens da transferência</div>
              <div className="text-xs text-muted-foreground">
                Informe produto e quantidade. Você pode adicionar várias linhas.
              </div>
            </div>

            <Button type="button" variant="outline" className="gap-2" onClick={addItem}>
              <Plus className="h-4 w-4" />
              Adicionar item
            </Button>
          </div>

          <div className="rounded-lg border">
            <div className="grid grid-cols-12 gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-medium">
              <div className="col-span-3">SKU (opcional)</div>
              <div className="col-span-5">Produto</div>
              <div className="col-span-2">Quantidade</div>
              <div className="col-span-1">Un.</div>
              <div className="col-span-1 text-right"> </div>
            </div>

            <div className="divide-y">
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 px-3 py-3">
                  <div className="col-span-12 md:col-span-3">
                    <Input
                      placeholder="SKU"
                      value={it.sku ?? ""}
                      onChange={(e) => updateItem(it.id, { sku: e.target.value })}
                    />
                  </div>

                  <div className="col-span-12 md:col-span-5">
                    <Input
                      placeholder="Nome do produto"
                      value={it.name}
                      onChange={(e) => updateItem(it.id, { name: e.target.value })}
                    />
                  </div>

                  <div className="col-span-6 md:col-span-2">
                    <Input
                      inputMode="decimal"
                      placeholder="0"
                      value={it.qty}
                      onChange={(e) => updateItem(it.id, { qty: e.target.value })}
                    />
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      Aceita vírgula/ponto.
                    </div>
                  </div>

                  <div className="col-span-4 md:col-span-1">
                    <Input
                      placeholder="UN"
                      value={it.unit}
                      onChange={(e) => updateItem(it.id, { unit: e.target.value.toUpperCase() })}
                    />
                  </div>

                  <div className="col-span-2 md:col-span-1 flex items-start justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => removeItem(it.id)}
                      aria-label="Remover item"
                      title="Remover item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!canSubmit && (
            <p className="text-xs text-muted-foreground">
              Para salvar: preencha <strong>Origem</strong>, <strong>Destino</strong> e pelo menos{" "}
              <strong>1 item</strong> com produto e quantidade &gt; 0.
            </p>
          )}
        </div>

        <Separator />

        {/* OBS */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Observações (opcional)</label>
          <Textarea
            placeholder="Ex: transferência para reposição da vitrine..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              close();
              resetForm();
            }}
          >
            Cancelar
          </Button>

          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            Criar transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
