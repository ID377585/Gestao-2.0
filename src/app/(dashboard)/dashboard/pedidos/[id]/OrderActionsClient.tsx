"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

import {
  acceptOrder,
  advanceOrder,
  cancelOrder,
  reopenOrder,
} from "../actions"; // importa as server actions do pedido
import {
  clearStableClientIdempotencyKey,
  getStableClientIdempotencyKey,
} from "@/lib/idempotency/client";

// 🔗 Server action usada na etapa de SEPARAÇÃO
// (arquivo: src/app/(dashboard)/dashboard/pedidos/separacao/actions.ts)
// @ts-ignore - suprime erro de tipos no build (módulo de server action não é analisado no cliente)
import { separateLabelForOrder } from "../separacao/actions";

type Props = {
  orderId: string; // ID do pedido
  role: string; // ex.: "admin" | "operacao" | ...
  status: string; // ex.: "pedido_criado", "aceitou_pedido"...
};

function getOrderActionScope(action: string, orderId: string, status?: string) {
  return `order:${orderId}:${action}:${status ?? "current"}`;
}

function getOrderActionKey(action: string, orderId: string, status?: string) {
  const scope = getOrderActionScope(action, orderId, status);
  return getStableClientIdempotencyKey(scope, `order:${orderId}:${action}`);
}

function clearOrderActionKey(action: string, orderId: string, status?: string) {
  clearStableClientIdempotencyKey(getOrderActionScope(action, orderId, status));
}

export default function OrderActionsClient({ orderId, role, status }: Props) {
  const [accepting, setAccepting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [testingLabel, setTestingLabel] = useState(false);

  // Se quiser travar tudo quando qualquer ação estiver rodando:
  const busy =
    accepting || advancing || canceling || reopening || testingLabel;

  // Helper genérico pra travar clique duplo
  async function runLocked(
    isBusy: boolean,
    setBusy: (v: boolean) => void,
    fn: () => Promise<void>
  ) {
    if (isBusy) return;
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  // Regras simples de UI (backend já valida de verdade)
  const canAccept = useMemo(() => {
    return (
      ["admin", "operacao", "producao"].includes(role) &&
      status === "pedido_criado"
    );
  }, [role, status]);

  const canAdvance = useMemo(() => {
    // Avançar começa em "aceitou_pedido" (vira "em_preparo")
    return (
      status !== "pedido_criado" &&
      status !== "cancelado" &&
      status !== "entregue"
    );
  }, [status]);

  const canReopen = useMemo(() => {
    return role === "admin" && status === "cancelado";
  }, [role, status]);

  const canCancel = useMemo(() => {
    return (
      role !== "cliente" &&
      status !== "entregue" &&
      status !== "cancelado"
    );
  }, [role, status]);

  // Se quiser limitar o botão de teste de etiqueta por papel:
  const canTestLabel = useMemo(() => {
    return ["admin", "estoque", "producao", "operacao"].includes(role);
  }, [role]);

  return (
    <div className="flex flex-wrap gap-2">
      {/* Aceitar */}
      <Button
        onClick={() =>
          runLocked(accepting, setAccepting, async () => {
            await acceptOrder(orderId, getOrderActionKey("accept", orderId, status));
            clearOrderActionKey("accept", orderId, status);
          })
        }
        disabled={busy || !canAccept}
        variant="default"
      >
        {accepting ? "Aceitando..." : "Aceitar Pedido"}
      </Button>

      {/* Avançar */}
      <Button
        onClick={() =>
          runLocked(advancing, setAdvancing, async () => {
            await advanceOrder(
              orderId,
              getOrderActionKey("advance", orderId, status),
              status
            );
            clearOrderActionKey("advance", orderId, status);
          })
        }
        disabled={busy || !canAdvance}
        variant="secondary"
      >
        {advancing ? "Avançando..." : "Avançar status"}
      </Button>

      {/* Cancelar (prompt simples) */}
      <Button
        onClick={() =>
          runLocked(canceling, setCanceling, async () => {
            const reason = window.prompt("Motivo do cancelamento:") ?? "";
            if (!reason.trim()) return;
            await cancelOrder(
              orderId,
              reason.trim(),
              getOrderActionKey("cancel", orderId, status)
            );
            clearOrderActionKey("cancel", orderId, status);
          })
        }
        disabled={busy || !canCancel}
        variant="destructive"
      >
        {canceling ? "Cancelando..." : "Cancelar Pedido"}
      </Button>

      {/* Reabrir (admin) */}
      <Button
        onClick={() =>
          runLocked(reopening, setReopening, async () => {
            const note =
              window.prompt("Observação para reabrir (opcional):") ?? "";
            await reopenOrder(
              orderId,
              note,
              getOrderActionKey("reopen", orderId, status)
            );
            clearOrderActionKey("reopen", orderId, status);
          })
        }
        disabled={busy || !canReopen}
        variant="outline"
      >
        {reopening ? "Reabrindo..." : "Reabrir Pedido"}
      </Button>

      {/* 🔬 Botão de TESTE da separação / estoque (debug) */}
      {canTestLabel && (
        <Button
          onClick={() =>
            runLocked(testingLabel, setTestingLabel, async () => {
              const qrText =
                window.prompt(
                  "Digite o código da etiqueta (o mesmo que está em label_code / QR):"
                ) ?? "";

              if (!qrText.trim()) return;

              try {
                const res = await separateLabelForOrder({
                  orderId,
                  qrText: qrText.trim(),
                });

                console.log("🟢 Etiqueta aplicada com sucesso:", res);
                window.alert("Etiqueta aplicada com sucesso!");
              } catch (err: any) {
                console.error("🔴 Erro ao aplicar etiqueta:", err);
                window.alert(
                  err?.message ||
                    "Falha ao aplicar etiqueta. Veja o console para detalhes."
                );
              }
            })
          }
          disabled={busy}
          variant="outline"
        >
          {testingLabel
            ? "Aplicando etiqueta..."
            : "TESTAR etiqueta no estoque"}
        </Button>
      )}
    </div>
  );
}
