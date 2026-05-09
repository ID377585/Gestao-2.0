"use client";

import { useEffect, useState, useTransition } from "react";
import {
  auditFiscalNoteDivergencesAction,
  listFiscalNotesForDivergenceAction,
} from "./actions";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function translateIssue(issue: string) {
  const map: Record<string, string> = {
    produto_nao_vinculado: "Produto não vinculado",
    unidade_divergente: "Unidade divergente",
    custo_divergente: "Custo divergente",
  };

  return map[issue] || issue;
}

function translateMatchType(type: string) {
  const map: Record<string, string> = {
    sku_ean: "SKU/EAN",
    nome_exato: "Nome exato",
    nome_aproximado: "Nome aproximado",
    sem_vinculo: "Sem vínculo",
  };

  return map[type] || type;
}

export default function FiscalDivergencesPage() {
  const [notes, setNotes] = useState<any[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string>("");
  const [audit, setAudit] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const loadNotes = async () => {
    try {
      setLoading(true);
      const data = await listFiscalNotesForDivergenceAction();
      setNotes(Array.isArray(data) ? data : []);

      if (data?.[0]?.id) {
        setSelectedNoteId(String(data[0].id));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    if (!selectedNoteId) return;

    startTransition(async () => {
      try {
        const response = await auditFiscalNoteDivergencesAction(selectedNoteId);
        setAudit(response);
      } catch (error: any) {
        console.error(error);
        setAudit({ error: error?.message || "Erro ao auditar NF-e." });
      }
    });
  }, [selectedNoteId]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Divergências Fiscais</h1>
        <p className="text-sm text-muted-foreground">
          Comparação entre XML NF-e e produtos cadastrados.
        </p>
      </div>

      <div className="border rounded-xl bg-card p-5 space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Selecionar NF-e
          </label>

          <select
            value={selectedNoteId}
            onChange={(e) => setSelectedNoteId(e.target.value)}
            className="w-full border rounded-md px-3 py-2 bg-background"
          >
            <option value="">
              Selecione uma NF-e
            </option>

            {notes.map((note) => (
              <option
                key={note.id}
                value={note.id}
              >
                NF {note.numero || "—"} / Série {note.serie || "—"} — {note.fornecedor_nome || "Fornecedor"}
              </option>
            ))}
          </select>
        </div>

        {loading && (
          <div className="text-sm text-muted-foreground">
            Carregando NF-es...
          </div>
        )}
      </div>

      {isPending && (
        <div className="text-sm text-muted-foreground">
          Auditando produtos da NF-e...
        </div>
      )}

      {audit?.error && (
        <div className="border rounded-xl bg-destructive/10 text-destructive p-4 text-sm">
          {audit.error}
        </div>
      )}

      {audit && !audit.error && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="border rounded-xl bg-card p-5">
              <div className="text-sm text-muted-foreground">
                Total itens
              </div>
              <div className="text-3xl font-bold mt-2">
                {audit.summary.totalItems}
              </div>
            </div>

            <div className="border rounded-xl bg-card p-5">
              <div className="text-sm text-muted-foreground">
                Produtos vinculados
              </div>
              <div className="text-3xl font-bold mt-2">
                {audit.summary.matched}
              </div>
            </div>

            <div className="border rounded-xl bg-card p-5">
              <div className="text-sm text-muted-foreground">
                Sem vínculo
              </div>
              <div className="text-3xl font-bold mt-2">
                {audit.summary.unmatched}
              </div>
            </div>

            <div className="border rounded-xl bg-card p-5">
              <div className="text-sm text-muted-foreground">
                Divergência custo
              </div>
              <div className="text-3xl font-bold mt-2">
                {audit.summary.costDivergences}
              </div>
            </div>

            <div className="border rounded-xl bg-card p-5">
              <div className="text-sm text-muted-foreground">
                Divergência unidade
              </div>
              <div className="text-3xl font-bold mt-2">
                {audit.summary.unitDivergences}
              </div>
            </div>
          </div>

          <div className="border rounded-xl bg-card overflow-hidden">
            <div className="p-4 border-b font-semibold">
              Comparação XML x Cadastro interno
            </div>

            <div className="divide-y">
              {audit.items.map((row: any) => (
                <div
                  key={row.index}
                  className="grid grid-cols-1 xl:grid-cols-7 gap-4 p-4 text-sm"
                >
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Produto XML
                    </div>

                    <div className="font-medium">
                      {row.xml.description}
                    </div>

                    <div className="text-xs text-muted-foreground mt-1">
                      SKU: {row.xml.code || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Produto interno
                    </div>

                    <div className="font-medium">
                      {row.product?.name || "Não encontrado"}
                    </div>

                    <div className="text-xs text-muted-foreground mt-1">
                      {row.product?.sku || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Match
                    </div>

                    <div>
                      {translateMatchType(row.matchType)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Unidade
                    </div>

                    <div>
                      XML: {row.xml.unit || "—"}
                    </div>

                    <div className="text-xs text-muted-foreground mt-1">
                      Interno: {row.product?.unit || "—"}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Custo XML
                    </div>

                    <div>
                      {formatCurrency(Number(row.xml.unitCost || 0))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Custo interno
                    </div>

                    <div>
                      {formatCurrency(Number(row.product?.cost || 0))}
                    </div>

                    {row.costDifference !== null && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Diferença: {formatCurrency(Number(row.costDifference || 0))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Problemas
                    </div>

                    <div className="flex flex-wrap gap-1 mt-1">
                      {row.issues.length === 0 && (
                        <span className="border rounded-full px-2 py-1 text-[11px] bg-muted">
                          OK
                        </span>
                      )}

                      {row.issues.map((issue: string) => (
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
