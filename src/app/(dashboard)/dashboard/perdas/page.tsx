"use client";

// src/app/(dashboard)/dashboard/perdas/page.tsx

import { useEffect, useMemo, useState } from "react";

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

// Select (shadcn)
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ✅ Combobox pesquisável (shadcn)
import { Check, ChevronsUpDown, RefreshCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/* =========================
   TIPOS
========================= */
type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unit_label: string;
};

type LossRow = {
  id: string;
  created_at: string;

  product_id: string;
  product_name: string;
  sku: string;
  unit_label: string;

  qty: number;
  lot: string | null;

  reason: string;
  reason_detail: string | null;

  qrcode: string | null;
  user_id: string;
  establishment_id: string;

  stock_before: number | null;
  stock_after: number | null;
};

type InventoryLabelPreview = {
  id: string;
  product_id: string;
  label_code: string;
  qty_balance: number;
  used_qty: number;
  unit_label: string;
  status: string;
  batch_number: string | null;
  expiration_date: string | null;
};

type RpcLossResult = {
  loss_id: string;
  establishment_id: string;
  user_id: string;
  stock_before: number | null;
  stock_after: number | null;
  label_id: string | null;
  label_before: number | null;
  label_after: number | null;
};

const LOSS_REASONS = [
  "Fora do padrão",
  "Vencido",
  "Estragado",
  "Avaria / Quebra",
  "Testes",
  "Enviado para análise",
  "Foto Marketing",
  "Teste Empratamento",
  "Comida de Funcionário",
  "Outro",
] as const;

function formatDateTimeBR(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatDateBR(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  } catch {
    return iso;
  }
}

function formatMaybeNumber(n: any) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "-";
  return String(x);
}

