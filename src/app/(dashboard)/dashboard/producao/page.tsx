import { revalidatePath } from "next/cache";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  listOrders,
  getMyMembership,
  type Role,
} from "../pedidos/actions";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardStatGrid } from "@/components/dashboard/DashboardStatGrid";

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

type KdsCollaborator = {
  id: string;
  full_name: string;
  sector: string | null;
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
      <p className="text-sm font-medium">
        {item.product_name} — {item.order_qty} {item.default_unit_label}
      </p>

      <p className="text-[11px] text-muted-foreground">
        {columnId === "pendentes" && "Aguardando início do preparo"}
        {columnId === "preparo" && "Em preparo pela produção"}
        {columnId === "pos_preparo" &&
          "Produção concluída, aguardando próxima etapa do pedido"}
      </p>

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

async function getKdsProductionItems(): Promise<KdsItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("kds_production_view")
    .select(
      `
      order_item_id,
      order_id,
      order_number,
      order_status,
      production_status,
      production_missing_qty,
      production_assigned_to,
      product_id,
      product_name,
      default_unit_label,
      order_qty
    `
    )
    .order("order_number", { ascending: true });

  if (error) {
    console.error("Erro ao carregar kds_production_view:", error);
    return [];
  }

  return (data ?? []) as KdsItem[];
}

async function listKdsCollaboratorsServer(): Promise<KdsCollaborator[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("kds_collaborators")
    .select("id, full_name, sector")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Erro ao listar colaboradores KDS:", error);
    return [];
  }

  return (data ?? []) as KdsCollaborator[];
}

async function assignProductionCollaboratorServer(
  orderItemId: string,
  userId: string
) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("order_items")
    .update({ production_assigned_to: userId })
    .eq("id", orderItemId);

  if (error) {
    console.error("Erro ao definir colaborador da produção:", error);
    throw new Error("Erro ao definir colaborador da produção.");
  }

  revalidatePath("/dashboard/producao");
}

async function advanceProductionStatusServer(orderItemId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("order_items")
    .select("production_status")
    .eq("id", orderItemId)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar item de produção:", error);
    throw new Error("Erro ao buscar item de produção.");
  }

  const current = (data?.production_status ??
    "pending") as KdsItem["production_status"];

  let next: KdsItem["production_status"] = current;

  if (current === "pending") next = "in_progress";
  else if (current === "in_progress") next = "done";
  else next = current;

  const { error: updateError } = await supabase
    .from("order_items")
    .update({ production_status: next })
    .eq("id", orderItemId);

  if (updateError) {
    console.error("Erro ao avançar status de produção:", updateError);
    throw new Error("Erro ao avançar status de produção.");
  }

  revalidatePath("/dashboard/producao");
}

async function moveOrderToNextStageFromProductionServer(orderId: string) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from("orders")
    .update({ status: "em_separacao" })
    .eq("id", orderId);

  if (error) {
    console.error("Erro ao avançar pedido para em_separacao:", error);
    throw new Error("Erro ao avançar pedido para em_separacao.");
  }

  revalidatePath("/dashboard/producao");
}

export default async function ProducaoPage() {
  const [membership, orders, productionItems, collaborators] =
    await Promise.all([
      getMyMembership(),
      listOrders(),
      getKdsProductionItems(),
      listKdsCollaboratorsServer(),
    ]);

  const role = membership.role as Role | null;
  const collaboratorOptions: KdsCollaborator[] = collaborators ?? [];

  const canSeeBoard = role !== "cliente";
  const canChangeStatus = ["admin", "operacao", "producao"].includes(
    role ?? "cliente"
  );
  const canAssignCollaborator = ["admin", "operacao"].includes(
    role ?? "cliente"
  );
  const canAdvanceOrders = ["admin", "operacao"].includes(role ?? "cliente");

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

  const pendentes = orders.filter((o) => o.status === "aceitou_pedido");
  const emPreparo = orders.filter((o) => o.status === "em_preparo");
  const posPreparo = orders.filter((o) =>
    ["em_separacao", "em_faturamento", "em_transporte"].includes(o.status)
  );
  const finalizadosHoje = orders.filter((o) => o.status === "entregue");
  const cancelados = orders.filter((o) => o.status === "cancelado");

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
      <DashboardPageHeader
        title="Produção - KDS"
        description="Kitchen Display System - visão de produção por status do pedido."
        actions={
          <form
            action={async () => {
              "use server";
              revalidatePath("/dashboard/producao");
            }}
            className="w-full sm:w-auto"
          >
            <Button variant="outline" type="submit" className="w-full sm:w-auto">
              <span className="mr-2">🔄</span>
              Atualizar
            </Button>
          </form>
        }
      >
        <p className="text-xs text-muted-foreground">
          Papel atual: <strong>{role ?? "—"}</strong>
        </p>
      </DashboardPageHeader>

      <DashboardStatGrid
        columnsClassName="grid-cols-2 md:grid-cols-5"
        items={[
          {
            title: "Pendentes",
            value: pendentes.length,
            description: "Aceitos, aguardando preparo",
            icon: <span className="text-xl">⏳</span>,
          },
          {
            title: "Em Preparo",
            value: emPreparo.length,
            description: "Em produção agora",
            icon: <span className="text-xl">👨‍🍳</span>,
          },
          {
            title: "Pós-preparo",
            value: posPreparo.length,
            description: "Separação / faturamento / transporte",
            icon: <span className="text-xl">📦</span>,
          },
          {
            title: "Entregues",
            value: finalizadosHoje.length,
            description: "Pedidos concluídos",
            icon: <span className="text-xl">✅</span>,
          },
          {
            title: "Cancelados",
            value: cancelados.length,
            description: "Fora do fluxo",
            icon: <span className="text-xl">🛑</span>,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PRODUCTION_COLUMNS.map((column) => {
          const itemsForColumn = productionItems.filter((i: KdsItem) => {
            const matchesStatus = column.productionStatuses.includes(
              i.production_status
            );

            if (column.id === "pendentes") {
              return matchesStatus && i.order_status === "aceitou_pedido";
            }

            return matchesStatus;
          });

          const renderedAdvanceButtonForOrder = new Set<string>();

          return (
            <div
              key={column.id}
              className="rounded-xl border bg-white dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="border-b p-4 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
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
                  <div className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground dark:border-slate-700">
                    Nenhum pedido nesta etapa.
                  </div>
                ) : (
                  itemsForColumn.map((item) => {
                    const collaboratorLabel = getCollaboratorLabel(
                      item.production_assigned_to ?? null
                    );

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
                        className="border-l-4 border-l-gray-300 dark:border-slate-800"
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
                            {renderProductionItemInfo(item, column.id)}

                            {collaboratorLabel && (
                              <div className="text-[11px] text-gray-600 dark:text-slate-400">
                                Responsável: {collaboratorLabel}
                              </div>
                            )}

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
                                    await assignProductionCollaboratorServer(
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
                                    className="h-8 w-full rounded-md border px-2 text-[11px] dark:border-slate-700 dark:bg-slate-950"
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

                            {canChangeStatus &&
                              (column.id === "pendentes" ||
                                column.id === "preparo") && (
                                <form
                                  className="mt-2"
                                  action={async () => {
                                    "use server";
                                    await advanceProductionStatusServer(
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
                                      await moveOrderToNextStageFromProductionServer(
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

                            <div className="text-[11px] text-muted-foreground">
                              Atualizado em: {formatDateTime(new Date().toISOString())}
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