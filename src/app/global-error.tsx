"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro global capturado pela aplicação.", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main>
          <h1>A aplicação não conseguiu iniciar corretamente.</h1>
          <p>
            Tente recarregar. Se continuar acontecendo, verifique as variáveis de ambiente e os logs da Vercel.
          </p>
          {error.digest ? <p>Código do erro: {error.digest}</p> : null}
          <button type="button" onClick={reset}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
