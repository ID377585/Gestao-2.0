import { revalidatePath } from "next/cache";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  listOrders,
  getMyMembership,
  type Role,
} from "../pedidos/actions";

import {
  getKdsProductionData,
  assignProductionCollaborator,
  advanceProductionStatus,
  listKdsCollaborators,
  moveOrderToNextStageFromProduction,
  type KdsCollaborator,
} from "./actions";

// mesmos rótulos usados na tela de detalhes
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

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "cancelado") return "destructive";
  if (status === "entregue") return "default";
  if (status === "pedido_criado") return "secondary";
  return "outline";
}

function formatDateTime(date: string) {
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Tipo usado na tela para os itens do quadro de produção (view kds_production_view)
 */
type KdsItem = {
  order_item_id: string;
  order_id: string;
  order_number: number | null;
  order_status: string;
  production_status: "pending" | "in_progress" | "done" | "no_production_needed";
  production_missing_qty: number | null;
  production_assigned_to: string | null;
  product_id: string;
  product_name: string;
  default_unit_label: string;
  order_qty: number;
};

/**
 * Renderiza as informações principais do item dentro do card,
 * reutilizado nas 3 colunas (Pendentes / Em preparo / Pós-preparo)
 */
function renderProductionItemInfo(
  item: KdsItem,
  columnId: "pendentes" | "preparo" | "pos_preparo"
) {
  return (
    <div className="space-y-1 text-xs">
      {/* Produto — qtd un */}
      <p className="font-medium text-sm">
        {item.product_name} — {item.order_qty} {item.default_unit_label}
      </p>

      {/* Mensagem de contexto por coluna */}
      <p className="text-[11px] text-muted-foreground">
        {columnId === "pendentes" && "Aguardando início do preparo"}
        {columnId === "preparo" && "Em preparo pela produção"}
        {columnId === "pos_preparo" &&
          "Produção concluída, aguardando próxima etapa do pedido"}
      </p>

      {/* Faltam produzir X (quando fizer sentido) */}
      {item.production_missing_qty !== null &&
        item.production_missing_qty > 0 && (
          <p className="text-[11px] text-amber-600">
            Faltam produzir{" "}
            <span className="font-semibold">
              {item.production_missing_qty} {item.default_unit_label}
            </span>
          </p>
        )}
    </div>
  );
}

/**
 * Quadro de Produção por ITEM
 *
 * - Pendentes:
 *    - production_status = 'pending'
 *    - e pedido em status 'aceitou_pedido'
 * - Em preparo:
 *    - production_status = 'in_progress'
 * - Pós-preparo:
 *    - production_status = 'done'
 */
const PRODUCTION_COLUMNS: {
  id: "pendentes" | "preparo" | "pos_preparo";
  title: string;
  description?: string;
  productionStatuses: string[];
}[] = [
  {
    id: "pendentes",
    title: "Pendentes",
    description: "Pedidos aceitos, aguardando início de preparo",
    productionStatuses: ["pending"],
  },
  {
    id: "preparo",
    title: "Em preparo",
    description: "Sendo preparados pela produção",
    productionStatuses: ["in_progress"],
  },
  {
    id: "pos_preparo",
    title: "Pós-preparo",
    description: "Itens já concluídos na produção",
    productionStatuses: ["done"],
  },
];

export default async function ProducaoPage() {
  // membership + pedidos + itens de produção (view) + colaboradores
  const [membership, orders, kdsData, collaborators] = await Promise.all([
    getMyMembership(),
    listOrders(),
    getKdsProductionData(),
    listKdsCollaborators(),
  ]);

  const role = membership.role as Role | null;

  // 👇 Ajuste aqui: fazemos o cast passando por unknown para evitar conflito de tipos KdsItem
  const productionItems = (kdsData.items ?? []) as unknown as KdsItem[];

  const collaboratorOptions: KdsCollaborator[] = collaborators ?? [];

  const canSeeBoard = role !== "cliente";
  const canChangeStatus = ["admin", "operacao", "producao"].includes(
    role ?? "cliente"
  );
  const canAssignCollaborator = ["admin", "operacao"].includes(
    role ?? "cliente"
  );
  const canAdvanceOrders = ["admin", "operacao"].includes(role ?? "cliente");

  // helper para achar o nome bonitinho do colaborador
  function getCollaboratorLabel(userId: string | null): string | null {
    if (!userId) return null;
    const collab = collaboratorOptions.find((c) => c.id === userId);
    if (!collab) return null;
    return collab.sector
      ? `${collab.full_name} – ${collab.sector}`
      : collab.full_name;
  }

  if (!canSeeBoard) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Produção</h1>
        <p className="text-sm text-muted-foreground">
          Seu perfil não tem acesso ao quadro de Produção.
        </p>
      </div>
    );
  }

  // agregados simples para cards de resumo (por pedido)
  const pendentes = orders.filter((o) => o.status === "aceitou_pedido");
  const emPreparo = orders.filter((o) => o.status === "em_preparo");
  const posPreparo = orders.filter((o) =>
    ["em_separacao", "em_faturamento", "em_transporte"].includes(o.status)
  );
  const finalizadosHoje = orders.filter((o) => o.status === "entregue");
  const cancelados = orders.filter((o) => o.status === "cancelado");

  // ------------------------------------------------------
  // Agrupar itens de produção por pedido para saber
  // se o PEDIDO PAI pode ser avançado para em_separacao
  // (todos os itens done / no_production_needed)
  // ------------------------------------------------------
  const itemsByOrderId: Record<string, KdsItem[]> = {};
  for (const item of productionItems) {
    const key = String(item.order_id);
    if (!itemsByOrderId[key]) {
      itemsByOrderId[key] = [];
    }
    itemsByOrderId[key].push(item);
  }

  const orderAllItemsDone: Record<string, boolean> = {};
  for (const [orderId, items] of Object.entries(itemsByOrderId)) {
    orderAllItemsDone[orderId] = items.every((i) =>
      ["done", "no_production_needed"].includes(i.production_status)
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Produção - KDS</h1>
          <p className="text-gray-600">
            Kitchen Display System - visão de produção por status do pedido.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Papel atual: <strong>{role ?? "—"}</strong>
          </p>
        </div>
        <div className="flex space-x-2">
          {/* Botão de atualizar */}
          <form
            action={async () => {
              "use server";
              revalidatePath("/dashboard/producao");
            }}
          >
            <Button variant="outline" type="submit">
              <span className="mr-2">🔄</span>
              Atualizar
            </Button>
          </form>
        </div>
      </div>

      {/* Stats Cards (por pedido) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <span className="text-2xl">⏳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendentes.length}</div>
            <p className="text-xs text-muted-foreground">
              Aceitos, aguardando início de preparo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Preparo</CardTitle>
            <span className="text-2xl">👨‍🍳</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{emPreparo.length}</div>
            <p className="text-xs text-muted-foreground">Em produção agora</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pós-preparo</CardTitle>
            <span className="text-2xl">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{posPreparo.length}</div>
            <p className="text-xs text-muted-foreground">
              Separação, faturamento ou transporte
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entregues</CardTitle>
            <span className="text-2xl">✅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finalizadosHoje.length}</div>
            <p className="text-xs text-muted-foreground">Pedidos concluídos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
            <span className="text-2xl">🛑</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cancelados.length}</div>
            <p className="text-xs text-muted-foreground">Fora do fluxo</p>
          </CardContent>
        </Card>
      </div>

      {/* KDS / Board de Produção (por ITEM) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PRODUCTION_COLUMNS.map((column) => {
          const itemsForColumn = productionItems.filter((i: KdsItem) => {
            const matchesStatus = column.productionStatuses.includes(
              i.production_status
            );

            // Regra extra: Pendentes só com pedido aceito
            if (column.id === "pendentes") {
              return matchesStatus && i.order_status === "aceitou_pedido";
            }

            return matchesStatus;
          });

          // Para evitar mostrar o botão "Avançar pedido" várias vezes
          // para o mesmo pedido na coluna Pós-preparo
          const renderedAdvanceButtonForOrder = new Set<string>();

          return (
            <div key={column.id} className="rounded-lg border bg-white">
              <div className="border-b p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {column.title}
                  </h2>
                  <Badge variant="secondary">{itemsForColumn.length}</Badge>
                </div>
                {column.description ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {column.description}
                  </p>
                ) : null}
              </div>

              <div className="max-h-[600px] space-y-4 overflow-y-auto p-4">
                {itemsForColumn.length === 0 ? (
                  <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Nenhum pedido nesta etapa.
                  </div>
                ) : (
                  itemsForColumn.map((item) => {
                    const collaboratorLabel = getCollaboratorLabel(
                      item.production_assigned_to ?? null
                    );

                    // Lógica do botão de avançar pedido (apenas em Pós-preparo)
                    let showAdvanceOrderButton = false;
                    if (column.id === "pos_preparo" && canAdvanceOrders) {
                      const orderIdKey = String(item.order_id);
                      const allItemsDone = orderAllItemsDone[orderIdKey] ?? false;
                      const alreadyRendered =
                        renderedAdvanceButtonForOrder.has(orderIdKey);

                      if (allItemsDone && !alreadyRendered) {
                        showAdvanceOrderButton = true;
                        renderedAdvanceButtonForOrder.add(orderIdKey);
                      }
                    }

                    return (
                      <Card
                        key={item.order_item_id}
                        className="border-l-4 border-l-gray-300"
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">
                              {item.order_number
                                ? `#${item.order_number}`
                                : String(item.order_id).slice(0, 8)}
                            </CardTitle>
                            <Badge
                              variant={getStatusBadgeVariant(
                                item.order_status ?? "pedido_criado"
                              )}
                            >
                              {getStatusLabel(item.order_status ?? "")}
                            </Badge>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-0">
                          <div className="space-y-2 text-xs">
                            {/* 🔹 Infos principais do item (produto, qtd, contexto, faltante) */}
                            {renderProductionItemInfo(item, column.id)}

                            {/* Responsável em qualquer coluna (se houver) */}
                            {collaboratorLabel && (
                              <div className="text-[11px] text-gray-600">
                                Responsável: {collaboratorLabel}
                              </div>
                            )}

                            {/* Campo de colaborador apenas em Pendentes */}
                            {column.id === "pendentes" &&
                              canAssignCollaborator && (
                                <form
                                  className="mt-2 space-y-1"
                                  action={async (formData: FormData) => {
                                    "use server";
                                    const userId = String(
                                      formData.get("userId") || ""
                                    );
                                    if (!userId) return;
                                    await assignProductionCollaborator(
                                      item.order_item_id,
                                      userId
                                    );
                                  }}
                                >
                                  <p className="text-[11px] font-semibold">
                                    Responsável pela produção
                                  </p>
                                  <select
                                    name="userId"
                                    defaultValue={
                                      item.production_assigned_to ?? ""
                                    }
                                    className="h-8 w-full rounded-md border px-2 text-[11px]"
                                  >
                                    <option value="">Selecionar...</option>
                                    {collaboratorOptions.map((user) => (
                                      <option key={user.id} value={user.id}>
                                        {user.full_name}{" "}
                                        {user.sector
                                          ? `– ${user.sector}`
                                          : ""}
                                      </option>
                                    ))}
                                  </select>
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant="outline"
                                    className="h-7 px-2 text-[11px]"
                                  >
                                    Definir colaborador
                                  </Button>
                                </form>
                              )}

                            {/* Botão Avançar status para Pendentes e Em preparo */}
                            {canChangeStatus &&
                              (column.id === "pendentes" ||
                                column.id === "preparo") && (
                                <form
                                  className="mt-2"
                                  action={async () => {
                                    "use server";
                                    await advanceProductionStatus(
                                      item.order_item_id
                                    );
                                  }}
                                >
                                  <Button
                                    type="submit"
                                    size="sm"
                                    className="h-7 w-full px-2 text-[11px]"
                                  >
                                    Avançar status do item
                                  </Button>
                                </form>
                              )}

                            {/* Mensagem em Pós-preparo + Botão para avançar PEDIDO */}
                            {column.id === "pos_preparo" && (
                              <>
                                <p className="mt-2 text-[11px] text-emerald-600">
                                  Produção concluída para este item.
                                </p>

                                {showAdvanceOrderButton && (
                                  <form
                                    className="mt-2"
                                    action={async () => {
                                      "use server";
                                      await moveOrderToNextStageFromProduction(
                                        String(item.order_id)
                                      );
                                    }}
                                  >
                                    <Button
                                      type="submit"
                                      size="sm"
                                      variant="default"
                                      className="h-7 w-full px-2 text-[11px]"
                                    >
                                      Avançar pedido para Separação
                                    </Button>
                                  </form>
                                )}
                              </>
                            )}

                            <div className="mt-1 flex items-center justify-end">
                              <a
                                href={`/dashboard/pedidos/${item.order_id}`}
                                className="text-[11px] text-primary underline-offset-2 hover:underline"
                              >
                                Ver detalhe do pedido
                              </a>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
