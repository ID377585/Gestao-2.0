"use client";

import { useEffect, useState, useTransition } from "react";
import {
  listFiscalCertificatesAction,
  uploadFiscalCertificateAction,
} from "../actions";

export default function FiscalCertificatePage() {
  const [isPending, startTransition] = useTransition();
  const [certificates, setCertificates] = useState<any[]>([]);

  const [cnpj, setCnpj] = useState("");
  const [password, setPassword] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const loadCertificates = async () => {
    try {
      const data = await listFiscalCertificatesAction();
      setCertificates(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadCertificates();
  }, []);

  const handleSubmit = async () => {
    if (!file) {
      alert("Selecione o certificado A1.");
      return;
    }

    const formData = new FormData();

    formData.append("file", file);
    formData.append("password", password);
    formData.append("cnpj", cnpj);

    startTransition(async () => {
      try {
        await uploadFiscalCertificateAction(formData);

        alert("Certificado enviado com sucesso.");

        setFile(null);
        setPassword("");

        await loadCertificates();
      } catch (error: any) {
        console.error(error);
        alert(error?.message ?? "Erro ao enviar certificado.");
      }
    });
  };

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Certificado Digital A1
        </h1>

        <p className="text-sm text-muted-foreground">
          Configure o certificado para sincronização automática
          de NF-e da SEFAZ.
        </p>
      </div>

      <div className="border rounded-xl p-6 space-y-4 bg-card">

        <div className="space-y-2">
          <label className="text-sm font-medium">
            CNPJ
          </label>

          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            placeholder="00.000.000/0000-00"
            className="w-full border rounded-md px-3 py-2 bg-background"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Senha do certificado
          </label>

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha do certificado"
            className="w-full border rounded-md px-3 py-2 bg-background"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Arquivo A1 (.pfx ou .p12)
          </label>

          <input
            type="file"
            accept=".pfx,.p12"
            onChange={(e) => {
              const selected = e.target.files?.[0];

              if (!selected) return;

              setFile(selected);
            }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={isPending}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md"
        >
          {isPending
            ? "Enviando..."
            : "Salvar certificado"}
        </button>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">
            Certificados cadastrados
          </h2>
        </div>

        <div className="divide-y">
          {certificates.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">
              Nenhum certificado cadastrado.
            </div>
          )}

          {certificates.map((certificate) => (
            <div
              key={certificate.id}
              className="p-4 flex items-center justify-between gap-4"
            >
              <div>
                <p className="font-medium">
                  {certificate.cnpj}
                </p>

                <p className="text-xs text-muted-foreground">
                  Status: {certificate.status}
                </p>
              </div>

              <div className="text-xs text-muted-foreground">
                {certificate.expires_at || "Sem validade detectada"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
