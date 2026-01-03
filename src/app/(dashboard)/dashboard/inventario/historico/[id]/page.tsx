"use client";

import { useEffect, useState } from "react";
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

type ProductJoin = {
  id: string;
  sku: string | null;
  name: string | null;
};

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

export default function InventarioDetalhePage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();

  const [count, setCount] = useState<InventoryCountRow | null>(null);
  const [items, setItems] = useState<InventoryCountItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [headerErrorMsg, setHeaderErrorMsg] = useState<string | null>(null);
  const [itemsErrorMsg, setItemsErrorMsg] = useState<string | null>(null);

  // ✅ label amigável do usuário (ex.: "Admin" / "Ivan" / etc)
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

        // 1) Cabeçalho do inventário
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
          .eq("id", params.id)
          .maybeSingle();

        if (countError) {
          console.error("Erro ao carregar inventory_counts:", countError);
          setHeaderErrorMsg("Erro ao carregar informações do inventário.");
        }

        if (!countData) {
          console.warn(
            "[Inventário Detalhe] Nenhum registro em inventory_counts com id =",
            params.id
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

          // ✅ 1.1) Buscar um label amigável do usuário via memberships
          // FIX CRÍTICO: .maybeSingle() quebra se vierem múltiplas linhas.
          // Então a gente limita 1 linha com .limit(1) antes.
          if (normalized.created_by && normalized.establishment?.id) {
            setIsLoadingUserLabel(true);

            const { data: memberData, error: memberError } = await supabase
              .from("memberships")
              .select(
                `
                  role,
                  name,
                  full_name,
                  display_name
                `
              )
              .eq("user_id", normalized.created_by)
              .eq("establishment_id", normalized.establishment.id)
              .limit(1)
              .maybeSingle();

            if (memberError) {
              console.warn(
                "[Inventário Detalhe] Não consegui buscar memberships para label do usuário:",
                memberError
              );
              setCreatedByLabel("-");
            } else {
              const md: any = memberData ?? null;
              const candidate =
                md?.display_name ??
                md?.full_name ??
                md?.name ??
                (md?.role ? prettyRole(String(md.role)) : null);

              // ✅ Fallback extra: se esse created_by for o usuário logado,
              // tenta pegar nome/email do auth (não depende de tabela).
              if (!candidate) {
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
                  setCreatedByLabel(authCandidate ? String(authCandidate) : "-");
                } else {
                  setCreatedByLabel("-");
                }
              } else {
                setCreatedByLabel(String(candidate));
              }
            }

            setIsLoadingUserLabel(false);
          }
        }

        // 2) Itens do inventário + join products
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
              product:products(id,sku,name)
            `
          )
          .eq("inventory_count_id", params.id)
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

            const product = normalizeOne(row.product);
            const sku = product?.sku ?? null;

            const productName =
              product?.name ??
              (row.product_name ? String(row.product_name) : null);

            return {
              id: String(row.id),
              product_id: row.product_id ? String(row.product_id) : null,
              sku,
              product_name: productName,

              unit_label: row.unit_label ? String(row.unit_label) : null,
              counted: row.counted_qty == null ? null : Number(row.counted_qty),
              current:
                row.current_stock_before == null
                  ? null
                  : Number(row.current_stock_before),
              diff,

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

    if (params.id) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const handleRecarregar = () => {
    router.refresh();
  };

  const establishmentName = count?.establishment?.name ?? "-";
  const createdByUserId = count?.created_by ?? "-";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Detalhes do Inventário
          </h1>
          <p className="text-gray-600">
            Visualize a contagem por produto e as diferenças em relação ao estoque
            antes da aplicação.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/inventario/historico">
            <Button variant="outline" size="sm">
              ← Voltar ao histórico
            </Button>
          </Link>

          {/* Exportar CSV */}
          <Button asChild variant="outline" size="sm" disabled={!params.id}>
            <a href={`/api/export/products/inventory-count/${params.id}`}>
              Exportar (CSV)
            </a>
          </Button>

          <Button variant="outline" size="sm" onClick={handleRecarregar}>
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
            <span className="font-mono text-xs break-all">{params.id}</span>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-1 text-sm">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Carregando detalhes do inventário...
            </p>
          ) : headerErrorMsg ? (
            <p className="text-sm text-red-600 font-semibold">{headerErrorMsg}</p>
          ) : !count ? (
            <p className="text-sm text-muted-foreground">
              Inventário não encontrado.
            </p>
          ) : (
            <>
              <p>
                <span className="font-semibold">ID:</span>{" "}
                <span className="font-mono text-xs break-all">{count.id}</span>
              </p>

              <p>
                <span className="font-semibold">Criado em:</span>{" "}
                {formatDateTime(count.created_at)}
              </p>
              <p>
                <span className="font-semibold">Iniciado em:</span>{" "}
                {formatDateTime(count.started_at)}
              </p>
              <p>
                <span className="font-semibold">Finalizado em:</span>{" "}
                {formatDateTime(count.finished_at)}
              </p>

              <p>
                <span className="font-semibold">Estabelecimento:</span>{" "}
                {establishmentName}
              </p>

              {/* Usuário com label + UUID */}
              <p>
                <span className="font-semibold">Usuário:</span>{" "}
                {isLoadingUserLabel ? (
                  <span className="text-muted-foreground">carregando…</span>
                ) : (
                  <span className="font-semibold">{createdByLabel}</span>
                )}{" "}
                <span className="font-mono text-xs break-all text-muted-foreground">
                  ({createdByUserId})
                </span>
              </p>

              <p>
                <span className="font-semibold">Itens lançados:</span>{" "}
                {count.total_items ?? 0}
              </p>
              <p>
                <span className="font-semibold">Produtos distintos:</span>{" "}
                {count.total_products ?? 0}
              </p>
            </>
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
            <p className="text-sm text-red-600 font-semibold">{itemsErrorMsg}</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum item registrado para este inventário.
            </p>
          ) : (
            <div className="max-h-[520px] overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Produto</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead>Contado</TableHead>
                    <TableHead>Estoque Antes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Estabelecimento</TableHead>
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
                      <TableCell>{item.current ?? 0}</TableCell>

                      <TableCell
                        className={
                          item.status === "ajuste_para_mais"
                            ? "text-green-700 font-semibold"
                            : item.status === "ajuste_para_menos"
                            ? "text-red-700 font-semibold"
                            : "text-gray-700"
                        }
                      >
                        {item.status ?? "-"}
                      </TableCell>

                      <TableCell className="text-xs">
                        {item.message ?? "-"}
                      </TableCell>

                      {/* Usuário */}
                      <TableCell className="text-xs">
                        <div className="font-semibold">{createdByLabel}</div>
                        <div className="font-mono text-[10px] text-muted-foreground break-all">
                          {createdByUserId}
                        </div>
                      </TableCell>

                      <TableCell className="text-xs">
                        {establishmentName}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
