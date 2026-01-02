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

// ✅ JOIN do Supabase pode vir como objeto OU array (dependendo do select/relacionamento)
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

// ✅ pega o nome independente de vir objeto ou array
function getProductName(products: ProductJoin): string {
  if (!products) return "(sem nome)";
  if (Array.isArray(products)) return products[0]?.name ?? "(sem nome)";
  return products.name ?? "(sem nome)";
}

// pequena função util para combinar classes
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

  // 1) Cabeçalho do inventário
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

  // 2) Itens do inventário + nome do produto
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

  // ✅ normaliza para o TS entender sempre a mesma estrutura
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Inventário #{inventoryId}
          </h1>
          <p className="text-gray-600">
            Detalhes da contagem, estoque anterior e ajustes gerados.
          </p>
        </div>

        <div className="flex gap-2">
          <Link href="/dashboard/inventario/historico">
            <Button variant="outline" size="sm">
              ← Voltar ao histórico
            </Button>
          </Link>

          {/* Export CSV (abre no Excel) */}
          <a
            href={`/dashboard/inventario/${inventoryId}/export`}
            className="inline-flex"
          >
            <Button variant="secondary" size="sm">
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
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
            <div className="font-medium text-xs">
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
            <div className="max-h-[520px] overflow-auto border rounded">
              <Table>
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
                        <TableCell className={cn("text-right font-semibold", diffColor)}>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
