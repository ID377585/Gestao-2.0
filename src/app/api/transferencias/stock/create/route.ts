"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProductOption = {
  id: string;
  name: string;
  default_unit_label?: string | null;
};

type TransferItemRow = {
  rowId: string;
  product_id: string;
  unit_label: string;
  qty: string; // string para input controlado
  available: number | null;
  loadingStock: boolean;
  error?: string | null;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function fetchAvailable(product_id: string, unit_label: string) {
  const res = await fetch("/api/transferencias/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product_id, unit_label }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Falha ao consultar saldo.");
  return Number(data?.available ?? 0) || 0;
}

export function TransferItemsTable({
  products,
  value,
  onChange,
}: {
  products: ProductOption[];
  value: Array<{ product_id: string; unit_label: string; qty: number }>;
  onChange: (items: Array<{ product_id: string; unit_label: string; qty: number }>) => void;
}) {
  const productMap = useMemo(() => {
    const m = new Map<string, ProductOption>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  const [rows, setRows] = useState<TransferItemRow[]>(() => {
    if (!value?.length) {
      return [
        {
          rowId: uid(),
          product_id: "",
          unit_label: "",
          qty: "",
          available: null,
          loadingStock: false,
          error: null,
        },
      ];
    }

    return value.map((it) => ({
      rowId: uid(),
      product_id: it.product_id,
      unit_label: String(it.unit_label ?? ""),
      qty: String(it.qty ?? ""),
      available: null,
      loadingStock: false,
      error: null,
    }));
  });

  // sempre que rows mudar, propaga para o pai (somente itens válidos)
  useEffect(() => {
    const normalized = rows
      .map((r) => {
        const qtyNum = Number(String(r.qty).replace(",", "."));
        if (!r.product_id || !r.unit_label || !Number.isFinite(qtyNum) || qtyNum <= 0) return null;
        return { product_id: r.product_id, unit_label: r.unit_label, qty: qtyNum };
      })
      .filter(Boolean) as Array<{ product_id: string; unit_label: string; qty: number }>;

    onChange(normalized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { rowId: uid(), product_id: "", unit_label: "", qty: "", available: null, loadingStock: false, error: null },
    ]);
  };

  const removeRow = (rowId: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.rowId !== rowId);
      return next.length ? next : prev;
    });
  };

  const updateRow = (rowId: string, patch: Partial<TransferItemRow>) => {
    setRows((prev) => prev.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)));
  };

  const refreshStock = async (row: TransferItemRow) => {
    const pid = row.product_id;
    const unit = row.unit_label?.trim().toUpperCase();
    if (!pid || !unit) return;

    updateRow(row.rowId, { loadingStock: true, error: null });
    try {
      const available = await fetchAvailable(pid, unit);
      updateRow(row.rowId, { available, loadingStock: false });

      // se qty > available, marca erro
      const qtyNum = Number(String(row.qty).replace(",", "."));
      if (Number.isFinite(qtyNum) && qtyNum > available) {
        updateRow(row.rowId, { error: `Quantidade maior que o disponível (${available}).` });
      } else {
        updateRow(row.rowId, { error: null });
      }
    } catch (e: any) {
      updateRow(row.rowId, { loadingStock: false, available: null, error: e?.message ?? "Erro ao consultar saldo." });
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <div className="grid grid-cols-12 gap-2 border-b bg-muted/30 px-3 py-2 text-xs font-semibold">
          <div className="col-span-5">Produto</div>
          <div className="col-span-2">Unidade</div>
          <div className="col-span-2">Qtd</div>
          <div className="col-span-2">Disponível</div>
          <div className="col-span-1 text-right">Ações</div>
        </div>
        
        <div className="divide-y">
          {rows.map((row) => {
            const p = row.product_id ? productMap.get(row.product_id) : null;
            const unitDefault = (p?.default_unit_label ?? "").toUpperCase();

            const availableText =
              row.loadingStock ? "..." : row.available == null ? "-" : String(row.available);

            const qtyNum = Number(String(row.qty).replace(",", "."));
            const qtyInvalid =
              row.qty.trim().length > 0 && (!Number.isFinite(qtyNum) || qtyNum <= 0);

            const overStock =
              row.available != null && Number.isFinite(qtyNum) && qtyNum > row.available;

            return (
              <div key={row.rowId} className="px-3 py-3">
                <div className="grid grid-cols-12 gap-2 items-start">
                  {/* Produto */}
                  <div className="col-span-5">
                    <select
                      className={cn(
                        "h-10 w-full rounded-md border px-3 text-sm bg-white",
                        row.error ? "border-red-400" : "border-input",
                      )}
                      value={row.product_id}
                      onChange={(e) => {
                        const product_id = e.target.value;
                        const picked = productMap.get(product_id);
                        const unit_label = (picked?.default_unit_label ?? "").toUpperCase();

                        updateRow(row.rowId, {
                          product_id,
                          unit_label: unit_label || "",
                          available: null,
                          error: null,
                        });

                        // consulta estoque automaticamente após escolher produto (se tiver unidade)
                        setTimeout(() => {
                          const nextRow = {
                            ...row,
                            product_id,
                            unit_label: unit_label || "",
                          };
                          refreshStock(nextRow);
                        }, 0);
                      }}
                    >
                      <option value="">Selecione…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>

                    {row.error && (
                      <div className="mt-1 text-xs text-red-600">{row.error}</div>
                    )}
                  </div>

                  {/* Unidade */}
                  <div className="col-span-2">
                    <input
                      className={cn(
                        "h-10 w-full rounded-md border px-3 text-sm bg-white",
                        row.error ? "border-red-400" : "border-input",
                      )}
                      value={row.unit_label}
                      placeholder={unitDefault || "UN"}
                      onChange={(e) => {
                        const unit_label = e.target.value.toUpperCase();
                        updateRow(row.rowId, { unit_label, available: null, error: null });
                      }}
                      onBlur={() => refreshStock(row)}
                    />
                  </div>

                  {/* Quantidade */}
                  <div className="col-span-2">
                    <input
                      className={cn(
                        "h-10 w-full rounded-md border px-3 text-sm bg-white",
                        qtyInvalid || overStock ? "border-red-400" : "border-input",
                      )}
                      value={row.qty}
                      placeholder="0"
                      onChange={(e) => {
                        const qty = e.target.value;
                        updateRow(row.rowId, { qty });

                        // validação imediata se já tiver disponível
                        const qtyNum2 = Number(String(qty).replace(",", "."));
                        if (row.available != null && Number.isFinite(qtyNum2) && qtyNum2 > row.available) {
                          updateRow(row.rowId, { error: `Quantidade maior que o disponível (${row.available}).` });
                        } else {
                          updateRow(row.rowId, { error: null });
                        }
                      }}
                    />
                    {(qtyInvalid || overStock) && !row.error && (
                      <div className="mt-1 text-xs text-red-600">
                        {qtyInvalid ? "Informe uma quantidade válida." : "Qtd maior que o disponível."}
                      </div>
                    )}
                  </div>

                  {/* Disponível */}
                  <div className="col-span-2">
                    <div className="h-10 flex items-center text-sm">
                      <span className={cn(overStock ? "text-red-600 font-semibold" : "text-muted-foreground")}>
                        {availableText}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="px-0 h-7 text-xs"
                      onClick={() => refreshStock(row)}
                      disabled={!row.product_id || !row.unit_label || row.loadingStock}
                    >
                      Atualizar saldo
                    </Button>
                  </div>

                  {/* Ações */}
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.rowId)}>
                      ✕
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={addRow}>
          + Adicionar item
        </Button>

        <div className="text-xs text-muted-foreground">
          Dica: selecione o produto para carregar o saldo automaticamente.
        </div>
      </div>
    </div>
  );
}
