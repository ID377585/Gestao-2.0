"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importTechnicalSheetsFromPdfAction } from "../actions";

type ImportResult =
  | {
      ok: true;
      importedCount: number;
      recipes: Array<{ id: string; name: string; page: number | null }>;
      ignoredPages: Array<{ page: number; title: string; reason: string }>;
    }
  | {
      ok: false;
      error: string;
    };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (result: Extract<ImportResult, { ok: true }>) => void;
};

export default function PdfImportModal({
  open,
  onOpenChange,
  onImported,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [defaultCategory, setDefaultCategory] = useState("Importado PDF");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [ignoredPages, setIgnoredPages] = useState<
    Array<{ page: number; title: string; reason: string }>
  >([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function resetState() {
    setSelectedFile(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIgnoredPages([]);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetState();
    }
    onOpenChange(nextOpen);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setErrorMessage(null);
    setSuccessMessage(null);
    setIgnoredPages([]);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      setSelectedFile(null);
      setErrorMessage("Selecione um arquivo PDF válido.");
      return;
    }

    const maxPdfSizeInBytes = 40 * 1024 * 1024;
    if (file.size > maxPdfSizeInBytes) {
      setSelectedFile(null);
      setErrorMessage("O PDF deve ter no máximo 40 MB.");
      return;
    }

    setSelectedFile(file);
  }

  function handleImport() {
    if (!selectedFile) {
      setErrorMessage("Selecione um arquivo PDF antes de importar.");
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);
    setIgnoredPages([]);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("defaultCategory", defaultCategory);

        const result = (await importTechnicalSheetsFromPdfAction(
          formData
        )) as ImportResult | null | undefined;

        if (!result || typeof result !== "object" || !("ok" in result)) {
          setErrorMessage(
            "A importação retornou uma resposta inválida. Verifique a action do servidor."
          );
          return;
        }

        if (!result.ok) {
          setErrorMessage(result.error || "Erro ao importar o PDF.");
          return;
        }

        setSuccessMessage(
          `${result.importedCount} ficha(s) técnica(s) importada(s) com sucesso.`
        );
        setIgnoredPages(result.ignoredPages ?? []);

        if (onImported) {
          onImported(result);
        }
      } catch (error: any) {
        console.error("[PdfImportModal] erro ao importar PDF", error);
        setErrorMessage(
          error?.message || "Erro inesperado ao importar o PDF."
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Importar Ficha Técnica</DialogTitle>
          <DialogDescription>
            Envie um PDF de até 40 MB para importar várias fichas de uma vez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="defaultCategory">Categoria padrão</Label>
            <Input
              id="defaultCategory"
              value={defaultCategory}
              onChange={(e) => setDefaultCategory(e.target.value)}
              placeholder="Importado PDF"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdfFile">PDF</Label>
            <Input
              id="pdfFile"
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
            />
            <p className="text-sm text-muted-foreground">Limite máximo: 40 MB</p>
          </div>

          {selectedFile ? (
            <div className="rounded-xl border p-4 text-sm">
              <div>
                <strong>Arquivo:</strong> {selectedFile.name}
              </div>
              <div>
                <strong>Tamanho:</strong>{" "}
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-700">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="rounded-xl border border-green-300 bg-green-50 p-4 text-green-700">
              {successMessage}
            </div>
          ) : null}

          {ignoredPages.length > 0 ? (
            <div className="rounded-xl border p-4">
              <div className="mb-2 font-semibold">Páginas ignoradas</div>
              <div className="max-h-56 space-y-2 overflow-auto text-sm">
                {ignoredPages.map((item, index) => (
                  <div
                    key={`${item.page}-${item.title}-${index}`}
                    className="rounded-lg border p-2"
                  >
                    <div>
                      <strong>Página {item.page}</strong> — {item.title}
                    </div>
                    <div className="text-muted-foreground">{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Nesta etapa, o sistema lê o PDF, importa as páginas válidas e ignora
            automaticamente páginas incompletas ou template.
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleImport}
              disabled={isPending || !selectedFile}
            >
              {isPending ? "Importando..." : "Importar PDF"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}