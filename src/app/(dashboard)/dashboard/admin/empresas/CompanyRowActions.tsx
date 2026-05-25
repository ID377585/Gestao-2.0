"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clipboard, Loader2 } from "lucide-react";

type CompanyRowActionsProps = {
  establishmentId: string;
  isCurrent: boolean;
};

export function CompanyRowActions({ establishmentId, isCurrent }: CompanyRowActionsProps) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
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

  function handleSwitchTenant() {
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
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 xl:items-end">
      <div className="flex flex-wrap gap-2 xl:justify-end">
        <button
          type="button"
          onClick={handleCopyId}
          className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          {copied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
          {copied ? "ID copiado" : "Copiar ID"}
        </button>

        <button
          type="button"
          onClick={handleSwitchTenant}
          disabled={isCurrent || isPending}
          className="inline-flex items-center gap-1 rounded-lg bg-blue-700 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 dark:disabled:bg-slate-800 dark:disabled:text-slate-400"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isCurrent ? "Empresa em uso" : "Usar esta empresa"}
        </button>
      </div>

      {error ? <p className="max-w-xs text-xs text-red-600 dark:text-red-300">{error}</p> : null}
    </div>
  );
}
