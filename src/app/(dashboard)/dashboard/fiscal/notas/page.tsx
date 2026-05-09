"use client";

import { useEffect, useState, useTransition } from "react";
import {
  createInvoiceEntryDraftFromFiscalNfeAction,
  importFiscalNfeXmlAction,
  listFiscalNfeInboxAction,
  syncSefazNfeAction,
} from "../actions";
import { manifestFiscalNfeAction } from "../manifestacao/actions";

type ManifestationType =
  | "ciencia_operacao"
  | "confirmacao_operacao"
  | "desconhecimento_operacao"
  | "operacao_nao_realizada";

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

function getManifestationLabel(type: ManifestationType) {
  const labels: Record<ManifestationType, string> = {
    ciencia_operacao: "Ciência",
    confirmacao_operacao: "Confirmar",
    desconhecimento_operacao: "Desconhecer",
    operacao_nao_realizada: "Não realizada",
  };

  return labels[type];
}

export default function FiscalNfeInboxPage() {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [draftingNoteId, setDraftingNoteId] = useState<string | null>(null);
  const [manifestingNoteId, setManifestingNoteId] = useState<string | null>(null);
  const [syncingSefaz, setSyncingSefaz] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<any | null>(null);

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

  const handleSyncSefaz = async () => {
    setSyncingSefaz(true);
    setLastSyncResult(null);

    startTransition(async () => {
      try {
        const result = await syncSefazNfeAction();

        setLastSyncResult(result);

        await loadNotes();

        alert(
          `Sincronização concluída. Recebidos: ${result.received}. Importados: ${result.imported}. Ignorados: ${result.ignored}. Status SEFAZ: ${result.cStat} - ${result.xMotivo}`
        );
      } catch (error: any) {
        console.error(error);

        alert(error?.message || "Erro ao sincronizar SEFAZ.");
      } finally {
        setSyncingSefaz(false);
      }
    });
  };

  const handleManifest = async (
    noteId: string,
    type: ManifestationType
  ) => {
    let justification: string | null = null;

    if (type === "operacao_nao_realizada") {
      justification = window.prompt(
        "Informe a justificativa da operação não realizada com pelo menos 15 caracteres:"
      );

      if (!justification) return;
    }

    const confirmed = window.confirm(
      `Enviar evento de manifestação: ${getManifestationLabel(type)}?`
    );

    if (!confirmed) return;

    setManifestingNoteId(noteId);

    startTransition(async () => {
      try {
        const result = await manifestFiscalNfeAction({
          noteId,
          manifestationType: type,
          justification,
        });

        await loadNotes();

        alert(
          `Manifestação enviada. Status SEFAZ: ${result.cStat} - ${result.xMotivo}`
        );
      } catch (error: any) {
        console.error(error);
        alert(error?.message || "Erro ao manifestar NF-e.");
      } finally {
        setManifestingNoteId(null);
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

        <div className="flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={handleSyncSefaz}
            disabled={isPending || syncingSefaz}
            className="border rounded-md px-4 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            {syncingSefaz ? "Sincronizando..." : "Sincronizar SEFAZ"}
          </button>

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

      {lastSyncResult && (
        <div className="border rounded-xl p-4 bg-card text-sm grid grid-cols-2 md:grid-cols-5 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <div className="font-medium">{lastSyncResult.cStat}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Motivo</div>
            <div className="font-medium">{lastSyncResult.xMotivo}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Recebidos</div>
            <div className="font-medium">{lastSyncResult.received}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Importados</div>
            <div className="font-medium">{lastSyncResult.imported}</div>
          </div>

          <div>
            <div className="text-xs text-muted-foreground">Último NSU</div>
            <div className="font-medium">{lastSyncResult.ultNSU}</div>
          </div>
        </div>
      )}

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

              <div className="flex flex-col gap-1 items-start">
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => handleManifest(String(note.id), "ciencia_operacao")}
                    disabled={isPending || manifestingNoteId === note.id}
                    className="border rounded-md px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
                  >
                    Ciência
                  </button>

                  <button
                    type="button"
                    onClick={() => handleManifest(String(note.id), "confirmacao_operacao")}
                    disabled={isPending || manifestingNoteId === note.id}
                    className="border rounded-md px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
                  >
                    Confirmar
                  </button>
                </div>

                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => handleManifest(String(note.id), "desconhecimento_operacao")}
                    disabled={isPending || manifestingNoteId === note.id}
                    className="border rounded-md px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
                  >
                    Desconhecer
                  </button>

                  <button
                    type="button"
                    onClick={() => handleManifest(String(note.id), "operacao_nao_realizada")}
                    disabled={isPending || manifestingNoteId === note.id}
                    className="border rounded-md px-2 py-1 text-[11px] hover:bg-muted disabled:opacity-50"
                  >
                    Não realizada
                  </button>
                </div>

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
