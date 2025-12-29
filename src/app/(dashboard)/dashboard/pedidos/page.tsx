"use client";

import { useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
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

import { Badge } from "@/components/ui/badge";

import { listOrders } from "./actions";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import NewOrderDialog from "./NewOrderDialog"; // ✅ import default do componente

// =============================================
// TIPAGEM DOS PEDIDOS
// =============================================
type Pedido = {
  id: string;
  order_number: number | null;
  status: string;
  created_at: string;
  notes: string | null;
};

const formatDateTime = (date: string) =>
  new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const STATUS_LABEL: Record<string, string> = {
  pedido_criado: "Pedido criado",
  aceitou_pedido: "Pedido aceito",
  em_preparo: "Em preparo",
  em_separacao: "Em separação",
  em_faturamento: "Em faturamento",
  em_transporte: "Em transporte",
  entregue: "Entregue",
  cancelado: "Cancelado",
  reaberto: "Reaberto",
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

// =============================================
// COMPONENTE PRINCIPAL DA PÁGINA
// =============================================
export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // ============================
  // AUTENTICAÇÃO
  // ============================
  useEffect(() => {
    let cancelled = false;

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setAuthUserId(data?.session?.user?.id ?? null);
        setAuthChecked(true);
      }
    };

    loadSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null);
      setAuthChecked(true);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  // ============================
  // CARREGAR LISTA DE PEDIDOS
  // ============================
  const loadOrders = async () => {
    try {
      setIsLoadingOrders(true);
      const data = await listOrders();

      const mapped: Pedido[] = (data ?? []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number ?? null,
        status: o.status,
        created_at: o.created_at,
        notes: o.notes ?? null,
      }));

      setPedidos(mapped);
    } catch (err: any) {
      console.error(err);
      alert(
        `Não foi possível carregar os pedidos.\n\nDetalhe: ${
          err?.message ?? "Erro desconhecido"
        }`
      );
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (!authChecked) return;
    if (!authUserId) return;

    loadOrders();
  }, [authChecked, authUserId]);

  // =============================================
  // RENDERIZAÇÃO
  // =============================================
  return (
    <div className="space-y-6">
      <PageHeader />

      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {authChecked ? (
            authUserId ? (
              <span>✅ Usuário autenticado</span>
            ) : (
              <span>⚠️ Nenhum usuário logado</span>
            )
          ) : (
            <span>Verificando autenticação...</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={loadOrders}
            disabled={!authUserId || isLoadingOrders}
          >
            {isLoadingOrders ? "Atualizando..." : "Atualizar"}
          </Button>

          {/* Aqui entra o novo formulário */}
          <NewOrderDialog onCreated={loadOrders} />
        </div>
      </div>

      {/* ===================== TABELA ===================== */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
          <CardDescription>
            Lista de pedidos reais (filtrados pela sua unidade via RLS)
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoadingOrders ? (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {pedidos.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-sm text-muted-foreground"
                    >
                      Nenhum pedido encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidos.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() =>
                        (window.location.href = `/dashboard/pedidos/${p.id}`)
                      }
                    >
                      <TableCell>
                        {p.order_number ? `#${p.order_number}` : "—"}
                      </TableCell>
                      <TableCell>{formatDateTime(p.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(p.status)}>
                          {getStatusLabel(p.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[420px] truncate">
                        {p.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
