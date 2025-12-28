"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { OrderStatusStepper } from "@/components/orders/OrderStatusStepper";
import { useToast } from "@/hooks/use-toast";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useOrderRealtime } from "@/lib/supabase/realtime/useOrderRealtime";

import {
  acceptOrder,
  advanceOrder,
  cancelOrder,
  reopenOrder,
  getMyMembership,
  getOrderById,
  getOrderTimeline,
  listOrderItems,
  linkLabelToOrder, // action já validado
  getOrderCollectedSummary,
  getOrderBillingDraft,
  saveOrderBillingDraft,
  listCarriers,
  type OrderCollectedSummary,
} from "../actions";

type OrderDetails = Awaited<ReturnType<typeof getOrderById>>;
type Timeline = Awaited<ReturnType<typeof getOrderTimeline>>;
type BillingDraft = Awaited<ReturnType<typeof getOrderBillingDraft>>;

type Role =
  | "cliente"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "admin"
  | "entrega";

type OrderItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_label: string;
};

type CarrierEntity = {
  id: string;
  name: string;
  is_active: boolean;
};

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("pt-BR");

const formatCurrency = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const STATUS_LABEL: Record<string, string> = {
  pedido_criado: "Pedido criado",
  aceitou_pedido: "Pedido aceito",
  em_preparo: "Em preparo",
  em_separacao: "Em separação",
  em_faturamento: "Em faturamento",
  em_transporte: "Em transporte",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function getStatusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

function getAdvanceActionLabel(status: string) {
  switch (status) {
    case "aceitou_pedido":
      return "Iniciar preparo";
    case "em_preparo":
      return "Enviar para separação";
    case "em_separacao":
      return "Enviar para faturamento";
    case "em_faturamento":
      return "Despachar para transporte";
    case "em_transporte":
      return "Confirmar entrega";
    default:
      return "Avançar status";
  }
}

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "cancelado") return "destructive";
  if (status === "entregue") return "default";
  if (status === "pedido_criado") return "secondary";
  return "outline";
}

/**
 * 🔐 REGRAS:
 * - Admin: pode cancelar em TODAS as etapas (exceto quando já está cancelado)
 * - Papéis fixos (operacao/producao/estoque/fiscal): podem cancelar até em_faturamento
 * - Entrega: NÃO cancela em nenhuma etapa (mas pode avançar em em_transporte)
 * - Reabrir: admin + papéis fixos, somente quando status = cancelado
 */
function canAct(role: Role | null, status: string) {
  const base = {
    canAccept: false,
    canAdvance: false,
    canCancel: false,
    canReopen: false,
  };

  if (!role) return base;

  const isAdmin = role === "admin";
  const isFixedOps = ["operacao", "producao", "estoque", "fiscal"].includes(
    role
  );
  const isEntrega = role === "entrega";
  const isCliente = role === "cliente";

  // ✅ Reabrir: só quando cancelado
  if (status === "cancelado") {
    return {
      ...base,
      canReopen: isAdmin || isFixedOps,
    };
  }

  // ✅ Aceitar: só quando criado (admin/operacao/producao)
  const canAccept =
    status === "pedido_criado" &&
    (isAdmin || role === "operacao" || role === "producao");

  // ✅ Avançar: segue seu fluxo (entrega só avança em transporte)
  let canAdvance = false;

  if (status === "aceitou_pedido" || status === "em_preparo") {
    canAdvance = isAdmin || role === "operacao" || role === "producao";
  } else if (status === "em_separacao") {
    canAdvance =
      isAdmin || role === "operacao" || role === "producao" || role === "estoque";
  } else if (status === "em_faturamento") {
    canAdvance = isAdmin || role === "estoque" || role === "fiscal";
  } else if (status === "em_transporte") {
    canAdvance = isAdmin || role === "entrega" || role === "fiscal";
  }

  // ✅ Cancelar
  const canCancelAdmin = isAdmin && status !== "cancelado";
  const canCancelFixedOps =
    isFixedOps &&
    [
      "pedido_criado",
      "aceitou_pedido",
      "em_preparo",
      "em_separacao",
      "em_faturamento",
    ].includes(status);

  const canCancel =
    !isCliente &&
    !isEntrega &&
    status !== "cancelado" &&
    (canCancelAdmin || canCancelFixedOps);

  // Se entregue: ninguém aceita/avança, mas admin pode cancelar
  if (status === "entregue") {
    return {
      canAccept: false,
      canAdvance: false,
      canCancel: canCancelAdmin,
      canReopen: false,
    };
  }

  return { canAccept, canAdvance, canCancel, canReopen: false };
}

/* ===========================================================
   🔹 Bloco "Separar produtos para o pedido:"
   - Só aparece quando status = "em_separacao"
   - Botão "Coletar QR" abre câmera e lê o código
   - Não permite digitação manual do label_code nem da quantidade
=========================================================== */

type QuickLinkLabelSectionProps = {
  orderId: string;
  defaultQty: number | null;
  onLinked?: (summary: OrderCollectedSummary) => void;
};

