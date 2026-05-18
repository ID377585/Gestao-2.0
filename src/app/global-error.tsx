"use client";

import { useEffect } from "react";

type GlobalErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Erro global capturado:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-12 text-white">
          <section className="w-full max-w-lg rounded-2xl border border-white/10 bg-white/10 p-8 text-center shadow-xl">
            <p className="text-sm font-medium uppercase tracking-wide text-red-300">
              Erro crítico
            </p>
            <h1 className="mt-3 text-2xl font-semibold">A Gestify encontrou um problema.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              Atualize a página ou tente novamente. O detalhe técnico foi registrado nos logs.
            </p>
            {error.digest ? (
              <p className="mt-4 rounded-lg bg-black/30 px-3 py-2 font-mono text-xs text-slate-200">
                Código: {error.digest}
              </p>
            ) : null}
            <button
              type="button"
              onClick={reset}
              className="mt-6 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-slate-200"
            >
              Tentar novamente
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
