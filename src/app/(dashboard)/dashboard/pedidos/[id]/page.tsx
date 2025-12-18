"use client";

import { useEffect, useMemo, useState } from "react";
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

import { OrderStatusStepper } from "@/components/orders/OrderStatusStepper";

import {
  acceptOrder,
  advanceOrder,
  cancelOrder,
  reopenOrder,
  getMyMembership,
  getOrderById,
  getOrderTimeline,
} from "../actions";

type OrderDetails = Awaited<ReturnType<typeof getOrderById>>;
type Timeline = Awaited<ReturnType<typeof getOrderTimeline>>;

type Role =
  | "cliente"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "admin"
  | "entrega";

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

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
 * 🔐 REGRAS (como você pediu):
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
  const isFixedOps = ["operacao", "producao", "estoque", "fiscal"].includes(role);
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
    status === "pedido_criado" && (isAdmin || role === "operacao" || role === "producao");

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
  } else {
    canAdvance = false;
  }

  // ✅ Cancelar:
  // - Admin sempre pode (menos quando já é cancelado)
  // - Fixos podem até em_faturamento
  // - Cliente e Entrega nunca cancelam
  const canCancelAdmin = isAdmin && status !== "cancelado";
  const canCancelFixedOps =
    isFixedOps &&
    ["pedido_criado", "aceitou_pedido", "em_preparo", "em_separacao", "em_faturamento"].includes(
      status
    );

  const canCancel =
    !isCliente &&
    !isEntrega &&
    status !== "cancelado" &&
    (canCancelAdmin || canCancelFixedOps);

  // Se entregue: ninguém aceita/avança, mas admin pode cancelar (sua regra)
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

export default function PedidoDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const orderId = params?.id;

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [timeline, setTimeline] = useState<Timeline>([]);
  const [role, setRole] = useState<Role | null>(null);

  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [openCancel, setOpenCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [openReopen, setOpenReopen] = useState(false);
  const [reopenNote, setReopenNote] = useState("");

  const cancelLabel = useMemo(() => {
    if (!order) return "Cancelar Pedido";
    return order.status === "pedido_criado" ? "Recusar Pedido" : "Cancelar Pedido";
  }, [order]);

  const load = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const m = await getMyMembership();

      // ✅ NORMALIZA ROLE (resolve ADMIN/Admin/OPERACAO etc.)
      const normalizedRole = m?.role
        ? (String(m.role).trim().toLowerCase() as Role)
        : null;

      setRole(normalizedRole);

      const o = await getOrderById(orderId);
      const t = await getOrderTimeline(orderId);

      setOrder(o);
      setTimeline(t);

      // ✅ Debug útil (se quiser ver no console)
      // console.log({ rawRole: m?.role, normalizedRole, status: o.status });
    } catch (e: any) {
      alert(e?.message ?? "Erro ao carregar pedido");
      router.push("/dashboard/pedidos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const onAccept = async () => {
    if (!orderId) return;
    try {
      setActing(true);
      await acceptOrder(orderId);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Erro ao aceitar pedido");
    } finally {
      setActing(false);
    }
  };

  const onAdvance = async () => {
    if (!orderId) return;
    try {
      setActing(true);
      await advanceOrder(orderId);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Erro ao avançar status");
    } finally {
      setActing(false);
    }
  };

  const onOpenCancel = () => {
    setCancelReason("");
    setOpenCancel(true);
  };

  const onConfirmCancel = async () => {
    if (!orderId) return;
    const reason = cancelReason.trim();
    if (!reason) {
      alert("Informe o motivo do cancelamento/recusa.");
      return;
    }
    try {
      setActing(true);
      await cancelOrder(orderId, reason);
      setOpenCancel(false);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Erro ao cancelar pedido");
    } finally {
      setActing(false);
    }
  };

  const onOpenReopen = () => {
    setReopenNote("");
    setOpenReopen(true);
  };

  const onConfirmReopen = async () => {
    if (!orderId) return;
    try {
      setActing(true);
      await reopenOrder(orderId, reopenNote.trim() ? reopenNote.trim() : undefined);
      setOpenReopen(false);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Erro ao reabrir pedido");
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  if (!order) {
    return <div className="text-sm text-muted-foreground">Pedido não encontrado.</div>;
  }

  const perms = canAct(role, order.status);
  const statusLabel = getStatusLabel(order.status);
  const advanceText = getAdvanceActionLabel(order.status);

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

            <Badge variant={getStatusBadgeVariant(order.status)}>{statusLabel}</Badge>
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            Seu papel: <strong>{role ?? "—"}</strong>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/dashboard/pedidos")}>
            Voltar
          </Button>

          {/* ✅ Reabrir (cancelado) */}
          {perms.canReopen && (
            <Button variant="outline" onClick={onOpenReopen} disabled={acting}>
              {acting ? "Processando..." : "Reabrir pedido"}
            </Button>
          )}

          {/* ✅ Cancelar / Recusar (FORÇANDO ESTILO VISÍVEL) */}
          {perms.canCancel && (
            <Button
              onClick={onOpenCancel}
              disabled={acting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {cancelLabel}
            </Button>
          )}

          {perms.canAccept && (
            <Button onClick={onAccept} disabled={acting}>
              {acting ? "Aceitando..." : "Aceitar Pedido"}
            </Button>
          )}

          {perms.canAdvance && (
            <Button onClick={onAdvance} disabled={acting}>
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

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {timeline.length === 0 ? (
            <div className="text-sm text-muted-foreground">Sem eventos.</div>
          ) : (
            timeline.map((ev) => (
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
                  <div className="mt-1 text-xs text-muted-foreground">{ev.note}</div>
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
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpenCancel(false)}
                disabled={acting}
              >
                Voltar
              </Button>
              <Button onClick={onConfirmCancel} disabled={acting} className="bg-red-600 text-white hover:bg-red-700">
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
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setOpenReopen(false)}
                disabled={acting}
              >
                Voltar
              </Button>
              <Button onClick={onConfirmReopen} disabled={acting}>
                {acting ? "Processando..." : "Reabrir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
