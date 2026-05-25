"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clipboard, Loader2, X } from "lucide-react";

type CompanyRowActionsProps = {
  establishmentId: string;
  isCurrent: boolean;
  companyName: string;
};

export function CompanyRowActions({
  establishmentId,
  isCurrent,
  companyName,
}: CompanyRowActionsProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [confirmingSwitch, setConfirmingSwitch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleCopyId() {
    setError(null);

    try {
      await navigator.clipboard.writeText(establishmentId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Não foi possível copiar o ID.");
    }
  }

  function handleRequestSwitch() {
    if (isCurrent || isPending) return;
    setError(null);
    setConfirmingSwitch(true);
  }

  function handleCancelSwitch() {
    if (isPending) return;
    setConfirmingSwitch(false);
  }

  function handleConfirmSwitchTenant() {
    if (isCurrent || isPending) return;

    setError(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/tenant/switch", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ establishmentId }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível trocar a empresa ativa.");
        }

        router.refresh();
        window.location.assign("/dashboard/admin/empresas");
      } catch (err: any) {
        setError(err?.message ?? "Não foi possível trocar a empresa ativa.");
        setConfirmingSwitch(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 xl:items-end">
      <div className="flex flex-wrap gap-2 xl:justify-end">
        <button
          type="button"
          onClick={handleCopyId}
          aria-label={`Copiar ID da empresa ${companyName}`}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900 dark:focus:ring-blue-950"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          {copied ? "ID copiado" : "Copiar ID"}
        </button>

        <button
          type="button"
          onClick={handleRequestSwitch}
          disabled={isCurrent || isPending}
          aria-label={isCurrent ? `${companyName} já está em uso` : `Usar ${companyName} como empresa ativa`}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isCurrent ? "Empresa em uso" : "Usar esta empresa"}
        </button>
      </div>

      {confirmingSwitch ? (
        <div className="w-full max-w-sm rounded-xl border border-amber-200 bg-amber-50 p-3 text-left text-xs text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 xl:text-right">
          <div className="flex items-start gap-2 xl:justify-end">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Trocar para <span className="font-semibold">{companyName}</span>? O contexto do dashboard será atualizado para esta empresa.
            </p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 xl:justify-end">
            <button
              type="button"
              onClick={handleCancelSwitch}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 px-2.5 py-1.5 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950"
            >
              <X className="h-3.5 w-3.5" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmSwitchTenant}
              disabled={isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-700 px-2.5 py-1.5 font-semibold text-white hover:bg-amber-800 disabled:opacity-60"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Confirmar troca
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className="max-w-xs text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
