"use client";

import { useEffect, useState } from "react";
import { getFiscalDashboardAction } from "./actions";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function MetricCard(props: {
  title: string;
  value: string | number;
  description?: string;
}) {
  return (
    <div className="border rounded-xl bg-card p-5 space-y-2">
      <div className="text-sm text-muted-foreground">{props.title}</div>
      <div className="text-3xl font-bold">{props.value}</div>
      {props.description && (
        <div className="text-xs text-muted-foreground">
          {props.description}
        </div>
      )}
    </div>
  );
}

export default function FiscalDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await getFiscalDashboardAction();
      setData(response);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Fiscal</h1>
        <p className="text-sm text-muted-foreground">
          Monitoramento SEFAZ, XMLs, entradas e sincronização fiscal.
        </p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">
          Carregando dashboard fiscal...
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard
              title="NF-es totais"
              value={data.metrics.total}
            />

            <MetricCard
              title="XML completo"
              value={data.metrics.fullXml}
            />

            <MetricCard
              title="Pendentes de entrada"
              value={data.metrics.pendingEntry}
            />

            <MetricCard
              title="Valor total NF-es"
              value={formatCurrency(data.metrics.totalValue)}
            />

            <MetricCard
              title="Importadas"
              value={data.metrics.imported}
            />

            <MetricCard
              title="Somente resumo"
              value={data.metrics.summaryOnly}
            />

            <MetricCard
              title="Manifestadas"
              value={data.metrics.manifested}
            />

            <MetricCard
              title="Sem XML"
              value={data.metrics.withoutXml}
            />
          </div>

          <div className="border rounded-xl bg-card p-5 space-y-2">
            <div className="font-semibold">Sincronização SEFAZ</div>

            <div className="text-sm text-muted-foreground">
              Último NSU:
              <span className="font-mono ml-2 text-foreground">
                {data.nsu.ultimo_nsu}
              </span>
            </div>

            <div className="text-sm text-muted-foreground">
              Última atualização:
              <span className="ml-2 text-foreground">
                {formatDate(data.nsu.updated_at)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="border rounded-xl bg-card overflow-hidden">
              <div className="p-4 border-b font-semibold">
                NF-es pendentes de entrada
              </div>

              <div className="divide-y">
                {data.pendingNotes.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">
                    Nenhuma pendência encontrada.
                  </div>
                )}

                {data.pendingNotes.map((note: any) => (
                  <div
                    key={note.id}
                    className="p-4 text-sm flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-medium">
                        {note.fornecedor_nome || "Fornecedor"}
                      </div>

                      <div className="text-muted-foreground text-xs">
                        NF {note.numero || "—"} • Série {note.serie || "—"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-medium">
                        {formatCurrency(Number(note.valor_total || 0))}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {note.status_manifestacao || "pendente"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border rounded-xl bg-card overflow-hidden">
              <div className="p-4 border-b font-semibold">
                XML pendente/liberação SEFAZ
              </div>

              <div className="divide-y">
                {data.xmlPendingNotes.length === 0 && (
                  <div className="p-4 text-sm text-muted-foreground">
                    Nenhuma pendência encontrada.
                  </div>
                )}

                {data.xmlPendingNotes.map((note: any) => (
                  <div
                    key={note.id}
                    className="p-4 text-sm flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="font-medium">
                        {note.fornecedor_nome || "Fornecedor"}
                      </div>

                      <div className="text-muted-foreground text-xs">
                        {note.chave_acesso || "Sem chave"}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-medium">
                        {note.status_manifestacao || "pendente"}
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {formatDate(note.updated_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="p-4 border-b font-semibold">
              Últimas NF-es sincronizadas
            </div>

            <div className="divide-y">
              {data.recentNotes.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">
                  Nenhuma NF-e encontrada.
                </div>
              )}

              {data.recentNotes.map((note: any) => (
                <div
                  key={note.id}
                  className="grid grid-cols-1 md:grid-cols-5 gap-4 p-4 text-sm"
                >
                  <div>
                    <div className="text-xs text-muted-foreground">Fornecedor</div>
                    <div className="font-medium">
                      {note.fornecedor_nome || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">NF-e</div>
                    <div>
                      {note.numero || "—"} / {note.serie || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">Valor</div>
                    <div>
                      {formatCurrency(Number(note.valor_total || 0))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div>{note.status_manifestacao || "pendente"}</div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">Atualizado</div>
                    <div>{formatDate(note.updated_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