export default function PerdasPage() {
  /* =========================
     STATE: PRODUTOS + HISTÓRICO
  ========================= */
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [losses, setLosses] = useState<LossRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingLosses, setLoadingLosses] = useState(false);

  /* =========================
     STATE: FORM
  ========================= */
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const [sku, setSku] = useState("");
  const [unitLabel, setUnitLabel] = useState("");

  const [qty, setQty] = useState<string>("1");
  const [lot, setLot] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [reasonDetail, setReasonDetail] = useState<string>("");
  const [qrcode, setQrcode] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);

  /* =========================
     STATE: PREVIEW ETIQUETA
  ========================= */
  const [labelPreview, setLabelPreview] = useState<InventoryLabelPreview | null>(
    null
  );
  const [labelError, setLabelError] = useState<string | null>(null);
  const [checkingLabel, setCheckingLabel] = useState(false);

  /* =========================
     STATE: FEEDBACK (SEM ALERT)
  ========================= */
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RpcLossResult | null>(null);

  /* =========================
     LOAD: PRODUTOS
  ========================= */
  async function loadProducts() {
    setLoadingProducts(true);
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      if (!res.ok) throw new Error("Falha ao carregar produtos.");
      const data = await res.json();

      const list: ProductOption[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.products)
        ? data.products
        : [];

      const normalized = list
        .map((p: any) => ({
          id: String(p.id),
          name: String(p.name ?? p.product_name ?? ""),
          sku: String(p.sku ?? ""),
          unit_label: String(p.unit_label ?? ""),
        }))
        .filter((p) => p.id && p.name);

      setProducts(normalized);
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message ?? "Erro ao carregar produtos.");
    } finally {
      setLoadingProducts(false);
    }
  }

  /* =========================
     LOAD: HISTÓRICO
  ========================= */
  async function loadLosses() {
    setLoadingLosses(true);
    try {
      const res = await fetch("/api/losses", { cache: "no-store" });
      if (!res.ok) {
        setLosses([]);
        return;
      }
      const data = await res.json();

      const list: LossRow[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.losses)
        ? data.losses
        : [];

      setLosses(list);
    } catch (err) {
      console.warn("Histórico não disponível.");
      setLosses([]);
    } finally {
      setLoadingLosses(false);
    }
  }

  useEffect(() => {
    loadProducts();
    loadLosses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
     AUTO: SKU + UNIDADE ao selecionar produto
  ========================= */
  useEffect(() => {
    if (!selectedProduct) {
      setSku("");
      setUnitLabel("");
      return;
    }
    setSku(selectedProduct.sku ?? "");
    setUnitLabel(selectedProduct.unit_label ?? "");
  }, [selectedProduct]);

  /* =========================
     PREVIEW QR
  ========================= */
  useEffect(() => {
    const code = qrcode.trim();

    if (!code || code.length < 3) {
      setLabelPreview(null);
      setLabelError(null);
      setCheckingLabel(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setCheckingLabel(true);
        setLabelError(null);

        const res = await fetch(
          `/api/inventory-labels/preview?code=${encodeURIComponent(code)}`,
          { signal: controller.signal, cache: "no-store" }
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data?.error ?? "Etiqueta inválida.");

        const label: InventoryLabelPreview | undefined = data?.label;
        if (!label) throw new Error("Resposta inválida do preview da etiqueta.");

        if (
          selectedProductId &&
          String(label.product_id) !== String(selectedProductId)
        ) {
          throw new Error("Este QR pertence a outro produto.");
        }

        setLabelPreview(label);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setLabelPreview(null);
          setLabelError(err?.message ?? "Erro ao validar etiqueta.");
        }
      } finally {
        setCheckingLabel(false);
      }
    }, 600);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [qrcode, selectedProductId]);

  /* =========================
     VALIDATION
  ========================= */
  const qtyNumber = useMemo(() => {
    const n = Number(String(qty).replace(",", "."));
    return Number.isFinite(n) ? n : NaN;
  }, [qty]);

  const canSubmit = useMemo(() => {
    if (!selectedProductId) return false;
    if (!reason) return false;
    if (!Number.isFinite(qtyNumber) || qtyNumber <= 0) return false;
    if (reason === "Outro" && reasonDetail.trim().length < 3) return false;

    if (qrcode.trim()) {
      if (checkingLabel) return false;
      if (labelError) return false;
      if (!labelPreview) return false;
      if (Number(labelPreview.qty_balance ?? 0) < qtyNumber) return false;
    }

    return true;
  }, [
    selectedProductId,
    reason,
    qtyNumber,
    reasonDetail,
    qrcode,
    checkingLabel,
    labelError,
    labelPreview,
  ]);

  /* =========================
     SUBMIT (SEM ALERT + RESUMO)
  ========================= */
  async function handleSubmit() {
    setSubmitError(null);
    setLastResult(null);

    if (!canSubmit) {
      setSubmitError("Preencha os campos obrigatórios corretamente.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product_id: selectedProductId,
        qty: qtyNumber,
        lot: lot.trim() ? lot.trim() : null,
        reason,
        reason_detail:
          reason === "Outro"
            ? reasonDetail.trim()
            : reasonDetail.trim()
            ? reasonDetail.trim()
            : null,
        qrcode: qrcode.trim() ? qrcode.trim() : null,
      };

      const res = await fetch("/api/losses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error ?? "Erro ao registrar perda.");
      }

      const result: RpcLossResult | null = data?.result ?? null;
      setLastResult(result);

      // Reset form
      setSelectedProductId("");
      setReason("");
      setReasonDetail("");
      setLot("");
      setQty("1");
      setQrcode("");

      // limpa preview também
      setLabelPreview(null);
      setLabelError(null);
      setCheckingLabel(false);

      // Atualiza histórico
      await loadLosses();
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message ?? "Erro ao registrar perda.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* =========================
          HEADER
      ========================= */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Perdas</h1>
        <p className="text-sm text-muted-foreground">
          Registre perdas com rastreabilidade. Ao confirmar, o sistema salva no
          histórico e dá baixa automática no estoque atual.
        </p>
      </div>

      {/* =========================
          RESUMO PÓS-REGISTRO
      ========================= */}
      {lastResult ? (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="text-base">Perda registrada ✅</CardTitle>
            <CardDescription>
              Resumo da operação (retorno transacional).
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Estoque</div>
              <div className="text-sm font-medium">
                {formatMaybeNumber(lastResult.stock_before)} →{" "}
                {formatMaybeNumber(lastResult.stock_after)}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Etiqueta</div>
              <div className="text-sm font-medium">
                {lastResult.label_id
                  ? `${formatMaybeNumber(lastResult.label_before)} → ${formatMaybeNumber(
                      lastResult.label_after
                    )}`
                  : "—"}
              </div>
              {!lastResult.label_id ? (
                <div className="text-xs text-muted-foreground">
                  (Sem QR informado)
                </div>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Registro</div>
              <div className="text-sm font-medium break-all">
                {lastResult.loss_id}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* =========================
          ERRO INLINE
      ========================= */}
      {submitError ? (
        <Card className="border-red-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-red-600">
              Não foi possível registrar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600">{submitError}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* =========================
          REGISTRAR PERDA
      ========================= */}
      <Card>
        <CardHeader>
          <CardTitle>Registrar perda</CardTitle>
          <CardDescription>
            Se o produto tiver etiqueta/QR Code, informe o código para validar e
            rastrear a baixa no lote/etiqueta.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Linha 1 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Produto *</Label>

              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      !selectedProductId && "text-muted-foreground"
                    )}
                    disabled={loadingProducts}
                  >
                    {selectedProduct ? selectedProduct.name : "Selecione..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Buscar produto..." />
                    <CommandList>
                      <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
                      <CommandGroup>
                        {products.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${p.sku}`.trim()}
                            onSelect={() => {
                              setSelectedProductId(p.id);
                              setProductOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProductId === p.id
                                  ? "opacity-100"
                                  : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="text-sm">{p.name}</span>
                              <span className="text-xs text-muted-foreground">
                                SKU: {p.sku || "-"} • Unidade:{" "}
                                {p.unit_label || "-"}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={loadProducts}
                  disabled={loadingProducts}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Atualizar lista
                </Button>

                {loadingProducts ? (
                  <Badge variant="secondary">Carregando...</Badge>
                ) : (
                  <Badge variant="outline">{products.length} itens</Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={sku} readOnly placeholder="Automático" />
            </div>

            <div className="space-y-2">
              <Label>Unidade</Label>
              <Input value={unitLabel} readOnly placeholder="Automático" />
            </div>
          </div>

          {/* Linha 2 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Qtd *</Label>
              <Input
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="Ex.: 1"
              />
              <p className="text-xs text-muted-foreground">
                Use ponto ou vírgula para decimais (ex.: 0,5).
              </p>
            </div>

            <div className="space-y-2">
              <Label>Lote</Label>
              <Input
                value={lot}
                onChange={(e) => setLot(e.target.value)}
                placeholder="Ex.: L2401"
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {LOSS_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {reason ? (
                <div className="flex flex-wrap gap-2">
                  <Badge>{reason}</Badge>
                  {reason === "Vencido" && (
                    <Badge variant="secondary">Sugestão: informe o lote</Badge>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Linha 3 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>
                Detalhe do motivo{" "}
                {reason === "Outro" ? (
                  <span className="text-red-500">*</span>
                ) : null}
              </Label>
              <Textarea
                value={reasonDetail}
                onChange={(e) => setReasonDetail(e.target.value)}
                placeholder={
                  reason === "Outro"
                    ? "Descreva o motivo..."
                    : "Opcional (ex.: observações)"
                }
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>QR Code (Etiqueta)</Label>
              <Input
                value={qrcode}
                onChange={(e) => setQrcode(e.target.value)}
                placeholder="Cole ou digite o QR Code (label_code)"
              />

              {checkingLabel ? (
                <p className="text-xs text-muted-foreground">
                  Validando etiqueta...
                </p>
              ) : null}

              {labelError ? (
                <p className="text-xs text-red-500">{labelError}</p>
              ) : null}

              {labelPreview ? (
                <Card className="mt-2 border-dashed">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Etiqueta encontrada</CardTitle>
                    <CardDescription>
                      Confirme saldo e lote antes de registrar.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">
                        Saldo disponível
                      </span>
                      <div className="font-medium">
                        {labelPreview.qty_balance} {labelPreview.unit_label}
                      </div>

                      {Number.isFinite(qtyNumber) &&
                      qtyNumber > 0 &&
                      labelPreview.qty_balance < qtyNumber ? (
                        <p className="mt-1 text-xs text-red-500">
                          Saldo insuficiente para a quantidade informada.
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <span className="text-muted-foreground">Status</span>
                      <div className="font-medium">{labelPreview.status}</div>
                    </div>

                    <div className="col-span-2">
                      <span className="text-muted-foreground">Código</span>
                      <div className="font-medium">{labelPreview.label_code}</div>
                    </div>

                    {labelPreview.batch_number ? (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Lote</span>
                        <div className="font-medium">
                          {labelPreview.batch_number}
                        </div>
                      </div>
                    ) : null}

                    {labelPreview.expiration_date ? (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Validade</span>
                        <div className="font-medium">
                          {formatDateBR(labelPreview.expiration_date)}
                        </div>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Se informar QR, o sistema valida e dá baixa também no saldo da
                  etiqueta.
                </p>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSelectedProductId("");
                setReason("");
                setReasonDetail("");
                setLot("");
                setQty("1");
                setQrcode("");

                setLabelPreview(null);
                setLabelError(null);
                setCheckingLabel(false);

                setSubmitError(null);
                setLastResult(null);
              }}
              disabled={submitting}
            >
              Limpar
            </Button>

            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? "Registrando..." : "Registrar perda"}
            </Button>
          </div>

          {!canSubmit ? (
            <p className="text-xs text-muted-foreground">
              Obrigatórios: Produto, Qtd &gt; 0 e Motivo. Se motivo = “Outro”,
              detalhe com pelo menos 3 caracteres. Se informar QR, precisa ser
              válido e ter saldo.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* =========================
          HISTÓRICO
      ========================= */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Histórico de perdas</CardTitle>
            <CardDescription>Consulte registros anteriores.</CardDescription>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={loadLosses}
            disabled={loadingLosses}
          >
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar histórico
          </Button>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="w-[120px]">SKU</TableHead>
                  <TableHead className="w-[110px] text-right">Qtd</TableHead>
                  <TableHead className="w-[110px]">Unid</TableHead>
                  <TableHead className="w-[160px]">Motivo</TableHead>
                  <TableHead className="w-[140px]">Lote</TableHead>
                  <TableHead className="w-[220px]">QR (label_code)</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loadingLosses ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-sm text-muted-foreground"
                    >
                      Carregando histórico...
                    </TableCell>
                  </TableRow>
                ) : losses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-sm text-muted-foreground"
                    >
                      Nenhum registro.
                    </TableCell>
                  </TableRow>
                ) : (
                  losses.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="align-top">
                        {formatDateTimeBR(row.created_at)}
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {row.product_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.stock_before != null && row.stock_after != null
                              ? `Estoque: ${row.stock_before} → ${row.stock_after}`
                              : ""}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <span className="text-sm">{row.sku || "-"}</span>
                      </TableCell>

                      <TableCell className="align-top text-right">
                        <span className="text-sm">{row.qty}</span>
                      </TableCell>

                      <TableCell className="align-top">
                        <Badge variant="secondary">{row.unit_label || "-"}</Badge>
                      </TableCell>

                      <TableCell className="align-top">
                        <div className="flex flex-col gap-1">
                          <Badge>{row.reason}</Badge>
                          {row.reason_detail ? (
                            <span className="text-xs text-muted-foreground line-clamp-2">
                              {row.reason_detail}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="align-top">
                        <span className="text-sm">{row.lot ?? "-"}</span>
                      </TableCell>

                      <TableCell className="align-top">
                        <span className="text-xs text-muted-foreground">
                          {row.qrcode ?? "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
