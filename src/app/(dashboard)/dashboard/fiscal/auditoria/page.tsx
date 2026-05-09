"use client";

import { useEffect, useState } from "react";
import { getFiscalAuditAction } from "./actions";

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

function translateIssue(issue: string) {
  const map: Record<string, string> = {
    sem_entrada: "Sem entrada",
    sem_xml: "Sem XML",
    somente_resumo: "Somente resumo",
    manifestacao_pendente: "Manifestação pendente",
    fornecedor_sem_cnpj: "Fornecedor sem CNPJ",
    valor_zerado: "Valor zerado",
  };

  return map[issue] || issue;
}

function Metric(props: {
  title: string;
  value: number;
}) {
  return (
    <div className="border rounded-xl bg-card p-5">
      <div className="text-sm text-muted-foreground">
        {props.title}
      </div>

      <div className="text-3xl font-bold mt-2">
        {props.value}
      </div>
    </div>
  );
}

export default function FiscalAuditPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any | null>(null);

  const loadAudit = async () => {
    try {
      setLoading(true);
      const response = await getFiscalAuditAction();
      setData(response);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAudit();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Auditoria Fiscal</h1>
        <p className="text-sm text-muted-foreground">
          Verificação de inconsistências fiscais, XMLs e entradas.
        </p>
      </div>

      {loading && (
        <div className="text-sm text-muted-foreground">
          Carregando auditoria fiscal...
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            <Metric
              title="Total NF-es"
              value={data.summary.total}
            />

            <Metric
              title="Com inconsistências"
              value={data.summary.withIssues}
            />

            <Metric
              title="Sem entrada"
              value={data.summary.withoutEntry}
            />

            <Metric
              title="XML pendente"
              value={data.summary.xmlPending}
            />

            <Metric
              title="Manifestação pendente"
              value={data.summary.manifestationPending}
            />

            <Metric
              title="Fornecedor inconsistente"
              value={data.summary.supplierIssues}
            />
          </div>

          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="p-4 border-b font-semibold">
              Inconsistências encontradas
            </div>

            {data.issues.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                Nenhuma inconsistência encontrada.
              </div>
            )}

            <div className="divide-y">
              {data.issues.map((note: any) => (
                <div
                  key={note.id}
                  className="grid grid-cols-1 xl:grid-cols-6 gap-4 p-4 text-sm"
                >
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Fornecedor
                    </div>

                    <div className="font-medium">
                      {note.fornecedor_nome || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      NF-e
                    </div>

                    <div>
                      {note.numero || "—"} / {note.serie || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Valor
                    </div>

                    <div>
                      {formatCurrency(Number(note.valor_total || 0))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Manifestação
                    </div>

                    <div>
                      {note.status_manifestacao || "pendente"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Atualizado
                    </div>

                    <div>
                      {formatDate(note.updated_at)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Problemas
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1">
                      {note.issues.map((issue: string) => (
                        <span
                          key={issue}
                          className="border rounded-full px-2 py-1 text-[11px] bg-muted"
                        >
                          {translateIssue(issue)}
                        </span>
                      ))}
                    </div>
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
