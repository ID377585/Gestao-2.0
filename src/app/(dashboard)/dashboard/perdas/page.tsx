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
import {
  Check,
  ChevronsUpDown,
  Download,
  ImageIcon,
  RefreshCcw,
  X,
} from "lucide-react";
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
  photo_path: string | null;
  photo_file_name: string | null;
  photo_mime_type: string | null;

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

const MAX_LOSS_PHOTO_BYTES = 5 * 1024 * 1024;
const ACCEPTED_LOSS_PHOTO_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
];

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Erro ao ler a foto."));
    reader.readAsDataURL(file);
  });
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function buildLossPhotoUrl(path: string) {
  return `/api/losses/photo?path=${encodeURIComponent(path)}`;
}

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

  // ✅ NOVO: erro real do carregamento de produtos (não misturar com submitError)
  const [productsError, setProductsError] = useState<string>("");

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string>("");
  const [photoError, setPhotoError] = useState<string>("");

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
  const [submitWarning, setSubmitWarning] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RpcLossResult | null>(null);

  /* =========================
     LOAD: PRODUTOS
  ========================= */
  async function loadProducts() {
    setLoadingProducts(true);
    setProductsError("");
    try {
      const res = await fetch("/api/products", { cache: "no-store" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Falha ao carregar produtos.");
      }

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
          // ✅ AJUSTE: no seu print a coluna é default_unit_label
          unit_label: String(
            p.unit_label ?? p.default_unit_label ?? p.unit ?? ""
          ),
        }))
        .filter((p) => p.id && p.name);

      setProducts(normalized);
    } catch (err: any) {
      console.error(err);
      setProducts([]);
      setProductsError(err?.message ?? "Erro ao carregar produtos.");
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

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // mantém comportamento anterior (não quebrar UI)
        console.warn("Falha ao carregar perdas:", data?.error ?? res.statusText);
        setLosses([]);
        return;
      }

      // ✅ AJUSTE: sua API retorna { losses: [...] } — manter consistente
      const list: LossRow[] = Array.isArray(data?.losses) ? data.losses : [];
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

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl("");
      return;
    }

    const objectUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [photoFile]);

  function handlePhotoChange(file: File | null) {
    setPhotoError("");

    if (!file) {
      setPhotoFile(null);
      return;
    }

    if (!ACCEPTED_LOSS_PHOTO_TYPES.includes(file.type)) {
      setPhotoFile(null);
      setPhotoError("Use uma foto em JPG, PNG, WEBP, HEIC ou HEIF.");
      return;
    }

    if (file.size > MAX_LOSS_PHOTO_BYTES) {
      setPhotoFile(null);
      setPhotoError("A foto precisa ter no máximo 5MB.");
      return;
    }

    setPhotoFile(file);
  }

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
    setSubmitWarning(null);
    setLastResult(null);

    if (!canSubmit) {
      setSubmitError("Preencha os campos obrigatórios corretamente.");
      return;
    }

    setSubmitting(true);
    try {
      const photoPayload = photoFile
        ? {
            dataUrl: await fileToDataUrl(photoFile),
            fileName: photoFile.name,
            mimeType: photoFile.type,
          }
        : null;

      const payload = {
  product_id: selectedProductId,
  qty: qtyNumber,
  unit_label: unitLabel || selectedProduct?.unit_label || "UN",
  lot: lot.trim() ? lot.trim() : null,
  reason,
  reason_detail:
    reason === "Outro"
      ? reasonDetail.trim()
      : reasonDetail.trim()
      ? reasonDetail.trim()
      : null,
  qrcode: qrcode.trim() ? qrcode.trim() : null,
  photo: photoPayload,
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
      setSubmitWarning(data?.photoError ? String(data.photoError) : null);

      // Reset form
      setSelectedProductId("");
      setReason("");
      setReasonDetail("");
      setLot("");
      setQty("1");
      setQrcode("");
      setPhotoFile(null);
      setPhotoError("");

      // limpa preview também
      setLabelPreview(null);
      setLabelError(null);
      setCheckingLabel(false);

      // Atualiza histórico
      await loadLosses();
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message ?? "Erro ao registrar perda.");
      setSubmitWarning(null);
    } finally {
      setSubmitting(false);
    }
  }

  /* =========================
     EXPORT CSV (NOVO - SEGURO)
  ========================= */
  function handleExportCSV() {
    window.open("/api/export/losses", "_blank");
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Perdas</h1>
        <p className="text-sm text-muted-foreground">
          Registre perdas com rastreabilidade. Ao confirmar, o sistema salva no
          histórico e dá baixa automática no estoque atual.
        </p>
      </div>

      {/* RESUMO PÓS-REGISTRO */}
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
                  ? `${formatMaybeNumber(
                      lastResult.label_before
                    )} → ${formatMaybeNumber(lastResult.label_after)}`
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

      {submitWarning ? (
        <Card className="border-amber-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-700">
              Atenção no anexo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700">{submitWarning}</p>
          </CardContent>
        </Card>
      ) : null}

      {/* ERRO INLINE */}
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

      {/* REGISTRAR PERDA */}
      <Card>
        <CardHeader>
          <CardTitle>Registrar perda</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Linha 1 */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Produto *</Label>

              {/* ✅ AJUSTADO: Trigger consistente (asChild + button) + debug dentro */}
              <Popover
                modal={false}
                open={productOpen}
                onOpenChange={(open) => {
                  setProductOpen(open);
                  if (open) {
                    requestAnimationFrame(() => {
                      window.dispatchEvent(new Event("resize"));
                    });
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    role="combobox"
                    aria-expanded={productOpen}
                    aria-controls="loss-product-combobox"
                    aria-haspopup="listbox"
                    className={cn(
                      "w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
                      !selectedProductId && "text-muted-foreground",
                      loadingProducts && "opacity-60 pointer-events-none"
                    )}
                  >
                    {selectedProduct ? selectedProduct.name : "Selecione..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  align="start"
                  side="bottom"
                  sideOffset={6}
                  avoidCollisions
                  collisionPadding={12}
                  updatePositionStrategy="always"
                  sticky="always"
                  className={cn(
                    "p-0 z-[99999] border shadow-md",
                    "bg-white text-gray-900",
                    "min-w-[520px] w-auto max-w-[90vw]"
                  )}
                >
                  <Command className="bg-white text-gray-900">
                    <CommandInput
                      placeholder="Buscar produto..."
                      className="bg-white text-gray-900"
                    />

                    {/* ✅ DEBUG VISUAL (igual Etiquetas) */}
                    <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-white">
                      {loadingProducts ? (
                        <>Carregando produtos...</>
                      ) : productsError ? (
                        <span className="text-red-600">{productsError}</span>
                      ) : (
                        <>
                          Produtos carregados: <strong>{products.length}</strong>
                        </>
                      )}
                    </div>

                    <CommandList
                      id="loss-product-combobox"
                      className="max-h-[360px] overflow-auto bg-white"
                    >
                      <CommandEmpty className="text-gray-600">
                        {loadingProducts
                          ? "Carregando..."
                          : "Nenhum produto encontrado."}
                      </CommandEmpty>

                      <CommandGroup className="bg-white">
                        {products.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={`${p.name} ${p.sku}`.trim()}
                            onSelect={() => {
                              setSelectedProductId(p.id);
                              setProductOpen(false);
                            }}
                            className={cn(
                              "bg-white text-gray-900",
                              "data-[selected=true]:bg-gray-100 data-[selected=true]:text-gray-900"
                            )}
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
                              <span className="text-sm whitespace-normal break-words leading-snug">
                                {p.name}
                              </span>
                              <span className="text-xs text-muted-foreground whitespace-normal break-words">
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
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label>Foto da perda</Label>
              <Input
                key={photoFile ? "photo-selected" : "photo-empty"}
                type="file"
                accept={ACCEPTED_LOSS_PHOTO_TYPES.join(",")}
                onChange={(e) =>
                  handlePhotoChange(e.currentTarget.files?.[0] ?? null)
                }
              />

              {photoError ? (
                <p className="text-xs text-red-500">{photoError}</p>
              ) : null}

              {photoFile ? (
                <div className="flex items-center gap-3 rounded-md border p-2">
                  {photoPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreviewUrl}
                      alt="Foto selecionada"
                      className="h-14 w-14 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded bg-muted">
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {photoFile.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(photoFile.size)}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setPhotoFile(null);
                      setPhotoError("");
                    }}
                    aria-label="Remover foto"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WEBP, HEIC ou HEIF até 5MB.
                </p>
              )}
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
                setPhotoFile(null);
                setPhotoError("");

                setLabelPreview(null);
                setLabelError(null);
                setCheckingLabel(false);

                setSubmitError(null);
                setSubmitWarning(null);
                setLastResult(null);

                setProductOpen(false);
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
              detalhe com pelo menos 3 caracteres. Se anexar foto, use um
              arquivo válido de até 5MB.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* HISTÓRICO */}
      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Histórico de perdas</CardTitle>
            <CardDescription>Consulte registros anteriores.</CardDescription>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="secondary"
              onClick={loadLosses}
              disabled={loadingLosses}
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar histórico
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleExportCSV}
              disabled={loadingLosses}
              title="Baixar CSV do histórico de perdas"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          </div>
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
                  <TableHead className="w-[110px]">Foto</TableHead>
                  <TableHead className="w-[140px]">Lote</TableHead>
                  <TableHead className="w-[220px]">QR (label_code)</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {loadingLosses ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-sm text-muted-foreground"
                    >
                      Carregando histórico...
                    </TableCell>
                  </TableRow>
                ) : losses.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
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
                        <Badge variant="secondary">
                          {row.unit_label || "-"}
                        </Badge>
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
                        {row.photo_path ? (
                          <a
                            href={buildLossPhotoUrl(row.photo_path)}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                          >
                            <ImageIcon className="h-4 w-4" />
                            Ver
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            -
                          </span>
                        )}
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