function QuickLinkLabelSection({
  orderId,
  defaultQty,
  onLinked,
}: QuickLinkLabelSectionProps) {
  const [labelCode, setLabelCode] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanActiveRef = useRef(false);

  // 🔚 encerra stream da câmera
  const stopStream = () => {
    scanActiveRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // 🔁 inicia a câmera + detecção de QR (quando dialog abre)
  useEffect(() => {
    if (!scanOpen) {
      stopStream();
      return;
    }

    const startScan = async () => {
      setScanError(null);

      if (typeof navigator === "undefined" || !navigator.mediaDevices) {
        setScanError("Este dispositivo não permite acesso à câmera.");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        streamRef.current = stream;
        scanActiveRef.current = true;

        if (videoRef.current) {
          (videoRef.current as any).srcObject = stream;
          await videoRef.current.play();
        }

        const hasBarcodeDetector =
          typeof (window as any).BarcodeDetector !== "undefined";

        if (!hasBarcodeDetector) {
          setScanError(
            "Seu navegador não suporta leitura automática de QR Code. Tente usar outro navegador/dispositivo."
          );
          return;
        }

        const detector = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });

        const loop = async () => {
          if (!scanActiveRef.current || !videoRef.current) return;

          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes && barcodes.length > 0) {
              const value = barcodes[0].rawValue as string;
              scanActiveRef.current = false;
              setScanOpen(false);

              // Preenche o campo apenas para visualização
              setLabelCode(value);

              // Dispara o vínculo de fato
              await performLink(value);
              return;
            }
          } catch (err) {
            console.error("Erro ao detectar QR:", err);
          }

          requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
      } catch (err: any) {
        console.error("Erro ao acessar câmera:", err);
        setScanError(
          err?.message ?? "Não foi possível acessar a câmera deste dispositivo."
        );
      }
    };

    void startScan();

    return () => {
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanOpen]);

  // 👇 função que de fato chama a action
  const performLink = async (code: string) => {
    try {
      const trimmed = code.trim();
      if (!trimmed) {
        alert("Código de etiqueta inválido.");
        return;
      }

      const result = await linkLabelToOrder({
        orderId,
        labelCode: trimmed,
      });

      // ✅ Mensagem simples para o operador
      alert(result.message || "Produto coletado!");

      // limpa apenas o código para não reaproveitar
      setLabelCode("");

      if (onLinked) {
        onLinked(result.collectedSummary);
      }
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Erro ao vincular etiqueta.");
    }
  };

  // Clique no botão → abre diálogo de câmera
  const handleOpenScan = () => {
    setScanOpen(true);
  };

  return (
    <>
      <div className="mt-4 border rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-xs">⚙️</span>
          <span>Separar produtos para o pedido:</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] gap-3 items-end">
          <div className="space-y-1">
            <Label htmlFor="label-code">Código da etiqueta (label_code)</Label>
            <Input
              id="label-code"
              value={labelCode}
              readOnly
              placeholder="Coletado via QR Code"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="label-qty">Quantidade do pedido</Label>
            <Input
              id="label-qty"
              type="number"
              readOnly
              disabled
              value={defaultQty ?? ""}
              placeholder={
                defaultQty && defaultQty > 0 ? String(defaultQty) : "—"
              }
            />
          </div>

          <div className="flex items-end">
            <Button type="button" onClick={handleOpenScan} className="w-full">
              Coletar QR
            </Button>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Ao coletar os QRs das etiquetas, o sistema registra a saída no estoque
          e vincula automaticamente ao pedido até completar a quantidade solicitada.
        </p>
      </div>

      {/* 📷 Dialog de leitura do QR */}
      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="w-full max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Coletar QR da etiqueta</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Aponte a câmera para o QR Code da etiqueta. Assim que o código for
              reconhecido, a etiqueta será vinculada automaticamente ao pedido.
            </p>

            <div className="w-full aspect-video bg-black rounded-md overflow-hidden flex items-center justify-center">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
              />
            </div>

            {scanError && (
              <p className="text-xs text-red-600">{scanError}</p>
            )}

            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setScanOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function PedidoDetalhePage() {
  const { toast } = useToast();

  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params?.id as string;

  // 🔄 Hook de realtime chamando router.refresh
  useOrderRealtime({
    orderId,
    onUpdate: () => {
      router.refresh();
    },
  });

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [timeline, setTimeline] = useState<Timeline[]>([]);
  const [role, setRole] = useState<Role | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  const [collectedSummary, setCollectedSummary] =
    useState<OrderCollectedSummary | null>(null);

  const [billingDraft, setBillingDraft] = useState<BillingDraft>(null);
  const [savingDraft, setSavingDraft] = useState(false);

  const [carriers, setCarriers] = useState<CarrierEntity[]>([]);
  const [selectedCarrierId, setSelectedCarrierId] = useState<string | null>(
    null
  );
  const [freightValue, setFreightValue] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [openCancel, setOpenCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [openReopen, setOpenReopen] = useState(false);
  const [reopenNote, setReopenNote] = useState("");

  // 🔢 Progresso de separação do pedido (0–100%)
  const [separationProgress, setSeparationProgress] =
    useState<number | null>(null);

  // 💰 Markup para faturamento (aplicado sobre o custo total coletado)
  const [billingMarkup, setBillingMarkup] = useState<number>(0);

  // ✅ trava concorrência de ações
  const actionLockRef = useRef(false);

  // ✅ evita setState após unmount
  const mountedRef = useRef(true);

  // ✅ no dev/StrictMode o useEffect pode rodar 2x
  const didInitialLoadRef = useRef(false);

  // ✅ debounce realtime
  const realtimeDebounceRef = useRef<any>(null);

  // ✅ evita avançar automaticamente mais de uma vez para faturamento
  const autoAdvanceTriggeredRef = useRef(false);

  const totalQtyRequested = useMemo(
    () =>
      orderItems.reduce(
        (acc, item) => acc + (Number(item.quantity) || 0),
        0
      ),
    [orderItems]
  );

  const cancelLabel = useMemo(() => {
    if (!order) return "Cancelar Pedido";
    return order.status === "pedido_criado" ? "Recusar Pedido" : "Cancelar Pedido";
  }, [order]);

  const safeSetState = (fn: () => void) => {
    if (!mountedRef.current) return;
    fn();
  };

  // 🔄 Recalcula o progresso de separação consultando order_items_labels
  const recomputeSeparationProgress = async (
    currentOrderId: string,
    currentItems: OrderItem[]
  ) => {
    try {
      if (!currentOrderId || currentItems.length === 0) {
        safeSetState(() => setSeparationProgress(null));
        return;
      }

      const totalRequested = currentItems.reduce(
        (acc, item) => acc + (Number(item.quantity) || 0),
        0
      );

      if (!totalRequested || totalRequested <= 0) {
        safeSetState(() => setSeparationProgress(0));
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("order_items_labels")
        .select("qty_used")
        .eq("order_id", currentOrderId);

      if (error) {
        console.error("Erro ao buscar progresso de separação:", error);
        return;
      }

      const totalSeparated =
        data?.reduce(
          (acc: number, row: any) => acc + (Number(row.qty_used) || 0),
          0
        ) ?? 0;

      const progress = Math.max(
        0,
        Math.min(100, Math.round((totalSeparated / totalRequested) * 100))
      );

      safeSetState(() => setSeparationProgress(progress));
    } catch (err) {
      console.error("Erro ao recalcular progresso de separação:", err);
    }
  };

  const load = async () => {
    if (!orderId) return;

    safeSetState(() => setLoading(true));

    try {
      const m = await getMyMembership();
      const normalizedRole = m?.role
        ? (String(m.role).trim().toLowerCase() as Role)
        : null;

      const o = await getOrderById(orderId);
      const t = await getOrderTimeline(orderId);
      const items = await listOrderItems(orderId);
      const summary = await getOrderCollectedSummary(orderId);

      // 🔸 rascunho de pré-nota
      let draft: BillingDraft = null;
      try {
        draft = await getOrderBillingDraft(orderId);
      } catch (err) {
        console.error(
          "Falha ao carregar rascunho de pré-nota (ignorado para não travar tela):",
          err
        );
        draft = null;
      }

      // 🔸 transportadoras
      let carriersData: CarrierEntity[] = [];
      try {
        const c = await listCarriers();
        carriersData = (c ?? []) as CarrierEntity[];
      } catch (err) {
        console.error("Erro ao carregar transportadoras:", err);
        carriersData = [];
      }

      safeSetState(() => {
        setRole(normalizedRole);
        setOrder(o);
        setTimeline(t as any);
        setOrderItems(items as OrderItem[]);
        setCollectedSummary(summary);
        setBillingDraft(draft);

        setCarriers(carriersData);

        // se já existir rascunho, usamos o markup e frete/transportadora dele como padrão
        if (draft) {
          const anyDraft: any = draft;
          if (typeof anyDraft.markup_percent === "number") {
            setBillingMarkup(anyDraft.markup_percent ?? 0);
          }
          if (
            anyDraft.freight_value !== undefined &&
            anyDraft.freight_value !== null
          ) {
            const fv = Number(anyDraft.freight_value);
            setFreightValue(Number.isNaN(fv) ? null : fv);
          } else {
            setFreightValue(null);
          }

          if (anyDraft.carrier_id) {
            setSelectedCarrierId(String(anyDraft.carrier_id));
          } else {
            setSelectedCarrierId(null);
          }
        } else {
          setFreightValue(null);
          setSelectedCarrierId(null);
        }
      });

      // após carregar os itens, calcula o progresso
      await recomputeSeparationProgress(orderId, items as OrderItem[]);
    } catch (e: any) {
      toast({
        title: "Erro ao carregar pedido",
        description: e?.message ?? "Erro inesperado",
        variant: "destructive",
      });
      router.push("/dashboard/pedidos");
    } finally {
      safeSetState(() => setLoading(false));
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!orderId) return;

    if (!didInitialLoadRef.current) {
      didInitialLoadRef.current = true;
      load();
      return;
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  // sempre que itens mudarem, tenta recalcular o progresso
  useEffect(() => {
    if (!orderId) return;
    void recomputeSeparationProgress(orderId, orderItems);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orderItems]);

  // ✅ Realtime: atualiza order/timeline sem precisar de reload
  useEffect(() => {
    if (!orderId) return;

    const supabase = createSupabaseBrowserClient();

    const schedule = (fn: () => void) => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current);
      realtimeDebounceRef.current = setTimeout(fn, 120);
    };

    const channel = supabase
      .channel(`order:${orderId}`)

      // 1) Mudanças no pedido (orders)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          schedule(() => {
            const next = (payload.new ?? payload.old ?? {}) as any;

            safeSetState(() => {
              setOrder((prev) => {
                if (!prev) return prev;

                return {
                  ...prev,
                  status: next.status ?? prev.status,
                  notes: next.notes ?? prev.notes,
                  accepted_by: next.accepted_by ?? prev.accepted_by,
                  accepted_at: next.accepted_at ?? prev.accepted_at,
                  canceled_by: next.canceled_by ?? prev.canceled_by,
                  canceled_at: next.canceled_at ?? prev.canceled_at,
                  cancel_reason: next.cancel_reason ?? prev.cancel_reason,
                  reopened_by: next.reopened_by ?? prev.reopened_by,
                  reopened_at: next.reopened_at ?? prev.reopened_at,
                };
              });
            });
          });
        }
      )

      // 2) Inserções na timeline (order_status_events)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "order_status_events",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          schedule(() => {
            const ev = payload.new as any;

            safeSetState(() => {
              setTimeline((prev: any) => {
                if (prev.some((x: any) => x.id === ev.id)) return prev;

                const next = [...prev, ev];
                next.sort(
                  (a: any, b: any) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
                );
                return next;
              });
            });
          });
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
      } catch {}

      try {
        supabase.removeChannel(channel);
      } catch {}

      if (realtimeDebounceRef.current) {
        clearTimeout(realtimeDebounceRef.current);
        realtimeDebounceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const runAction = async (
    fn: () => Promise<void>,
    ok: { title: string; description: string },
    fail: { title: string }
  ) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;

    safeSetState(() => setActing(true));

    try {
      await fn();

      // fallback se realtime falhar
      await load();

      toast({ title: ok.title, description: ok.description });
    } catch (e: any) {
      toast({
        title: fail.title,
        description: e?.message ?? "Erro inesperado",
        variant: "destructive",
      });
    } finally {
      actionLockRef.current = false;
      safeSetState(() => setActing(false));
    }
  };

  // 🚀 Auto-avançar para FATURAMENTO quando separação = 100%
  useEffect(() => {
    if (!orderId || !order) return;
    if (order.status !== "em_separacao") return;
    if (separationProgress === null || separationProgress < 100) return;
    if (autoAdvanceTriggeredRef.current) return;

    autoAdvanceTriggeredRef.current = true;

    (async () => {
      await runAction(
        () => advanceOrder(orderId),
        {
          title: "Separação concluída",
          description: "Pedido enviado automaticamente para faturamento.",
        },
        { title: "Erro ao enviar para faturamento" }
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, order, separationProgress]);

  const onAccept = async () => {
    if (!orderId) return;
    await runAction(
      () => acceptOrder(orderId),
      { title: "Pedido aceito", description: "Status atualizado com sucesso." },
      { title: "Erro ao aceitar pedido" }
    );
  };

  const onAdvance = async () => {
    if (!orderId) return;
    await runAction(
      () => advanceOrder(orderId),
      {
        title: "Status avançado",
        description: "Atualização registrada com sucesso.",
      },
      { title: "Erro ao avançar status" }
    );
  };

  const onOpenCancel = () => {
    setCancelReason("");
    setOpenCancel(true);
  };

  const onConfirmCancel = async () => {
    if (!orderId) return;

    const reason = cancelReason.trim();
    if (!reason) {
      toast({
        title: "Motivo obrigatório",
        description: "Informe o motivo do cancelamento/recusa.",
        variant: "destructive",
      });
      return;
    }

    if (actionLockRef.current) return;

    await runAction(
      async () => {
        await cancelOrder(orderId, reason);
        safeSetState(() => setOpenCancel(false));
      },
      {
        title: "Pedido cancelado",
        description: "Cancelamento registrado no histórico.",
      },
      { title: "Erro ao cancelar pedido" }
    );
  };

  const onOpenReopen = () => {
    setReopenNote("");
    setOpenReopen(true);
  };

  const onConfirmReopen = async () => {
    if (!orderId) return;

    const note = reopenNote.trim() ? reopenNote.trim() : undefined;

    await runAction(
      async () => {
        await reopenOrder(orderId, note);
        safeSetState(() => setOpenReopen(false));
      },
      { title: "Pedido reaberto", description: "Pedido voltou para o fluxo." },
      { title: "Erro ao reabrir pedido" }
    );
  };

  // 💰 Base de custo para pré-faturamento
  const billingBaseCost = useMemo(() => {
    // 1) preferir custo vindo do resumo de coleta
    const collected = collectedSummary?.total_cost;
    if (
      collected !== null &&
      collected !== undefined &&
      !Number.isNaN(collected)
    ) {
      return collected;
    }

    // 2) se não tiver resumo ainda, usar subtotal do rascunho salvo
    const draftSubtotal =
      billingDraft && (billingDraft as any).subtotal !== undefined
        ? (billingDraft as any).subtotal
        : null;

    if (
      draftSubtotal !== null &&
      draftSubtotal !== undefined &&
      !Number.isNaN(draftSubtotal)
    ) {
      return Number(draftSubtotal);
    }

    return 0;
  }, [collectedSummary, billingDraft]);

  const billingTotalWithMarkup = useMemo(
    () =>
      billingBaseCost && !Number.isNaN(billingBaseCost)
        ? billingBaseCost * (1 + (billingMarkup || 0) / 100)
        : 0,
    [billingBaseCost, billingMarkup]
  );

  const billingGrandTotal = useMemo(() => {
    const base =
      billingTotalWithMarkup && !Number.isNaN(billingTotalWithMarkup)
        ? billingTotalWithMarkup
        : 0;
    const freight =
      freightValue && !Number.isNaN(freightValue) ? freightValue : 0;
    return base + freight;
  }, [billingTotalWithMarkup, freightValue]);

  const handleBillingMarkupChange = (value: string) => {
    const n = Number(value.replace(",", "."));
    if (Number.isNaN(n)) {
      setBillingMarkup(0);
    } else {
      setBillingMarkup(n);
    }
  };

  const handleFreightChange = (value: string) => {
    const normalized = value.replace(",", ".");
    const n = Number(normalized);
    if (Number.isNaN(n)) {
      setFreightValue(null);
    } else {
      setFreightValue(n);
    }
  };

  const handleSaveBillingDraft = async () => {
    if (!orderId) return;

    try {
      setSavingDraft(true);

      const subtotal = !Number.isNaN(billingBaseCost)
        ? billingBaseCost
        : 0;

      const totalWithMarkup =
        billingTotalWithMarkup && !Number.isNaN(billingTotalWithMarkup)
          ? billingTotalWithMarkup
          : subtotal;

      await saveOrderBillingDraft({
        orderId,
        subtotal,
        markupPercent: billingMarkup || 0,
        totalWithMarkup,
        freightValue:
          freightValue !== null && !Number.isNaN(freightValue)
            ? freightValue
            : null,
        carrierId: selectedCarrierId,
      });

      // depois de salvar, recarrega o rascunho e reflete frete/carrier
      try {
        const draft = await getOrderBillingDraft(orderId);
        safeSetState(() => {
          setBillingDraft(draft);
          if (draft) {
            const anyDraft: any = draft;
            if (
              anyDraft.freight_value !== undefined &&
              anyDraft.freight_value !== null
            ) {
              const fv = Number(anyDraft.freight_value);
              setFreightValue(Number.isNaN(fv) ? null : fv);
            } else {
              setFreightValue(null);
            }

            if (anyDraft.carrier_id) {
              setSelectedCarrierId(String(anyDraft.carrier_id));
            } else {
              setSelectedCarrierId(null);
            }
          }
        });
      } catch (err) {
        console.error(
          "Falha ao recarregar rascunho de pré-nota após salvar:",
          err
        );
      }

      toast({
        title: "Pré-nota salva",
        description: "Rascunho de pré-nota salvo com sucesso.",
      });
    } catch (e: any) {
      toast({
        title: "Erro ao salvar pré-nota",
        description: e?.message ?? "Erro inesperado ao salvar rascunho.",
        variant: "destructive",
      });
    } finally {
      setSavingDraft(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!order) {
    return (
      <div className="text-sm text-muted-foreground">Pedido não encontrado.</div>
    );
  }

  const perms = canAct(role, order.status);
  const statusLabel = getStatusLabel(order.status);
  const advanceText = getAdvanceActionLabel(order.status);

  // 🔎 Campos de cliente para o layout de DANFE (usando any para não quebrar)
  const anyOrder: any = order;
  const customerName = anyOrder?.customer_name ?? anyOrder?.client_name ?? "—";
  const customerPhone = anyOrder?.customer_phone ?? anyOrder?.phone ?? "—";
  const customerEmail = anyOrder?.customer_email ?? anyOrder?.email ?? "—";
  const customerDoc =
    anyOrder?.customer_document ??
    anyOrder?.cnpj ??
    anyOrder?.cpf ??
    anyOrder?.documento ??
    "—";

  const deliveryAddress = anyOrder?.delivery_address ?? "—";
  const deliveryNeighborhood =
    anyOrder?.delivery_neighborhood ?? anyOrder?.bairro ?? "—";
  const deliveryCity = anyOrder?.delivery_city ?? anyOrder?.cidade ?? "—";
  const deliveryZip =
    anyOrder?.delivery_zip ??
    anyOrder?.cep ??
    anyOrder?.postal_code ??
    "—";

  const orderDateOnly = formatDate(order.created_at);
  const markupFactor = 1 + (billingMarkup || 0) / 100;

  return (
    <div className="space-y-4">
      <OrderStatusStepper status={order.status} />

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Detalhe do pedido</div>

          <div className="flex items-center gap-2">
            <div className="text-xl font-semibold">
              {order.order_number ? `#${order.order_number}` : order.id}
            </div>

            <Badge variant={getStatusBadgeVariant(order.status)}>
              {statusLabel}
            </Badge>
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            Seu papel: <strong>{role ?? "—"}</strong>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/pedidos")}
            disabled={acting || loading}
          >
            Voltar
          </Button>

          {perms.canReopen && (
            <Button
              variant="outline"
              onClick={onOpenReopen}
              disabled={acting || loading}
            >
              {acting ? "Processando..." : "Reabrir pedido"}
            </Button>
          )}

          {perms.canCancel && (
            <Button
              onClick={onOpenCancel}
              disabled={acting || loading}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {acting ? "Processando..." : cancelLabel}
            </Button>
          )}

          {perms.canAccept && (
            <Button onClick={onAccept} disabled={acting || loading}>
              {acting ? "Aceitando..." : "Aceitar Pedido"}
            </Button>
          )}

          {perms.canAdvance && (
            <Button onClick={onAdvance} disabled={acting || loading}>
              {acting ? "Processando..." : advanceText}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status atual</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <strong>Status:</strong> {statusLabel}
          </div>
          <div>
            <strong>Criado em:</strong> {formatDateTime(order.created_at)}
          </div>
          <div>
            <strong>Observações:</strong> {order.notes ?? "—"}
          </div>
        </CardContent>
      </Card>

      {/* =========================
      📦 ITENS DO PEDIDO (somente leitura)
      ========================= */}
      <div className="mt-4 border rounded-lg p-4 space-y-4">
        <h2 className="text-xl font-semibold mb-3">Itens do Pedido</h2>

        {orderItems.length > 0 ? (
          <ul className="space-y-2">
            {orderItems.map((item) => (
              <li
                key={item.id}
                className="border rounded-md p-3 flex justify-between items-center"
              >
                <span>
                  <strong>{item.product_name}</strong> — {item.quantity}{" "}
                  {item.unit_label}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhum item cadastrado para este pedido.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          Os itens deste pedido não podem ser alterados após a criação. Para
          incluir novos produtos, crie um novo pedido.
        </p>

        {/* 🔋 Barra de progresso da separação */}
        {separationProgress !== null && (
          <div className="mt-4 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso da separação</span>
              <span>{separationProgress}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${separationProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* =========================
      📊 RESUMO DE ITENS COLETADOS
      ========================= */}
      {collectedSummary && (
        <div className="mt-4 border rounded-lg p-4 space-y-4">
          <h2 className="text-xl font-semibold mb-3">
            Itens coletados para este pedido
          </h2>

          {collectedSummary.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma etiqueta foi coletada para este pedido ainda.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-2">Produto</th>
                      <th className="text-right py-2 px-2">Qtd. coletada</th>
                      <th className="text-center py-2 px-2">Unidade</th>
                      <th className="text-right py-2 px-2">Custo unitário</th>
                      <th className="text-right py-2 pl-2">Custo total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectedSummary.items.map((item) => (
                      <tr
                        key={`${item.product_name}-${item.unit_label}`}
                        className="border-b last:border-0"
                      >
                        <td className="py-2 pr-2">
                          <span className="font-medium">
                            {item.product_name}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right">
                          {item.total_qty}
                        </td>
                        <td className="py-2 px-2 text-center">
                          {item.unit_label}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {formatCurrency(item.unit_cost)}
                        </td>
                        <td className="py-2 pl-2 text-right">
                          {formatCurrency(item.total_cost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Quantidade total coletada:{" "}
                  <strong>{collectedSummary.total_qty}</strong>
                </span>
                <span>
                  Valor total de custo coletado:{" "}
                  <strong>{formatCurrency(collectedSummary.total_cost)}</strong>
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground">
                * Os valores de custo serão preenchidos automaticamente assim que
                a fonte oficial de custo estiver integrada à base.
              </p>
            </>
          )}
        </div>
      )}

      {/* 💰 PRÉ-FATURAMENTO / PRÉ-NOTA – layout tipo DANFE */}
      {order.status === "em_faturamento" && collectedSummary && (
        <div className="mt-4 border rounded-lg p-4 space-y-4 bg-muted/20">
          <h2 className="text-xl font-semibold mb-1">
            Pré-faturamento (Pré-nota)
          </h2>
          <p className="text-xs text-muted-foreground">
            Rascunho em formato de documento fiscal, baseado nos itens coletados
            deste pedido. Ajuste o markup, frete e transportadora para simular
            valores de faturamento.
          </p>

          {/* Resumo financeiro rápido */}
          <div className="grid gap-3 md:grid-cols-3 text-sm mt-2">
            <div className="border rounded-md p-3 flex flex-col gap-1 bg-white">
              <span className="text-xs text-muted-foreground">
                Custo total de base
              </span>
              <span className="text-base font-semibold">
                {formatCurrency(
                  billingBaseCost && !Number.isNaN(billingBaseCost)
                    ? billingBaseCost
                    : 0
                )}
              </span>
            </div>

            <div className="border rounded-md p-3 flex flex-col gap-1 bg-white">
              <Label className="text-xs text-muted-foreground">
                Markup (%) para faturamento
              </Label>
              <Input
                type="number"
                step="0.01"
                value={Number.isNaN(billingMarkup) ? "" : String(billingMarkup)}
                onChange={(e) => handleBillingMarkupChange(e.target.value)}
                placeholder="Ex.: 30"
              />
              <span className="text-[11px] text-muted-foreground">
                Aplicado sobre o custo total coletado deste pedido.
              </span>
            </div>

            <div className="border rounded-md p-3 flex flex-col gap-1 bg-white">
              <span className="text-xs text-muted-foreground">
                Total sugerido (produtos)
              </span>
              <span className="text-base font-semibold">
                {formatCurrency(
                  billingTotalWithMarkup &&
                    !Number.isNaN(billingTotalWithMarkup)
                    ? billingTotalWithMarkup
                    : 0
                )}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Total geral com frete:{" "}
                <strong>{formatCurrency(billingGrandTotal)}</strong>
              </span>
            </div>
          </div>

          {/* Documento estilo DANFE */}
          <div className="mt-4 border rounded-md bg-white p-4 space-y-3 text-xs md:text-sm">
            {/* Cabeçalho estilo DANFE */}
            <div className="border-b pb-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="uppercase text-[11px] text-muted-foreground">
                  1. DOC. AUXILIAR DE PRÉ-FATURAMENTO
                </div>
                <div className="text-base md:text-lg font-semibold">
                  Pedido de Venda – Pré-nota (rascunho)
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Não possui valor fiscal. Uso interno NT Solution.
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-[11px] text-muted-foreground">
                  Número do pedido
                </div>
                <div className="font-semibold">
                  {order.order_number ? `#${order.order_number}` : order.id}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Data: {orderDateOnly}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Status: {statusLabel}
                </div>
                {billingDraft && (billingDraft as any).updated_at && (
                  <div className="text-[11px] text-muted-foreground">
                    Último rascunho salvo:{" "}
                    {formatDateTime(
                      (billingDraft as any).updated_at as string
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Dados do cliente */}
            <div className="border rounded-sm p-3 space-y-1">
              <div className="font-semibold uppercase text-[11px]">
                2. DADOS DO CLIENTE
              </div>
              <div>
                <strong>Nome/Razão social:</strong> {customerName}
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:gap-4">
                <span>
                  <strong>CPF/CNPJ:</strong> {customerDoc}
                </span>
                <span>
                  <strong>Telefone:</strong> {customerPhone}
                </span>
                <span>
                  <strong>E-mail:</strong> {customerEmail}
                </span>
              </div>
            </div>

            {/* 3. Endereço de entrega */}
            <div className="border rounded-sm p-3 space-y-1">
              <div className="font-semibold uppercase text-[11px]">
                3. ENDEREÇO DE ENTREGA
              </div>
              <div>
                <strong>Endereço:</strong> {deliveryAddress}
              </div>
              <div className="flex flex-col md:flex-row md:items-center md:gap-4">
                <span>
                  <strong>Bairro:</strong> {deliveryNeighborhood}
                </span>
                <span>
                  <strong>Cidade:</strong> {deliveryCity}
                </span>
                <span>
                  <strong>CEP:</strong> {deliveryZip}
                </span>
              </div>
            </div>

            {/* 4. Transporte / Frete */}
            <div className="border rounded-sm p-3 space-y-2">
              <div className="font-semibold uppercase text-[11px]">
                4. TRANSPORTE / FRETE
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Transportadora
                  </Label>
                  <Select
                    value={selectedCarrierId ?? ""}
                    onValueChange={(v) =>
                      setSelectedCarrierId(v ? v : null)
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Selecione a transportadora" />
                    </SelectTrigger>
                    <SelectContent>
                      {carriers.length === 0 ? (
                        <SelectItem value="__empty" disabled>
                          Nenhuma transportadora cadastrada
                        </SelectItem>
                      ) : (
                        carriers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground">
                    Selecione a transportadora responsável pelo frete deste
                    pedido.
                  </p>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Valor do frete (R$)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={
                      freightValue === null || Number.isNaN(freightValue)
                        ? ""
                        : String(freightValue)
                    }
                    onChange={(e) => handleFreightChange(e.target.value)}
                    placeholder="Ex.: 49,90"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Este valor será somado ao total dos produtos como referência
                    de pré-faturamento.
                  </p>
                </div>
              </div>
            </div>

            {/* 5. Produtos/Serviços com markup aplicado */}
            <div className="border rounded-sm p-3 space-y-2">
              <div className="font-semibold uppercase text-[11px]">
                5. DADOS DOS PRODUTOS / SERVIÇOS – PRÉ-NOTA
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] md:text-xs border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left py-2 px-2">Cód.</th>
                      <th className="text-left py-2 px-2">
                        Descrição do produto
                      </th>
                      <th className="text-right py-2 px-2">Qtd.</th>
                      <th className="text-center py-2 px-2">UN</th>
                      <th className="text-right py-2 px-2">
                        Vl. Unitário (c/ markup)
                      </th>
                      <th className="text-right py-2 px-2">
                        Vl. Total (c/ markup)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectedSummary.items.map((item, index) => {
                      const baseUnitCost = item.unit_cost || 0;
                      const unitPriceWithMarkup = baseUnitCost * markupFactor;
                      const totalPriceWithMarkup =
                        unitPriceWithMarkup * (item.total_qty || 0);

                      return (
                        <tr
                          key={`pre-billing-${item.product_name}-${item.unit_label}`}
                          className="border-b last:border-0"
                        >
                          <td className="py-2 px-2 align-top">
                            {index + 1}
                          </td>
                          <td className="py-2 px-2 align-top">
                            <span className="font-medium">
                              {item.product_name}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right align-top">
                            {item.total_qty}
                          </td>
                          <td className="py-2 px-2 text-center align-top">
                            {item.unit_label}
                          </td>
                          <td className="py-2 px-2 text-right align-top">
                            {formatCurrency(unitPriceWithMarkup)}
                          </td>
                          <td className="py-2 px-2 text-right align-top">
                            {formatCurrency(totalPriceWithMarkup)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  * Valores calculados a partir do custo coletado das etiquetas +
                  markup informado acima. Este documento não possui validade fiscal.
                </span>
                <div className="text-sm space-y-1 text-right">
                  <div>
                    <strong>Total produtos: </strong>
                    {formatCurrency(billingTotalWithMarkup)}
                  </div>
                  <div>
                    <strong>Frete: </strong>
                    {formatCurrency(
                      freightValue && !Number.isNaN(freightValue)
                        ? freightValue
                        : 0
                    )}
                  </div>
                  <div>
                    <strong>Total da pré-nota (produtos + frete): </strong>
                    {formatCurrency(billingGrandTotal)}
                  </div>
                </div>
              </div>
            </div>

            {/* 6. Observações */}
            <div className="border rounded-sm p-3 space-y-1">
              <div className="font-semibold uppercase text-[11px]">
                6. OBSERVAÇÕES
              </div>
              <div className="min-h-[48px] whitespace-pre-wrap">
                {order.notes && order.notes.trim().length > 0
                  ? order.notes
                  : "—"}
              </div>
            </div>

            {/* Rodapé */}
            <div className="pt-2 border-t text-[11px] text-muted-foreground flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <span>
                Este é um rascunho interno. A etapa seguinte será salvar estas
                informações e gerar a nota fiscal ou PDF oficial.
              </span>
              <span>
                Pedido:{" "}
                <strong>
                  {order.order_number ? `#${order.order_number}` : order.id}
                </strong>
              </span>
            </div>

            <div className="flex justify-end gap-2 mt-3">
              <Button
                variant="outline"
                onClick={handleSaveBillingDraft}
                disabled={acting || loading || savingDraft}
              >
                {savingDraft ? "Salvando..." : "Salvar pré-nota"}
              </Button>
              <Button variant="outline" disabled>
                Gerar pré-nota (em breve)
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ⚙️ Separar produtos – só aparece em "em_separacao" e enquanto progresso < 100% */}
      {order.status === "em_separacao" &&
        orderItems.length > 0 &&
        (separationProgress === null || separationProgress < 100) && (
          <QuickLinkLabelSection
            orderId={orderId}
            defaultQty={totalQtyRequested || null}
            onLinked={(summary) => {
              setCollectedSummary(summary);
              void recomputeSeparationProgress(orderId, orderItems);
            }}
          />
        )}

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(timeline as any[]).length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem eventos.</div>
          ) : (
            (timeline as any[]).map((ev: any) => (
              <div key={ev.id} className="rounded-md border p-3">
                <div className="text-sm font-medium">
                  {ev.client_label ?? getStatusLabel(ev.to_status)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDateTime(ev.created_at)} •{" "}
                  {ev.from_status ? getStatusLabel(ev.from_status) : "—"} →{" "}
                  {getStatusLabel(ev.to_status)}
                </div>
                {ev.note ? (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {ev.note}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Dialog Cancelar */}
      <Dialog open={openCancel} onOpenChange={setOpenCancel}>
        <DialogContent className="w-full max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>{cancelLabel}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Motivo obrigatório (será registrado no histórico).
            </div>

            <div>
              <Label>Motivo</Label>
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={
                  order.status === "pedido_criado"
                    ? "Ex.: Sem capacidade de produção hoje / Fora da rota / Item indisponível..."
                    : "Ex.: Problema operacional / Endereço inválido / Cliente solicitou..."
                }
                disabled={acting || loading}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpenCancel(false)}
                disabled={acting || loading}
              >
                Voltar
              </Button>
              <Button
                onClick={onConfirmCancel}
                disabled={acting || loading}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {acting ? "Processando..." : cancelLabel}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Reabrir */}
      <Dialog open={openReopen} onOpenChange={setOpenReopen}>
        <DialogContent className="w-full max-w-xl bg-white">
          <DialogHeader>
            <DialogTitle>Reabrir pedido</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Observação opcional (será registrada no histórico).
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                value={reopenNote}
                onChange={(e) => setReopenNote(e.target.value)}
                placeholder="Ex.: Reaberto após ajuste com a unidade / Produção liberada / Correção de rota..."
                disabled={acting || loading}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpenReopen(false)}
                disabled={acting || loading}
              >
                Voltar
              </Button>
              <Button onClick={onConfirmReopen} disabled={acting || loading}>
                {acting ? "Processando..." : "Reabrir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
