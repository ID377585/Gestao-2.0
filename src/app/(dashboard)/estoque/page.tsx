import Link from "next/link";
import { AlertTriangle, Boxes, ClipboardList, Package, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardStatGrid } from "@/components/dashboard/DashboardStatGrid";
import { DashboardTableShell } from "@/components/dashboard/DashboardTableShell";
import {
  getLastClosedInventorySession,
  listCurrentStock,
  seedInitialStockFromProducts,
} from "@/app/(dashboard)/dashboard/estoque/actions";

export const dynamic = "force-dynamic";

type StockRow = {
  id: string;
  quantity: number;
  unit_label: string | null;
  min_qty: number | null;
  med_qty: number | null;
  max_qty: number | null;
  location: string | null;
  product: {
    id: string;
    name: string;
    price: number | null;
    sku?: string | null;
    default_unit_label?: string | null;
  } | null;
};

type StatusEstoque = "critico" | "baixo" | "normal";

function getStatusFromRow(row: StockRow): StatusEstoque {
  const quantity = Number(row.quantity ?? 0);
  const min = Number(row.min_qty ?? 0);
  const med = Number(row.med_qty ?? 0);

  if (quantity < min) return "critico";
  if (quantity < med) return "baixo";
  return "normal";
}

function getStatusLabel(status: StatusEstoque) {
  if (status === "critico") return "Crítico";
  if (status === "baixo") return "Baixo";
  return "Normal";
}

function getStatusBadgeClass(status: StatusEstoque) {
  if (status === "critico") return "bg-red-600 text-white hover:bg-red-600";
  if (status === "baixo") return "bg-yellow-500 text-white hover:bg-yellow-500";
  return "bg-green-600 text-white hover:bg-green-600";
}

function formatQty(value: number | null | undefined) {
  const safe = Number(value ?? 0);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  }).format(Number.isFinite(safe) ? safe : 0);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default async function EstoqueDashboardPage() {
  let stock: StockRow[] = [];
  let lastClosedInventoryAt: string | null = null;
  let error = "";

  try {
    stock = (await listCurrentStock()) as StockRow[];

    if (stock.length === 0) {
      try {
        await seedInitialStockFromProducts();
        stock = (await listCurrentStock()) as StockRow[];
      } catch (seedError) {
        console.error("Falha ao semear estoque inicial no dashboard:", seedError);
      }
    }

    try {
      const lastClosed = await getLastClosedInventorySession();
      lastClosedInventoryAt =
        (lastClosed as any)?.finished_at ?? (lastClosed as any)?.started_at ?? null;
    } catch (inventoryError) {
      console.error("Falha ao buscar último inventário no dashboard:", inventoryError);
    }
  } catch (err: any) {
    console.error("Erro ao carregar dashboard de estoque:", err);
    error = err?.message ?? "Erro ao carregar dados do estoque.";
  }

  const totalProdutos = stock.length;
  const produtosSemSaldo = stock.filter((row) => Number(row.quantity ?? 0) <= 0);
  const produtosCriticos = stock.filter((row) => getStatusFromRow(row) === "critico");
  const produtosBaixos = stock.filter((row) => getStatusFromRow(row) === "baixo");
  const itensCriticos = [...stock]
    .filter((row) => getStatusFromRow(row) !== "normal")
    .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
    .slice(0, 10);

  const saldoTotal = stock.reduce(
    (acc, row) => acc + (Number.isFinite(Number(row.quantity)) ? Number(row.quantity) : 0),
    0
  );

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Estoque"
        title="Dashboard de Estoque"
        description="Visão executiva do saldo atual, itens críticos e último inventário encerrado."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/dashboard/entradas">Entradas</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/inventario">Inventário</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard/perdas">Perdas</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/estoque">Abrir Estoque</Link>
            </Button>
          </>
        }
      />

      {error ? (
        <DashboardTableShell
          title="Falha no carregamento"
          description="O dashboard não conseguiu montar os indicadores do estoque."
          empty
          emptyState={
            <div className="space-y-3">
              <p className="text-sm text-red-600">{error}</p>
              <p className="text-sm text-muted-foreground">
                A área operacional continua disponível em
                {" "}
                <Link href="/dashboard/estoque" className="underline underline-offset-4">
                  /dashboard/estoque
                </Link>
                .
              </p>
            </div>
          }
        >
          <div />
        </DashboardTableShell>
      ) : (
        <>
          <DashboardStatGrid
            items={[
              {
                title: "Produtos monitorados",
                value: totalProdutos,
                description: "Itens com saldo e metadados de estoque no estabelecimento.",
                icon: <Package className="h-4 w-4" />,
              },
              {
                title: "Sem saldo",
                value: produtosSemSaldo.length,
                description: "Produtos zerados no saldo atual.",
                icon: <TrendingDown className="h-4 w-4" />,
              },
              {
                title: "Estoque crítico",
                value: produtosCriticos.length,
                description: "Itens abaixo do mínimo configurado.",
                icon: <AlertTriangle className="h-4 w-4" />,
              },
              {
                title: "Último inventário",
                value: lastClosedInventoryAt ? formatDateTime(lastClosedInventoryAt) : "—",
                description: "Data do último inventário encerrado.",
                icon: <ClipboardList className="h-4 w-4" />,
                valueClassName: "text-base sm:text-lg",
              },
            ]}
          />

          <DashboardStatGrid
            columnsClassName="grid-cols-1 md:grid-cols-2"
            items={[
              {
                title: "Saldo consolidado",
                value: formatQty(saldoTotal),
                description: "Soma das quantidades atuais de todos os itens monitorados.",
                icon: <Boxes className="h-4 w-4" />,
              },
              {
                title: "Estoque baixo",
                value: produtosBaixos.length,
                description: "Itens entre o mínimo e o nível médio configurado.",
                icon: <TrendingDown className="h-4 w-4" />,
              },
            ]}
          />

          <DashboardTableShell
            title="Itens de atenção"
            description="Produtos com saldo crítico ou baixo, ordenados pelos menores saldos."
            empty={itensCriticos.length === 0}
            emptyState={
              <p className="text-sm text-muted-foreground">
                Nenhum item crítico ou baixo no estoque atual.
              </p>
            }
            footer={
              <p className="text-xs text-muted-foreground">
                Para ajustar limites, inventário e movimentações, abra a área operacional de estoque.
              </p>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                  <TableHead className="text-right">Mín.</TableHead>
                  <TableHead className="text-right">Méd.</TableHead>
                  <TableHead>Local</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensCriticos.map((row) => {
                  const status = getStatusFromRow(row);
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">
                        {row.product?.name ?? "Produto sem vínculo"}
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeClass(status)}>
                          {getStatusLabel(status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQty(row.quantity)} {row.unit_label ?? ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQty(row.min_qty)} {row.unit_label ?? ""}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatQty(row.med_qty)} {row.unit_label ?? ""}
                      </TableCell>
                      <TableCell>{row.location ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DashboardTableShell>
        </>
      )}
    </div>
  );
}
