"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createInvoiceEntryDraftFromFiscalNfeAction,
  importFiscalNfeXmlAction,
  listFiscalNfeInboxAction,
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

export default function FiscalNfeInboxPage() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [draftingNoteId, setDraftingNoteId] = useState<string | null>(null);

  const loadNotes = async () => {
    try {
      setLoading(true);

      const data = await listFiscalNfeInboxAction();

      setNotes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotes();
  }, []);

  const handleXmlImport = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const formData = new FormData();

    formData.append("file", file);

    startTransition(async () => {
      try {
        await importFiscalNfeXmlAction(formData);

        await loadNotes();

        alert("NF-e importada com sucesso.");
      } catch (error: any) {
        console.error(error);

        alert(error?.message || "Erro ao importar XML.");
      } finally {
        event.target.value = "";
      }
    });
  };

  const handleCreateDraft = async (noteId: string) => {
    setDraftingNoteId(noteId);

    startTransition(async () => {
      try {
        await createInvoiceEntryDraftFromFiscalNfeAction(noteId);

        await loadNotes();

        alert(
          "Rascunho de entrada criado com sucesso. Acesse Entradas para revisar e confirmar."
        );
      } catch (error: any) {
        console.error(error);

        alert(error?.message || "Erro ao gerar rascunho de entrada.");
      } finally {
        setDraftingNoteId(null);
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Notas disponíveis
          </h1>

          <p className="text-sm text-muted-foreground">
            NF-e sincronizadas da SEFAZ.
          </p>
        </div>

        <div>
          <label className="bg-primary text-primary-foreground px-4 py-2 rounded-md cursor-pointer text-sm inline-flex">
            {isPending ? "Processando..." : "Importar XML NF-e"}

            <input
              type="file"
              accept=".xml"
              className="hidden"
              onChange={handleXmlImport}
            />
          </label>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">

        <div className="grid grid-cols-8 gap-4 p-4 border-b text-sm font-medium">
          <div>Número</div>
          <div>Série</div>
          <div>Fornecedor</div>
          <div>Emissão</div>
          <div>Total</div>
          <div>Status</div>
          <div>Entrada</div>
          <div>Ações</div>
        </div>

        {loading && (
          <div className="p-4 text-sm text-muted-foreground">
            Carregando notas...
          </div>
        )}

        {!loading && notes.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            Nenhuma NF-e encontrada.
          </div>
        )}

        <div className="divide-y">
          {notes.map((note) => (
            <div
              key={note.id}
              className="grid grid-cols-8 gap-4 p-4 text-sm items-center"
            >
              <div>{note.numero || "—"}</div>

              <div>{note.serie || "—"}</div>

              <div>{note.fornecedor_nome || "—"}</div>

              <div>{formatDate(note.data_emissao)}</div>

              <div>
                {formatCurrency(Number(note.valor_total || 0))}
              </div>

              <div>
                {note.status_manifestacao || "pendente"}
              </div>

              <div>
                {note.imported_entry_id
                  ? "Importada"
                  : "Pendente"}
              </div>

              <div>
                {!note.imported_entry_id && (
                  <button
                    type="button"
                    onClick={() => handleCreateDraft(String(note.id))}
                    disabled={isPending || draftingNoteId === note.id}
                    className="border rounded-md px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    {draftingNoteId === note.id
                      ? "Gerando..."
                      : "Gerar rascunho"}
                  </button>
                )}

                {note.imported_entry_id && (
                  <span className="text-xs text-muted-foreground">
                    Já importada
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
