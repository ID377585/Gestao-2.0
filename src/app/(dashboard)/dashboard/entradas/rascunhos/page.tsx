"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createInvoiceEntry,
  deleteInvoiceEntryDraft,
  listInvoiceEntryDrafts,
  type InvoiceEntryDraftRow,
  type InvoiceEntryInput,
} from "../actions";

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
  }).format(date);
}

function getDraftTotal(draft: InvoiceEntryDraftRow) {
  const items = draft.data?.items ?? [];

  return Number(
    items.reduce((acc, item) => acc + Number(item.total_cost || 0), 0).toFixed(2)
  );
}

export default function EntradaDraftsReviewPage() {
  const [drafts, setDrafts] = useState<InvoiceEntryDraftRow[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<InvoiceEntryDraftRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [processingDraftId, setProcessingDraftId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadDrafts = async () => {
    try {
      setLoading(true);

      const data = await listInvoiceEntryDrafts();
      const normalized = Array.isArray(data) ? data : [];

      setDrafts(normalized);
      setSelectedDraft((current) => {
        if (!normalized.length) return null;
        if (!current) return normalized[0];
        return normalized.find((draft) => draft.id === current.id) ?? normalized[0];
      });
    } catch (error: any) {
      console.error(error);
      alert(error?.message || "Erro ao carregar rascunhos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDrafts();
  }, []);

  const selectedTotal = useMemo(() => {
    return selectedDraft ? getDraftTotal(selectedDraft) : 0;
  }, [selectedDraft]);

  const handleApproveDraft = async (draft: InvoiceEntryDraftRow) => {
    const confirmed = window.confirm(
      "Confirmar este rascunho e lançar a entrada no estoque?"
    );

    if (!confirmed) return;

    setProcessingDraftId(draft.id);

    startTransition(async () => {
      try {
        const payload: InvoiceEntryInput = {
          ...draft.data,
          approval_status: "approved",
          update_product_standard_cost: Boolean(draft.data.update_product_standard_cost),
          items: draft.data.items ?? [],
        };

        await createInvoiceEntry(payload);
        await deleteInvoiceEntryDraft(draft.id);
        await loadDrafts();

        alert("Entrada lançada no estoque com sucesso.");
      } catch (error: any) {
        console.error(error);
        alert(error?.message || "Erro ao aprovar rascunho.");
      } finally {
        setProcessingDraftId(null);
      }
    });
  };

  const handleDeleteDraft = async (draft: InvoiceEntryDraftRow) => {
    const confirmed = window.confirm(
      "Excluir este rascunho? Essa ação não movimenta estoque."
    );

    if (!confirmed) return;

    setProcessingDraftId(draft.id);

    startTransition(async () => {
      try {
        await deleteInvoiceEntryDraft(draft.id);
        await loadDrafts();

        alert("Rascunho excluído.");
      } catch (error: any) {
        console.error(error);
        alert(error?.message || "Erro ao excluir rascunho.");
      } finally {
        setProcessingDraftId(null);
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Revisão de Entradas
        </h1>

        <p className="text-sm text-muted-foreground">
          Revise os rascunhos gerados por XML/NF-e antes de lançar no estoque.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold">Rascunhos</h2>
          </div>

          {loading && (
            <div className="p-4 text-sm text-muted-foreground">
              Carregando rascunhos...
            </div>
          )}

          {!loading && drafts.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              Nenhum rascunho encontrado.
            </div>
          )}

          <div className="divide-y">
            {drafts.map((draft) => (
              <button
                key={draft.id}
                type="button"
                onClick={() => setSelectedDraft(draft)}
                className={`w-full text-left p-4 hover:bg-muted transition ${
                  selectedDraft?.id === draft.id ? "bg-muted" : ""
                }`}
              >
                <div className="font-medium text-sm">
                  {draft.name}
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  NF {draft.data?.invoice_number || "—"} • {formatCurrency(getDraftTotal(draft))}
                </div>

                <div className="text-xs text-muted-foreground mt-1">
                  Atualizado em {formatDate(draft.updated_at)}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="border rounded-xl bg-card overflow-hidden">
          {!selectedDraft && (
            <div className="p-6 text-sm text-muted-foreground">
              Selecione um rascunho para revisar.
            </div>
          )}

          {selectedDraft && (
            <div className="space-y-0">
              <div className="p-6 border-b flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold">
                    {selectedDraft.name}
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    Fornecedor: {selectedDraft.data?.supplier_name || "—"}
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Total</div>
                  <div className="text-lg font-bold">
                    {formatCurrency(selectedTotal)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 border-b text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Número</div>
                  <div className="font-medium">{selectedDraft.data?.invoice_number || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Série</div>
                  <div className="font-medium">{selectedDraft.data?.invoice_series || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Emissão</div>
                  <div className="font-medium">{formatDate(selectedDraft.data?.issue_date)}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Entrada</div>
                  <div className="font-medium">{formatDate(selectedDraft.data?.entry_date)}</div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/40">
                    <tr>
                      <th className="text-left p-3">Produto</th>
                      <th className="text-right p-3">Qtd</th>
                      <th className="text-left p-3">Un.</th>
                      <th className="text-right p-3">Custo unit.</th>
                      <th className="text-right p-3">Total</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    {(selectedDraft.data?.items ?? []).map((item, index) => (
                      <tr key={`${item.product_id}-${index}`}>
                        <td className="p-3">
                          {item.product_name_snapshot}
                        </td>
                        <td className="p-3 text-right">
                          {Number(item.quantity || 0)}
                        </td>
                        <td className="p-3">
                          {item.unit_label}
                        </td>
                        <td className="p-3 text-right">
                          {formatCurrency(Number(item.unit_cost || 0))}
                        </td>
                        <td className="p-3 text-right">
                          {formatCurrency(Number(item.total_cost || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-6 border-t flex flex-wrap gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => handleDeleteDraft(selectedDraft)}
                  disabled={isPending || processingDraftId === selectedDraft.id}
                  className="border rounded-md px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
                >
                  Excluir rascunho
                </button>

                <button
                  type="button"
                  onClick={() => handleApproveDraft(selectedDraft)}
                  disabled={isPending || processingDraftId === selectedDraft.id}
                  className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
                >
                  {processingDraftId === selectedDraft.id
                    ? "Processando..."
                    : "Confirmar entrada no estoque"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
