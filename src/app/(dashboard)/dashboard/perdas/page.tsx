"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, RefreshCcw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
  unit_label: string;
  standard_cost: number | null;
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

const CURRENCY = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatQty(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(number);
}

function formatDateTimeBR(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateBR(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function toDecimal(value: string) {
  const number = Number(String(value).replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartISO() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export default function PerdasPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [losses, setLosses] = useState<LossRow[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [loadingLosses, setLoadingLosses] = useState(false);
  const [productsError, setProductsError] = useState("");

  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState("1");
  const [lot, setLot] = useState("");
  const [reason, setReason] = useState("");
  const [reasonDetail, setReasonDetail] = useState("");
  const [qrcode, setQrcode] = useState("");

  const [filterProductId, setFilterProductId] = useState("");
  const [filterReason, setFilterReason] = useState("");
  const [dateFrom, setDateFrom] = useState(monthStartISO());
  const [dateTo, setDateTo] = useState(todayISO());

  const [labelPreview, setLabelPreview] = useState<InventoryLabelPreview | null>(null);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [checkingLabel, setCheckingLabel] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RpcLossResult | null>(null);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId]
  );

  const qtyNumber = useMemo(() => toDecimal(qty), [qty]);

  const filteredProductOptions = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    if (!search) return products.slice(0, 80);

    return products
      .filter((product) =>
        `${product.name} ${product.sku}`.toLowerCase().includes(search)
      )
      .slice(0, 80);
  }, [products, productSearch]);

  const summary = useMemo(() => {
    const totalQty = losses.reduce((sum, item) => sum + Number(item.qty || 0), 0);
    const estimatedCost = losses.reduce((sum, item) => {
      const product = products.find((p) => p.id === item.product_id);
      return sum + Number(item.qty || 0) * Number(product?.standard_cost || 0);
    }, 0);

    const reasonMap = new Map<string, number>();
    const productMap = new Map<string, number>();

    for (const item of losses) {
      reasonMap.set(item.reason, (reasonMap.get(item.reason) ?? 0) + 1);
      productMap.set(
        item.product_name,
        (productMap.get(item.product_name) ?? 0) + Number(item.qty || 0)
      );
    }

    const topReason = [...reasonMap.entries()].sort((a, b) => b[1] - a[1])[0];
    const topProduct = [...productMap.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      totalRecords: losses.length,
      totalQty,
      estimatedCost,
      topReason: topReason?.[0] ?? "-",
      topProduct: topProduct?.[0] ?? "-",
    };
  }, [losses, products]);

  const canSubmit = useMemo(() => {
    if (!selectedProductId) return false;
    if (!reason) return false;
    if (!Number.isFinite(qtyNumber) || qtyNumber <= 0) return false;
    if (reason === "Outro" && reasonDetail.trim().length < 3) return false;

    if (qrcode.trim()) {
      if (checkingLabel || labelError || !labelPreview) return false;
      if (String(labelPreview.product_id) !== String(selectedProductId)) return false;
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

  async function loadProducts() {
    setLoadingProducts(true);
    setProductsError("");

    try {
      const response = await fetch("/api/products/catalog", { cache: "no-store" });
      const data = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(data?.error ?? "Falha ao carregar produtos.");
      }

      const rows = Array.isArray(data) ? data : Array.isArray(data?.products) ? data.products : [];

      setProducts(
        rows
          .map((product: any) => ({
            id: String(product.id ?? ""),
            name: String(product.name ?? product.product_name ?? ""),
            sku: String(product.sku ?? ""),
            unit_label: String(product.default_unit_label ?? product.unit_label ?? product.unit ?? "UN"),
            standard_cost:
              product.standard_cost == null || Number.isNaN(Number(product.standard_cost))
                ? null
                : Number(product.standard_cost),
          }))
          .filter((product: ProductOption) => product.id && product.name)
      );
    } catch (error: any) {
      console.error(error);
      setProducts([]);
      setProductsError(error?.message ?? "Erro ao carregar produtos.");
    } finally {
      setLoadingProducts(false);
    }
  }

  async function loadLosses() {
    setLoadingLosses(true);

    try {
      const params = new URLSearchParams();
      if (filterProductId) params.set("product_id", filterProductId);
      if (filterReason) params.set("reason", filterReason);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      params.set("limit", "250");

      const response = await fetch(`/api/losses?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "Falha ao carregar histórico de perdas.");
      }

      setLosses(Array.isArray(data?.losses) ? data.losses : []);
    } catch (error) {
      console.warn("Histórico de perdas não disponível:", error);
      setLosses([]);
    } finally {
      setLoadingLosses(false);
    }
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  useEffect(() => {
    void loadLosses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProductId, filterReason, dateFrom, dateTo]);

  useEffect(() => {
    const code = qrcode.trim();

    if (!code || code.length < 3) {
      setLabelPreview(null);
      setLabelError(null);
      setCheckingLabel(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setCheckingLabel(true);
        setLabelError(null);

        const response = await fetch(
          `/api/inventory-labels/preview?code=${encodeURIComponent(code)}`,
          { signal: controller.signal, cache: "no-store" }
        );
        const data = await response.json().catch(() => ({}));

        if (!response.ok) throw new Error(data?.error ?? "Etiqueta inválida.");

        const label = data?.label as InventoryLabelPreview | undefined;
        if (!label) throw new Error("Resposta inválida da etiqueta.");

        if (selectedProductId && String(label.product_id) !== String(selectedProductId)) {
          throw new Error("Este QR pertence a outro produto.");
        }

        if (Number(label.qty_balance ?? 0) <= 0) {
          throw new Error("Esta etiqueta não possui saldo disponível.");
        }

        setLabelPreview(label);
      } catch (error: any) {
        if (error?.name !== "AbortError") {
          setLabelPreview(null);
          setLabelError(error?.message ?? "Erro ao validar etiqueta.");
        }
      } finally {
        setCheckingLabel(false);
      }
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [qrcode, selectedProductId]);

  function resetForm() {
    setSelectedProductId("");
    setProductSearch("");
    setQty("1");
    setLot("");
    setReason("");
    setReasonDetail("");
    setQrcode("");
    setLabelPreview(null);
    setLabelError(null);
    setSubmitError(null);
  }

  async function handleSubmit() {
    setSubmitError(null);
    setLastResult(null);

    if (!canSubmit || !selectedProduct) {
      setSubmitError("Preencha os campos obrigatórios corretamente.");
      return;
    }

    const confirmed = window.confirm(
      `Confirmar baixa de ${formatQty(qtyNumber)} ${selectedProduct.unit_label} do produto ${selectedProduct.name}?`
    );

    if (!confirmed) return;

    setSubmitting(true);

    try {
      const response = await fetch("/api/losses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: selectedProduct.id,
          qty: qtyNumber,
          unit_label: selectedProduct.unit_label || "UN",
          lot: lot.trim() || null,
          reason,
          reason_detail: reasonDetail.trim() || null,
          qrcode: qrcode.trim() || null,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "Erro ao registrar perda.");

      setLastResult(data?.result ?? null);
      resetForm();
      await loadLosses();
    } catch (error: any) {
      console.error(error);
      setSubmitError(error?.message ?? "Erro ao registrar perda.");
    } finally {
      setSubmitting(false);
    }
  }

  function exportCsv() {
    const params = new URLSearchParams();
    if (filterProductId) params.set("product_id", filterProductId);
    if (filterReason) params.set("reason", filterReason);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    window.open(`/api/export/losses?${params.toString()}`, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Perdas</h1>
          <p className="text-sm text-muted-foreground">
            Registre baixas por perda com validação de produto, motivo, etiqueta e saldo.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Registros no filtro</CardDescription>
            <CardTitle>{summary.totalRecords}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Quantidade total</CardDescription>
            <CardTitle>{formatQty(summary.totalQty)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Custo estimado</CardDescription>
            <CardTitle>{CURRENCY.format(summary.estimatedCost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Motivo mais frequente</CardDescription>
            <CardTitle className="text-base">{summary.topReason}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {lastResult ? (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-5 w-5" />
              Perda registrada com sucesso
            </CardTitle>
            <CardDescription>
              Estoque: {formatQty(lastResult.stock_before)} para {formatQty(lastResult.stock_after)}
              {lastResult.label_id
                ? ` | Etiqueta: ${formatQty(lastResult.label_before)} para ${formatQty(lastResult.label_after)}`
                : ""}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {submitError ? (
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="flex gap-2 pt-6 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {submitError}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Registrar perda</CardTitle>
          <CardDescription>
            A baixa é confirmada antes do envio e o backend valida produto, empresa, motivo e saldo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr]">
            <div className="space-y-2">
              <Label>Buscar produto *</Label>
              <Input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Digite nome ou SKU"
              />
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                disabled={loadingProducts}
              >
                <option value="">Selecione um produto</option>
                {filteredProductOptions.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} {product.sku ? `- ${product.sku}` : ""}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {productsError ? <span className="text-red-600">{productsError}</span> : null}
                <Badge variant="outline">{products.length} produtos ativos</Badge>
                <Button type="button" variant="ghost" size="sm" onClick={loadProducts} disabled={loadingProducts}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={selectedProduct?.sku ?? ""} readOnly placeholder="Automático" />
            </div>
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Input value={selectedProduct?.unit_label ?? ""} readOnly placeholder="Automático" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Quantidade *</Label>
              <Input inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} />
              <p className="text-xs text-muted-foreground">Aceita ponto ou vírgula para decimais.</p>
            </div>
            <div className="space-y-2">
              <Label>Lote</Label>
              <Input value={lot} onChange={(event) => setLot(event.target.value)} placeholder="Opcional" />
            </div>
            <div className="space-y-2">
              <Label>Motivo *</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                <option value="">Selecione</option>
                {LOSS_REASONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <Label>Detalhe do motivo {reason === "Outro" ? "*" : ""}</Label>
              <Textarea
                value={reasonDetail}
                onChange={(event) => setReasonDetail(event.target.value)}
                rows={5}
                placeholder={reason === "Outro" ? "Descreva o motivo" : "Observação opcional"}
              />
            </div>
            <div className="space-y-2">
              <Label>QR Code / etiqueta</Label>
              <Input
                value={qrcode}
                onChange={(event) => setQrcode(event.target.value)}
                placeholder="Opcional: cole o código da etiqueta"
              />
              {checkingLabel ? <p className="text-xs text-muted-foreground">Validando etiqueta...</p> : null}
              {labelError ? <p className="text-xs text-red-600">{labelError}</p> : null}
              {labelPreview ? (
                <div className="rounded-md border border-dashed p-3 text-sm">
                  <div className="font-medium">Etiqueta validada</div>
                  <div className="text-muted-foreground">
                    Saldo: {formatQty(labelPreview.qty_balance)} {labelPreview.unit_label} | Status: {labelPreview.status}
                  </div>
                  {labelPreview.batch_number ? (
                    <div className="text-muted-foreground">Lote: {labelPreview.batch_number}</div>
                  ) : null}
                  {labelPreview.expiration_date ? (
                    <div className="text-muted-foreground">Validade: {formatDateBR(labelPreview.expiration_date)}</div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Quando informado, o QR valida produto e saldo antes da baixa.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={resetForm} disabled={submitting}>
              Limpar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? "Registrando..." : "Registrar perda"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle>Histórico e auditoria</CardTitle>
              <CardDescription>
                Filtre por período, produto ou motivo para conferência operacional.
              </CardDescription>
            </div>
            <Button type="button" variant="secondary" onClick={loadLosses} disabled={loadingLosses}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>De</Label>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Até</Label>
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Produto</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={filterProductId}
                onChange={(event) => setFilterProductId(event.target.value)}
              >
                <option value="">Todos</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Motivo</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={filterReason}
                onChange={(event) => setFilterReason(event.target.value)}
              >
                <option value="">Todos</option>
                {LOSS_REASONS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Qtd</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Lote / QR</TableHead>
                  <TableHead>Estoque</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLosses ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      Carregando histórico...
                    </TableCell>
                  </TableRow>
                ) : losses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      Nenhuma perda encontrada para os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  losses.map((loss) => (
                    <TableRow key={loss.id}>
                      <TableCell className="align-top text-sm">{formatDateTimeBR(loss.created_at)}</TableCell>
                      <TableCell className="align-top">
                        <div className="font-medium">{loss.product_name}</div>
                        <div className="text-xs text-muted-foreground">SKU: {loss.sku || "-"}</div>
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {formatQty(loss.qty)} {loss.unit_label || ""}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge>{loss.reason}</Badge>
                        {loss.reason_detail ? (
                          <div className="mt-1 max-w-xs text-xs text-muted-foreground">{loss.reason_detail}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        <div>Lote: {loss.lot || "-"}</div>
                        <div className="max-w-[220px] truncate text-xs text-muted-foreground">QR: {loss.qrcode || "-"}</div>
                      </TableCell>
                      <TableCell className="align-top text-sm">
                        {loss.stock_before != null && loss.stock_after != null
                          ? `${formatQty(loss.stock_before)} → ${formatQty(loss.stock_after)}`
                          : "-"}
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
