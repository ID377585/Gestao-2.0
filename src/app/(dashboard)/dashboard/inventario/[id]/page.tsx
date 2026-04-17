// src/app/(dashboard)/dashboard/inventario/[id]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

type InventoryCount = {
  id: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string | null;
  notes: string | null;
  establishment_id: string;
};

type ProductJoin =
  | { name: string | null }
  | { name: string | null }[]
  | null;

type InventoryItemRow = {
  id: string;
  unit_label: string | null;
  counted_qty: number | null;
  current_stock_before: number | null;
  diff_qty: number | null;
  products: ProductJoin;
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("pt-BR");
};

const formatNumber = (value: number | null) => {
  if (value === null || value === undefined) return "-";
  return String(value);
};

function getProductName(products: ProductJoin): string {
  if (!products) return "(sem nome)";
  if (Array.isArray(products)) return products[0]?.name ?? "(sem nome)";
  return products.name ?? "(sem nome)";
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export default async function InventoryDetailsPage({
  params,
}: {
  params: { id: string };
}) {
  const inventoryId = params.id;

  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = membership.establishment_id;

  const supabase = await createSupabaseServerClient();

  const { data: count, error: countError } = await supabase
    .from("inventory_counts")
    .select("id, started_at, ended_at, created_at, notes, establishment_id")
    .eq("id", inventoryId)
    .maybeSingle();

  if (countError) {
    console.error("Erro ao carregar inventory_counts:", countError);
  }

  if (!count || count.establishment_id !== establishmentId) {
    return notFound();
  }

  const countRow = count as InventoryCount;

  const { data: items, error: itemsError } = await supabase
    .from("inventory_count_items")
    .select(
      `
      id,
      unit_label,
      counted_qty,
      current_stock_before,
      diff_qty,
      products (
        name
      )
    `
    )
    .eq("inventory_count_id", inventoryId)
    .order("diff_qty", { ascending: false });

  if (itemsError) {
    console.error("Erro ao carregar inventory_count_items:", itemsError);
  }

  const rows: InventoryItemRow[] = ((items ?? []) as any[]).map((r) => ({
    id: r.id,
    unit_label: r.unit_label ?? null,
    counted_qty: r.counted_qty ?? null,
    current_stock_before: r.current_stock_before ?? null,
    diff_qty: r.diff_qty ?? null,
    products: (r.products ?? null) as ProductJoin,
  }));

  const totalItems = rows.length;
  const totalDiffAbs = rows.reduce(
    (acc, r) => acc + Math.abs(r.diff_qty ?? 0),
    0
  );
  const itemsComDiferenca = rows.filter((r) => (r.diff_qty ?? 0) !== 0).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-all text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
            Inventário #{inventoryId}
          </h1>
          <p className="max-w-prose text-sm text-gray-600 sm:text-base">
            Detalhes da contagem, estoque anterior e ajustes gerados.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link href="/dashboard/inventario/historico" className="w-full sm:w-auto">
            <Button variant="outline" size="sm" className="w-full sm:w-auto">
              ← Voltar ao histórico
            </Button>
          </Link>

          <a
            href={`/dashboard/inventario/${inventoryId}/export`}
            className="w-full sm:inline-flex sm:w-auto"
          >
            <Button variant="secondary" size="sm" className="w-full sm:w-auto">
              Exportar CSV (Excel)
            </Button>
          </a>
        </div>
      </div>

      {/* Resumo do inventário */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo do inventário</CardTitle>
          <CardDescription>
            Dados gerais da contagem e visão rápida das divergências.
          </CardDescription>
        </CardHeader>

        <CardContent className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Iniciado em</div>
            <div className="font-medium">
              {formatDateTime(countRow.started_at ?? countRow.created_at)}
            </div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Finalizado em</div>
            <div className="font-medium">{formatDateTime(countRow.ended_at)}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Itens lançados</div>
            <div className="font-medium">{totalItems}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">
              Produtos com diferença
            </div>
            <div className="font-medium">{itemsComDiferenca}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">
              Soma absoluta das diferenças
            </div>
            <div className="font-medium">{totalDiffAbs}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Observações</div>
            <div className="font-medium text-xs break-words">
              {countRow.notes?.trim() || "-"}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de itens */}
      <Card>
        <CardHeader>
          <CardTitle>Itens do inventário</CardTitle>
          <CardDescription>
            Estoque anterior, quantidade contada e diferença por produto/unidade.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum item registrado para este inventário.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <div className="max-h-[70dvh] overflow-auto">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Un.</TableHead>
                      <TableHead className="text-right">Estoque antes</TableHead>
                      <TableHead className="text-right">Contado</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead>Ajuste</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {rows.map((r) => {
                      const diff = r.diff_qty ?? 0;
                      const hasDiff = diff !== 0;

                      const diffColor =
                        diff > 0
                          ? "text-green-700"
                          : diff < 0
                          ? "text-red-700"
                          : "text-gray-700";

                      const badgeClasses =
                        diff > 0
                          ? "inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800"
                          : diff < 0
                          ? "inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
                          : "inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-800";

                      const ajusteLabel =
                        diff > 0
                          ? "Ajuste de entrada"
                          : diff < 0
                          ? "Ajuste de saída"
                          : "Sem ajuste";

                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">
                            {getProductName(r.products)}
                          </TableCell>
                          <TableCell>{r.unit_label ?? "-"}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(r.current_stock_before)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(r.counted_qty)}
                          </TableCell>
                          <TableCell
                            className={cn("text-right font-semibold", diffColor)}
                          >
                            {hasDiff ? formatNumber(diff) : "0"}
                          </TableCell>
                          <TableCell>
                            <span className={badgeClasses}>{ajusteLabel}</span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
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