"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro capturado pela boundary da aplicação.", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-6 py-12 text-gray-900 dark:bg-slate-950 dark:text-slate-100">
      <section className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
          Erro inesperado
        </p>
        <h1 className="mt-3 text-2xl font-bold">Não foi possível carregar esta tela.</h1>
        <p className="mt-4 text-sm text-gray-600 dark:text-slate-300">
          Tente novamente. Se o problema continuar, verifique os logs do deploy para localizar a causa exata.
        </p>
        {error.digest ? (
          <p className="mt-3 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-600 dark:bg-slate-800 dark:text-slate-300">
            Código do erro: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
        >
          Tentar novamente
        </button>
      </section>
    </main>
  );
}
