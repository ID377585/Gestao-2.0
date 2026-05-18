"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
};

const formatMoney = (value: number | null | undefined) => {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

type EstablishmentJoin = {
  id: string;
  name: string | null;
};

type InventoryCountRow = {
  id: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  total_items: number | null;
  total_products: number | null;

  created_by: string | null;
  establishment: EstablishmentJoin | null;
};

type InventoryCountRowRaw = {
  id: any;
  created_at: any;
  started_at: any;
  finished_at: any;
  total_items: any;
  total_products: any;
  created_by: any;
  establishment: EstablishmentJoin | EstablishmentJoin[] | null;
};

type ProductJoin = Record<string, any>;
type ProductJoinRaw = ProductJoin | ProductJoin[] | null | undefined;

type InventoryCountItem = {
  id: string;
  product_id: string | null;
  sku: string | null;
  product_name: string | null;

  unit_label: string | null;
  counted: number | null;
  current: number | null;
  diff: number | null;

  unit_price: number | null;
  line_total: number | null;

  status: string | null;
  message: string | null;
};

type InventoryCountItemRaw = {
  id: any;
  product_id: any;
  unit_label: any;
  counted_qty: any;
  current_stock_before: any;
  diff_qty: any;

  product_name: any;

  status: any;
  error_message: any;

  product: ProductJoinRaw;
};

function normalizeOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

function prettyRole(role: string) {
  const r = (role || "").toLowerCase();
  if (r === "admin") return "Admin";
  if (r === "operacao") return "Operação";
  if (r === "producao") return "Produção";
  if (r === "estoque") return "Estoque";
  if (r === "fiscal") return "Fiscal";
  if (r === "entrega") return "Entrega";
  if (r === "cliente") return "Cliente";
  return role ? role : "-";
}

function pickFirstNumber(obj: any, keys: string[]): number | null {
  if (!obj) return null;
  for (const k of keys) {
    const v = obj?.[k];
    if (v == null) continue;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export default function InventarioDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const inventoryId = resolvedParams.id;
  const router = useRouter();

  const [count, setCount] = useState<InventoryCountRow | null>(null);
  const [items, setItems] = useState<InventoryCountItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [headerErrorMsg, setHeaderErrorMsg] = useState<string | null>(null);
  const [itemsErrorMsg, setItemsErrorMsg] = useState<string | null>(null);

  const [createdByLabel, setCreatedByLabel] = useState<string>("-");
  const [isLoadingUserLabel, setIsLoadingUserLabel] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setHeaderErrorMsg(null);
      setItemsErrorMsg(null);
      setCreatedByLabel("-");
      setIsLoadingUserLabel(false);

      try {
        const supabase = createSupabaseBrowserClient();

        const { data: countData, error: countError } = await supabase
          .from("inventory_counts")
          .select(
            `
              id,
              created_at,
              started_at,
              finished_at,
              total_items,
              total_products,
              created_by,
              establishment:establishments(id,name)
            `
          )
          .eq("id", inventoryId)
          .maybeSingle();

        if (countError) {
          console.error("Erro ao carregar inventory_counts:", countError);
          setHeaderErrorMsg("Erro ao carregar informações do inventário.");
        }

        if (!countData) {
          console.warn(
            "[Inventário Detalhe] Nenhum registro em inventory_counts com id =",
            inventoryId
          );
          setHeaderErrorMsg("Inventário não encontrado.");
          setCount(null);
        } else {
          const raw = countData as InventoryCountRowRaw;
          const estab = normalizeOne(raw.establishment);

          const normalized: InventoryCountRow = {
            id: String(raw.id),
            created_at: String(raw.created_at),
            started_at: raw.started_at ? String(raw.started_at) : null,
            finished_at: raw.finished_at ? String(raw.finished_at) : null,
            total_items: raw.total_items == null ? null : Number(raw.total_items),
            total_products:
              raw.total_products == null ? null : Number(raw.total_products),
            created_by: raw.created_by ? String(raw.created_by) : null,
            establishment: estab
              ? { id: String(estab.id), name: estab.name ?? null }
              : null,
          };

          setCount(normalized);

          if (normalized.created_by && normalized.establishment?.id) {
            setIsLoadingUserLabel(true);

            let resolvedLabel: string | null = null;

            try {
              const qs = new URLSearchParams({
                user_id: normalized.created_by,
                establishment_id: normalized.establishment.id,
              });

              const res = await fetch(
                `/api/memberships/user-label?${qs.toString()}`,
                { method: "GET", cache: "no-store" }
              );

              if (res.ok) {
                const json: any = await res.json();
                const label = json?.label ? String(json.label) : "-";
                resolvedLabel = label && label !== "null" ? label : "-";
              }
            } catch (e) {
              console.warn("[Inventário Detalhe] Falha ao chamar user-label:", e);
            }

            if (!resolvedLabel || resolvedLabel === "-") {
              const { data: authData } = await supabase.auth.getUser();
              const u = authData?.user ?? null;
              if (u && u.id === normalized.created_by) {
                const meta: any = u.user_metadata ?? {};
                const authCandidate =
                  meta?.full_name ??
                  meta?.name ??
                  meta?.display_name ??
                  u.email ??
                  null;

                resolvedLabel = authCandidate ? String(authCandidate) : "-";
              } else {
                resolvedLabel = "-";
              }
            }

            setCreatedByLabel(resolvedLabel ?? "-");
            setIsLoadingUserLabel(false);
          }
        }

        const { data: itemsData, error: itemsError } = await supabase
          .from("inventory_count_items")
          .select(
            `
              id,
              product_id,
              unit_label,
              counted_qty,
              current_stock_before,
              diff_qty,
              product_name,
              status,
              error_message,
              product:products(*)
            `
          )
          .eq("inventory_count_id", inventoryId)
          .order("created_at", { ascending: true });

        if (itemsError) {
          console.error("Erro ao carregar inventory_count_items:", itemsError);
          setItemsErrorMsg("Erro ao carregar itens do inventário.");
          setItems([]);
        } else {
          const rawItems = (itemsData ?? []) as InventoryCountItemRaw[];

          const mapped: InventoryCountItem[] = rawItems.map((row) => {
            const diff = row.diff_qty == null ? 0 : Number(row.diff_qty);

            const computedStatus =
              row.status ??
              (diff > 0
                ? "ajuste_para_mais"
                : diff < 0
                ? "ajuste_para_menos"
                : "sem_ajuste");

            const product = normalizeOne(row.product) as any;
            const sku = product?.sku ?? null;

            const productName =
              product?.name ??
              (row.product_name ? String(row.product_name) : null);

            const counted =
              row.counted_qty == null ? null : Number(row.counted_qty);

            const unit_price = pickFirstNumber(product, [
              "unit_cost",
              "cost_price",
              "price_cost",
              "cost",
              "unit_price",
              "price",
              "custo_unitario",
              "preco_custo",
              "custo",
              "valor_unitario",
              "valor_custo",
            ]);

            const line_total =
              counted != null && unit_price != null ? counted * unit_price : null;

            return {
              id: String(row.id),
              product_id: row.product_id ? String(row.product_id) : null,
              sku,
              product_name: productName,

              unit_label: row.unit_label ? String(row.unit_label) : null,
              counted,
              current:
                row.current_stock_before == null
                  ? null
                  : Number(row.current_stock_before),
              diff,

              unit_price,
              line_total,

              status: computedStatus ? String(computedStatus) : null,
              message: row.error_message ? String(row.error_message) : null,
            };
          });

          setItems(mapped);
        }
      } catch (e) {
        console.error("Erro inesperado ao carregar detalhes do inventário:", e);
        setHeaderErrorMsg("Erro inesperado ao carregar detalhes do inventário.");
        setItemsErrorMsg("Erro inesperado ao carregar itens do inventário.");
      } finally {
        setIsLoading(false);
      }
    };

    if (inventoryId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventoryId]);

  const handleRecarregar = () => {
    router.refresh();
  };

  const establishmentName = count?.establishment?.name ?? "-";
  const createdByUserId = count?.created_by ?? "-";

  const totalValue = useMemo(() => {
    return (items ?? []).reduce((sum, it) => {
      const v =
        it.line_total != null && Number.isFinite(it.line_total) ? it.line_total : 0;
      return sum + v;
    }, 0);
  }, [items]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
            Detalhes do Inventário
          </h1>
          <p className="max-w-prose text-sm text-gray-600 sm:text-base">
            Visualize a contagem por produto e as diferenças em relação ao estoque
            antes da aplicação.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href="/dashboard/inventario/historico" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              ← Voltar ao histórico
            </Button>
          </Link>

          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={!inventoryId}
            className="w-full sm:w-auto"
          >
            <a href={`/api/export/products/inventory-count/${inventoryId}`}>
              Exportar (CSV)
            </a>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRecarregar}
            className="w-full sm:w-auto"
          >
            Recarregar
          </Button>
        </div>
      </div>

      {/* Resumo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo da contagem</CardTitle>
          <CardDescription>
            Informações gerais do inventário{" "}
            <span className="break-all font-mono text-xs">{inventoryId}</span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Carregando detalhes do inventário...
            </p>
          ) : headerErrorMsg ? (
            <p className="text-sm font-semibold text-red-600">{headerErrorMsg}</p>
          ) : !count ? (
            <p className="text-sm text-muted-foreground">
              Inventário não encontrado.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">ID</div>
                <div className="break-all font-mono text-xs">{count.id}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Criado em</div>
                <div className="font-medium">{formatDateTime(count.created_at)}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Iniciado em</div>
                <div className="font-medium">{formatDateTime(count.started_at)}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Finalizado em</div>
                <div className="font-medium">{formatDateTime(count.finished_at)}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Estabelecimento</div>
                <div className="font-medium break-words">{establishmentName}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Usuário</div>
                <div className="font-medium">
                  {isLoadingUserLabel ? "carregando…" : createdByLabel}
                </div>
                <div className="break-all font-mono text-[10px] text-muted-foreground">
                  {createdByUserId}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Itens lançados</div>
                <div className="font-medium">{count.total_items ?? 0}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Produtos distintos</div>
                <div className="font-medium">{count.total_products ?? 0}</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Valor total contado</div>
                <div className="font-semibold">{formatMoney(totalValue)}</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Itens */}
      <Card>
        <CardHeader>
          <CardTitle>Itens do inventário</CardTitle>
          <CardDescription>
            Contagem por produto, estoque anterior e diferença aplicada.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Carregando itens do inventário...
            </p>
          ) : itemsErrorMsg ? (
            <p className="text-sm font-semibold text-red-600">{itemsErrorMsg}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum item registrado para este inventário.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <div className="max-h-[70dvh] overflow-auto">
                <Table className="min-w-[1320px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>SKU</TableHead>
                      <TableHead>Produto</TableHead>
                      <TableHead>Un.</TableHead>
                      <TableHead>Contado</TableHead>
                      <TableHead>Preço unit.</TableHead>
                      <TableHead>Estoque Antes</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Estabelecimento</TableHead>
                      <TableHead>Total</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          {item.sku ?? "-"}
                        </TableCell>

                        <TableCell className="font-medium">
                          {item.product_name ?? "-"}
                        </TableCell>

                        <TableCell>{item.unit_label ?? "-"}</TableCell>
                        <TableCell>{item.counted ?? 0}</TableCell>

                        <TableCell className="text-xs">
                          {item.unit_price == null ? "-" : formatMoney(item.unit_price)}
                        </TableCell>

                        <TableCell>{item.current ?? 0}</TableCell>

                        <TableCell
                          className={
                            item.status === "ajuste_para_mais"
                              ? "font-semibold text-green-700"
                              : item.status === "ajuste_para_menos"
                              ? "font-semibold text-red-700"
                              : "text-gray-700"
                          }
                        >
                          {item.status ?? "-"}
                        </TableCell>

                        <TableCell className="max-w-[260px] break-words text-xs">
                          {item.message ?? "-"}
                        </TableCell>

                        <TableCell className="text-xs">
                          <div className="font-semibold">{createdByLabel}</div>
                          <div className="break-all font-mono text-[10px] text-muted-foreground">
                            {createdByUserId}
                          </div>
                        </TableCell>

                        <TableCell className="max-w-[220px] break-words text-xs">
                          {establishmentName}
                        </TableCell>

                        <TableCell className="text-xs font-semibold">
                          {item.line_total == null ? "-" : formatMoney(item.line_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}