"use client";

import { useEffect, useState } from "react";
import { listFiscalNfeInboxAction } from "../actions";

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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Notas disponíveis
        </h1>

        <p className="text-sm text-muted-foreground">
          NF-e sincronizadas da SEFAZ.
        </p>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card">

        <div className="grid grid-cols-7 gap-4 p-4 border-b text-sm font-medium">
          <div>Número</div>
          <div>Série</div>
          <div>Fornecedor</div>
          <div>Emissão</div>
          <div>Total</div>
          <div>Status</div>
          <div>Entrada</div>
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
              className="grid grid-cols-7 gap-4 p-4 text-sm items-center"
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
