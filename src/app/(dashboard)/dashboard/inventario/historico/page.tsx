"use client";

import { useEffect, useState } from "react";
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

type InventoryCountRow = {
  id: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  total_items: number | null;
  total_products: number | null;
};

export default function InventarioHistoricoPage() {
  const [rows, setRows] = useState<InventoryCountRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setErrorMsg(null);

      try {
        const supabase = createSupabaseBrowserClient();

        const { data, error } = await supabase
          .from("inventory_counts")
          .select(
            "id, created_at, started_at, finished_at, total_items, total_products"
          )
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          console.error("Erro ao carregar inventory_counts:", error);
          setErrorMsg("Erro ao carregar histórico de inventários.");
          setRows([]);
        } else {
          console.log("[Inventário Histórico] Contagens encontradas:", data);
          setRows((data || []) as InventoryCountRow[]);
        }
      } catch (e) {
        console.error("Erro inesperado ao carregar histórico:", e);
        setErrorMsg("Erro inesperado ao carregar histórico de inventários.");
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight text-gray-900 sm:text-3xl">
            Histórico de Inventários
          </h1>
          <p className="max-w-prose text-sm text-gray-600 sm:text-base">
            Veja todas as contagens de inventário aplicadas no sistema.
          </p>
        </div>

        <Link href="/dashboard/inventario" className="w-full sm:w-auto">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            ← Voltar ao Inventário
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventários</CardTitle>
          <CardDescription>
            Lista das últimas contagens aplicadas. Clique em um inventário para
            ver os detalhes por produto.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">
              Carregando histórico de inventários...
            </p>
          ) : errorMsg ? (
            <p className="text-sm font-semibold text-red-600">{errorMsg}</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum inventário registrado até o momento.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <div className="max-h-[70dvh] overflow-auto">
                <Table className="min-w-[920px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead>Iniciado em</TableHead>
                      <TableHead>Finalizado em</TableHead>
                      <TableHead>Itens lançados</TableHead>
                      <TableHead>Produtos distintos</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[220px] break-all font-mono text-xs sm:max-w-[280px]">
                          {row.id}
                        </TableCell>
                        <TableCell>{formatDateTime(row.created_at)}</TableCell>
                        <TableCell>{formatDateTime(row.started_at)}</TableCell>
                        <TableCell>{formatDateTime(row.finished_at)}</TableCell>
                        <TableCell>{row.total_items ?? 0}</TableCell>
                        <TableCell>{row.total_products ?? 0}</TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/dashboard/inventario/historico/${row.id}`}
                          >
                            <Button size="sm" variant="outline">
                              Ver detalhes
                            </Button>
                          </Link>
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