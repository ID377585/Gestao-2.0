import { revalidatePath } from "next/cache";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import { listOrders, getMyMembership } from "../../pedidos/actions";
import {
  separateLabelForOrder,
  finalizeOrderSeparation,
} from "../actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { QrScannerButton } from "../QrScannerButton";

/**
 * Só para exibir data bonitinha nos cards
 */
function formatDateTime(date: string | null) {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function SeparacaoPage() {
  const [membership, orders] = await Promise.all([
    getMyMembership(),
    listOrders(),
  ]);

  const role = membership.role as string | null;

  // Só pode ver essa tela quem é operação / estoque / admin
  const canSeePage = ["admin", "operacao", "estoque"].includes(role ?? "");
  if (!canSeePage) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Separação</h1>
        <p className="text-sm text-muted-foreground">
          Seu perfil não tem acesso à tela de Separação.
        </p>
      </div>
    );
  }

  // Pedidos que podem ser separados
  const pedidosParaSeparar = orders.filter((o: any) =>
    ["aceitou_pedido", "em_separacao"].includes(o.status)
  );

  // --------------------------------------------------------------------------------
  // Busca itens do pedido + etiquetas já separadas para calcular progresso
  // --------------------------------------------------------------------------------
  const supabase = await createSupabaseServerClient();

  const itemsByOrder: Record<string, any[]> = {};
  const labelsCountByOrder: Record<string, number> = {};

  const orderIds = pedidosParaSeparar.map((o: any) => o.id);

  if (orderIds.length > 0) {
    // Itens do pedido (produto + quantidade)
    const { data: items } = await supabase
      .from("order_items")
      .select("id, order_id, product_name, qty, unit")
      .in("order_id", orderIds);

    if (items) {
      for (const item of items) {
        const key = item.order_id as string;
        if (!itemsByOrder[key]) itemsByOrder[key] = [];
        itemsByOrder[key].push(item);
      }
    }

    // Etiquetas já separadas/consumidas para esses pedidos
    const { data: labels } = await supabase
      .from("inventory_labels")
      .select("id, order_id")
      .in("order_id", orderIds)
      .in("status", ["separated", "consumed"]);

    if (labels) {
      for (const lbl of labels) {
        const key = lbl.order_id as string;
        labelsCountByOrder[key] = (labelsCountByOrder[key] ?? 0) + 1;
      }
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Separação de Pedidos
          </h1>
          <p className="text-gray-600">
            Leia as etiquetas (QR Code) para vincular lotes ao pedido.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Papel atual: <strong>{role ?? "—"}</strong>
          </p>
        </div>

        {/* Botão de atualizar */}
        <form
          action={async () => {
            "use server";
            revalidatePath("/dashboard/separacao");
          }}
        >
          <Button variant="outline" type="submit">
            <span className="mr-2">🔄</span>
            Atualizar
          </Button>
        </form>
      </div>

      {/* Lista de pedidos com campo de leitura de QR */}
      <div className="space-y-4">
        {pedidosParaSeparar.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              Nenhum pedido disponível para separação no momento.
            </CardContent>
          </Card>
        ) : (
          pedidosParaSeparar.map((order: any) => {
            const items = itemsByOrder[order.id] ?? [];
            const labelsLidas = labelsCountByOrder[order.id] ?? 0;
            const totalItens = items.length;

            const progress =
              totalItens > 0
                ? Math.min(
                    100,
                    Math.round((labelsLidas / totalItens) * 100)
                  )
                : labelsLidas > 0
                ? 100
                : 0;

            const inputId = `qr-input-${order.id}`;

            return (
              <Card key={order.id}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-sm font-medium">
                      Pedido{" "}
                      {order.order_number
                        ? `#${order.order_number}`
                        : String(order.id).slice(0, 8)}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Criado em: {formatDateTime(order.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline">{order.status}</Badge>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Progresso */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progresso da separação</span>
                      <span>
                        {labelsLidas} de {totalItens || "?"} itens com etiquetas
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="text-right text-[11px] text-muted-foreground">
                      {progress}% concluído
                    </div>
                  </div>

                  {/* Itens do pedido */}
                  <div className="space-y-1 rounded-md border bg-muted/30 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Itens do pedido
                    </p>
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nenhum item encontrado para este pedido.
                      </p>
                    ) : (
                      <ul className="space-y-1 text-xs">
                        {items.map((item: any) => (
                          <li
                            key={item.id}
                            className="flex items-center justify-between rounded-md bg-white px-2 py-1"
                          >
                            <span className="font-medium">
                              {item.product_name ?? "Produto"}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {item.qty} {item.unit}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Use o leitor de QR Code apontado para o campo abaixo ou o
                    botão de câmera. Cada leitura vincula uma etiqueta ao
                    pedido.
                  </p>

                  {/* FORM DA LEITURA */}
                  <form
                    action={async (formData: FormData) => {
                      "use server";

                      const rawQrText = String(formData.get("qr") ?? "");
                      const orderId = String(formData.get("order_id") ?? "");

                      // 🔥 AQUI ESTÁ O AJUSTE IMPORTANTE:
                      // o server action espera `qrText`, não `rawQrText`
                      await separateLabelForOrder({
                        orderId,
                        qrText: rawQrText,
                      });
                    }}
                    className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  >
                    {/* Pedido alvo (oculto) */}
                    <input type="hidden" name="order_id" value={order.id} />

                    {/* Campo que recebe o texto do scanner / câmera */}
                    <Input
                      id={inputId}
                      name="qr"
                      placeholder="Cole o texto do QR aqui ou use a câmera"
                      className="flex-1 text-sm"
                      autoComplete="off"
                    />

                    {/* Botão padrão de envio (para leitor USB / texto manual) */}
                    <Button type="submit" className="whitespace-nowrap">
                      Ler QR (texto)
                    </Button>

                    {/* Botão que abre a câmera e preenche o input + submit */}
                    <QrScannerButton inputId={inputId} />
                  </form>

                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Dica: configure o leitor de código de barras/QR para{" "}
                    <span className="font-semibold">enviar Enter</span> após cada
                    leitura, ou use o botão de câmera em dispositivos móveis.
                  </div>

                  {/* Botão de finalizar separação → Faturamento */}
                  <div className="mt-3 flex items-center justify-between">
                    <a
                      href={`/dashboard/pedidos/${order.id}`}
                      className="text-[11px] text-primary underline-offset-2 hover:underline"
                    >
                      Ver detalhes do pedido
                    </a>

                    <form
                      action={async () => {
                        "use server";
                        await finalizeOrderSeparation(order.id);
                      }}
                    >
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                      >
                        Finalizar separação → Faturamento
                      </Button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
