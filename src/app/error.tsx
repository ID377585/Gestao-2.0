"use client";

import { useEffect } from "react";

type AppErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AppError({ error, reset }: AppErrorProps) {
  useEffect(() => {
    console.error("Erro capturado pela boundary da aplicação:", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-900">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-red-600">
          Instabilidade temporária
        </p>
        <h1 className="mt-3 text-2xl font-semibold">Não foi possível carregar esta tela.</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Tente novamente. Se o problema continuar, envie o código de referência para o suporte técnico.
        </p>
        {error.digest ? (
          <p className="mt-4 rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-slate-600">
            Código: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
