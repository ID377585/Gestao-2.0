"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";

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

import {
  createTransfer,
  getTransferOptions,
  searchProductsForTransfer,
} from "@/app/(dashboard)/dashboard/transferencias/actions";

type EstablishmentOption = { id: string; name: string };

type ProductOption = {
  id: string;
  name: string;
  default_unit_label?: string | null;
};

type TransferItemRow = {
  id: string; // id interno da linha do formulário (não é id do produto)
  product_id: string;
  product_name: string;
  unit_label: string;
  qty: string; // input controlado
  available: number | null;
  loadingStock: boolean;
  error?: string | null;
};

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function normalizeQtyStr(v: string) {
  return String(v ?? "").trim();
}

function parseQty(v: string) {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

async function fetchAvailable(product_id: string, unit_label: string) {
  const res = await fetch("/api/transferencias/stock", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ product_id, unit_label }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "Falha ao consultar saldo.");
  return Number(data?.available ?? 0) || 0;
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function NovaTransferenciaModal({ open, onOpenChange }: Props) {
  const [loadingInit, setLoadingInit] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const [fromEstablishmentId, setFromEstablishmentId] = useState<string>("");
  const [toEstablishmentId, setToEstablishmentId] = useState<string>("");

  const [establishments, setEstablishments] = useState<EstablishmentOption[]>([]);

  // produtos (autocomplete simples)
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productQuery, setProductQuery] = useState<string>("");

  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [items, setItems] = useState<TransferItemRow[]>([
    {
      id: uid(),
      product_id: "",
      product_name: "",
      unit_label: "",
      qty: "",
      available: null,
      loadingStock: false,
      error: null,
    },
  ]);

  // Carrega opções quando abrir
  useEffect(() => {
    if (!open) return;

    let mounted = true;
    (async () => {
      setLoadingInit(true);
      setInitError(null);
      setFormError(null);
      setSuccessMsg(null);

      try {
        const opts = await getTransferOptions();
        if (!mounted) return;

        setFromEstablishmentId(opts.establishmentId || "");
        setEstablishments(opts.establishments || []);

        // reset destino
        setToEstablishmentId("");
      } catch (e: any) {
        if (!mounted) return;
        setInitError(e?.message ?? "Não foi possível carregar opções.");
      } finally {
        if (!mounted) return;
        setLoadingInit(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open]);

  // Autocomplete de produtos para origem (debounce)
  useEffect(() => {
    if (!open) return;
    if (!fromEstablishmentId) return;

    const q = productQuery.trim();
    const t = setTimeout(async () => {
      try {
        const list = await searchProductsForTransfer({
          establishmentId: fromEstablishmentId,
          q,
          limit: 30,
        });
        setProducts(list || []);
      } catch (e) {
        // silencioso — não travar o modal
        setProducts([]);
      }
    }, 250);

    return () => clearTimeout(t);
  }, [productQuery, fromEstablishmentId, open]);

  const productMap = useMemo(() => {
    const m = new Map<string, ProductOption>();
    for (const p of products) m.set(p.id, p);
    return m;
  }, [products]);

  function resetForm() {
    setProductQuery("");
    setProducts([]);
    setNotes("");
    setFormError(null);
    setSuccessMsg(null);

    setItems([
      {
        id: uid(),
        product_id: "",
        product_name: "",
        unit_label: "",
        qty: "",
        available: null,
        loadingStock: false,
        error: null,
      },
    ]);
  }

  function close() {
    onOpenChange(false);
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: uid(),
        product_id: "",
        product_name: "",
        unit_label: "",
        qty: "",
        available: null,
        loadingStock: false,
        error: null,
      },
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.id !== id)));
  }

  function updateItem(id: string, patch: Partial<TransferItemRow>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function refreshStock(rowId: string) {
    const row = items.find((r) => r.id === rowId);
    if (!row) return;

    const product_id = row.product_id?.trim();
    const unit_label = row.unit_label?.trim().toUpperCase();

    if (!product_id || !unit_label) return;

    updateItem(rowId, { loadingStock: true, error: null });

    try {
      const available = await fetchAvailable(product_id, unit_label);
      const qtyNum = parseQty(row.qty);

      let error: string | null = null;
      if (row.qty.trim().length > 0 && (!Number.isFinite(qtyNum) || qtyNum <= 0)) {
        error = "Informe uma quantidade válida.";
      } else if (Number.isFinite(qtyNum) && qtyNum > available) {
        error = `Quantidade maior que o disponível (${available}).`;
      }

      updateItem(rowId, {
        available,
        loadingStock: false,
        error,
      });
    } catch (e: any) {
      updateItem(rowId, {
        loadingStock: false,
        available: null,
        error: e?.message ?? "Erro ao consultar saldo.",
      });
    }
  }

  // Validação final (inclui saldo)
  const canSubmit = useMemo(() => {
    if (!fromEstablishmentId) return false;
    if (!toEstablishmentId) return false;
    if (fromEstablishmentId === toEstablishmentId) return false;

    const validLines = items.filter((it) => {
      if (!it.product_id) return false;
      const qtyNum = parseQty(it.qty);
      if (!Number.isFinite(qtyNum) || qtyNum <= 0) return false;
      const unit = it.unit_label?.trim();
      if (!unit) return false;
      return true;
    });

    if (validLines.length === 0) return false;

    // se alguma linha tem erro explícito, bloqueia
    if (items.some((it) => it.error)) return false;

    // se já temos "available" e qty excede, bloqueia
    for (const it of validLines) {
      const qtyNum = parseQty(it.qty);
      if (it.available != null && Number.isFinite(qtyNum) && qtyNum > it.available) {
        return false;
      }
    }

    return true;
  }, [fromEstablishmentId, toEstablishmentId, items]);

  async function handleSubmit() {
    setFormError(null);
    setSuccessMsg(null);

    if (!canSubmit || saving) return;

    // Validação de saldo garantida antes de mandar (refresca saldo quando necessário)
    try {
      setSaving(true);

      // refresh de saldo para linhas que ainda não consultaram
      for (const it of items) {
        const qtyStr = normalizeQtyStr(it.qty);
        const qtyNum = parseQty(qtyStr);

        if (!it.product_id) continue;
        if (!it.unit_label?.trim()) continue;
        if (!Number.isFinite(qtyNum) || qtyNum <= 0) continue;

        // se ainda não tem available, consulta
        if (it.available == null) {
          await refreshStock(it.id);
        }
      }

      // Revalida excedente após refresh
      const latest = items.map((x) => x);
      for (const it of latest) {
        const qtyNum = parseQty(it.qty);
        if (
          it.product_id &&
          it.unit_label?.trim() &&
          Number.isFinite(qtyNum) &&
          qtyNum > 0 &&
          it.available != null &&
          qtyNum > it.available
        ) {
          setFormError(
            `Existe item com quantidade maior que o disponível (saldo ${it.available}). Ajuste antes de salvar.`,
          );
          setSaving(false);
          return;
        }
      }

      const payloadItems = items
        .map((it) => {
          const qtyNum = parseQty(it.qty);
          if (!it.product_id) return null;
          if (!it.unit_label?.trim()) return null;
          if (!Number.isFinite(qtyNum) || qtyNum <= 0) return null;

          return {
            product_id: it.product_id,
            unit_label: it.unit_label.trim().toUpperCase(),
            qty: qtyNum,
          };
        })
        .filter(Boolean) as Array<{ product_id: string; unit_label: string; qty: number }>;

      if (!payloadItems.length) {
        setFormError("Informe ao menos 1 item válido.");
        setSaving(false);
        return;
      }

      const res = await createTransfer({
        to_establishment_id: toEstablishmentId,
        notes: notes.trim() || null,
        items: payloadItems,
      });

      if (res?.ok) {
        setSuccessMsg(`Transferência criada com sucesso: ${res.transfer_id}`);
        // Fecha e reseta
        close();
        resetForm();
      } else {
        setFormError("Não foi possível criar a transferência.");
      }
    } catch (e: any) {
      setFormError(e?.message ?? "Erro ao criar transferência.");
    } finally {
      setSaving(false);
    }
  }

  // Helpers UI
  const fromName =
    establishments.find((e) => e.id === fromEstablishmentId)?.name ?? "Origem";

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) resetForm();
      }}
    >
      {/* ✅ Fundo branco e texto escuro */}
      <DialogContent className="sm:max-w-[900px] bg-white text-gray-900 border border-gray-200 shadow-xl">
        <DialogHeader>
          <DialogTitle>Nova Transferência</DialogTitle>
          <DialogDescription className="text-gray-600">
            Selecione o destino e informe os itens. O sistema valida o saldo e registra saída
            (origem) + entrada (destino).
          </DialogDescription>
        </DialogHeader>

        {loadingInit ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando opções...
          </div>
        ) : initError ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {initError}
          </div>
        ) : (
          <>
            {/* ORIGEM / DESTINO */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Origem</label>
                <Input
                  className="bg-white text-gray-900"
                  value={fromName}
                  readOnly
                />
                <p className="text-xs text-gray-500">
                  A origem é automaticamente seu estabelecimento atual.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Destino</label>
                <select
                  className="h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900"
                  value={toEstablishmentId}
                  onChange={(e) => setToEstablishmentId(e.target.value)}
                >
                  <option value="">Selecione…</option>
                  {establishments
                    .filter((e) => e.id !== fromEstablishmentId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>

                {fromEstablishmentId &&
                  toEstablishmentId &&
                  fromEstablishmentId === toEstablishmentId && (
                    <p className="text-xs text-red-600">
                      Origem e destino não podem ser iguais.
                    </p>
                  )}
              </div>
            </div>

            <Separator />

            {/* FILTRO DE PRODUTOS (ajuda a popular o select dos itens) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Buscar produtos</label>
              <Input
                className="bg-white text-gray-900"
                placeholder="Digite parte do nome do produto..."
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Dica: digite para atualizar a lista. Você escolherá o produto dentro de cada linha.
              </p>
            </div>

            <Separator />

            {/* ITENS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">Itens da transferência</div>
                  <div className="text-xs text-gray-500">
                    Selecione o produto, informe unidade e quantidade. O saldo é validado.
                  </div>
                </div>

                <Button type="button" variant="outline" className="gap-2" onClick={addItem}>
                  <Plus className="h-4 w-4" />
                  Adicionar item
                </Button>
              </div>

              <div className="rounded-lg border border-gray-200 bg-white">
                <div className="grid grid-cols-12 gap-2 border-b bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700">
                  <div className="col-span-6">Produto</div>
                  <div className="col-span-2">Un.</div>
                  <div className="col-span-2">Qtd</div>
                  <div className="col-span-1">Saldo</div>
                  <div className="col-span-1 text-right"> </div>
                </div>

                <div className="divide-y divide-gray-200">
                  {items.map((it) => {
                    const qtyNum = parseQty(it.qty);
                    const qtyInvalid =
                      it.qty.trim().length > 0 && (!Number.isFinite(qtyNum) || qtyNum <= 0);

                    const overStock =
                      it.available != null && Number.isFinite(qtyNum) && qtyNum > it.available;

                    return (
                      <div key={it.id} className="px-3 py-3">
                        <div className="grid grid-cols-12 gap-2 items-start">
                          {/* Produto */}
                          <div className="col-span-12 md:col-span-6">
                            <select
                              className={`h-10 w-full rounded-md border px-3 text-sm bg-white text-gray-900 ${
                                it.error ? "border-red-400" : "border-gray-200"
                              }`}
                              value={it.product_id}
                              onChange={(e) => {
                                const product_id = e.target.value;
                                const picked = productMap.get(product_id);
                                const unit_label = String(picked?.default_unit_label ?? "")
                                  .trim()
                                  .toUpperCase();

                                updateItem(it.id, {
                                  product_id,
                                  product_name: picked?.name ?? "",
                                  unit_label: unit_label || "UN",
                                  available: null,
                                  error: null,
                                });

                                // refresh imediato após escolher
                                setTimeout(() => refreshStock(it.id), 0);
                              }}
                            >
                              <option value="">Selecione…</option>
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>

                            {it.error && (
                              <div className="mt-1 text-xs text-red-600">{it.error}</div>
                            )}
                          </div>

                          {/* Unidade */}
                          <div className="col-span-6 md:col-span-2">
                            <Input
                              className={`bg-white text-gray-900 ${
                                it.error ? "border-red-400" : "border-gray-200"
                              }`}
                              placeholder="UN"
                              value={it.unit_label}
                              onChange={(e) => {
                                const unit_label = e.target.value.toUpperCase();
                                updateItem(it.id, {
                                  unit_label,
                                  available: null,
                                  error: null,
                                });
                              }}
                              onBlur={() => refreshStock(it.id)}
                            />
                          </div>

                          {/* Quantidade */}
                          <div className="col-span-6 md:col-span-2">
                            <Input
                              className={`bg-white text-gray-900 ${
                                qtyInvalid || overStock ? "border-red-400" : "border-gray-200"
                              }`}
                              inputMode="decimal"
                              placeholder="0"
                              value={it.qty}
                              onChange={(e) => {
                                const qty = e.target.value;
                                updateItem(it.id, { qty });

                                const qn = parseQty(qty);
                                if (it.available != null && Number.isFinite(qn) && qn > it.available) {
                                  updateItem(it.id, {
                                    error: `Quantidade maior que o disponível (${it.available}).`,
                                  });
                                } else {
                                  updateItem(it.id, { error: null });
                                }
                              }}
                              onBlur={() => refreshStock(it.id)}
                            />
                            {(qtyInvalid || overStock) && !it.error && (
                              <div className="mt-1 text-xs text-red-600">
                                {qtyInvalid ? "Informe uma quantidade válida." : "Qtd maior que o saldo."}
                              </div>
                            )}
                          </div>

                          {/* Saldo */}
                          <div className="col-span-4 md:col-span-1">
                            <div className="h-10 flex items-center text-sm">
                              {it.loadingStock ? (
                                <span className="text-gray-500">...</span>
                              ) : it.available == null ? (
                                <span className="text-gray-400">-</span>
                              ) : (
                                <span className={overStock ? "text-red-600 font-semibold" : "text-gray-700"}>
                                  {it.available}
                                </span>
                              )}
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="px-0 h-7 text-xs text-gray-700"
                              onClick={() => refreshStock(it.id)}
                              disabled={!it.product_id || !it.unit_label || it.loadingStock}
                            >
                              Atualizar
                            </Button>
                          </div>

                          {/* Remover */}
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
                      </div>
                    );
                  })}
                </div>
              </div>

              {!canSubmit && (
                <p className="text-xs text-gray-600">
                  Para salvar: selecione <strong>Destino</strong> e adicione ao menos{" "}
                  <strong>1 item</strong> com produto, unidade e quantidade &gt; 0 (sem exceder o saldo).
                </p>
              )}

              {formError && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {formError}
                </div>
              )}

              {successMsg && (
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  {successMsg}
                </div>
              )}
            </div>

            <Separator />

            {/* OBS */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900">Observações (opcional)</label>
              <Textarea
                className="bg-white text-gray-900"
                placeholder="Ex: transferência para reposição..."
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
                disabled={saving}
              >
                Cancelar
              </Button>

              <Button type="button" onClick={handleSubmit} disabled={!canSubmit || saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Criar transferência"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
