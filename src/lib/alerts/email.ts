import "server-only";

export type AlertEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type AlertEmailResult = {
  ok: boolean;
  skipped?: boolean;
  id?: string | null;
  error?: string | null;
};

const RESEND_API_URL = "https://api.resend.com/emails";
const RESEND_TIMEOUT_MS = 8_000;

function stripHtml(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function buildAlertEmailHtml(params: {
  recipientName?: string | null;
  titulo: string;
  mensagem: string;
  href?: string | null;
}) {
  const saudacao = params.recipientName?.trim()
    ? `Olá, ${params.recipientName.trim()}.`
    : "Olá,";

  const linkHtml = params.href
    ? `<p style="margin-top:16px;"><a href="${params.href}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;">Abrir no sistema</a></p>`
    : "";

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;">
      <p>${saudacao}</p>
      <h2 style="margin:0 0 12px 0;">${params.titulo}</h2>
      <p style="margin:0 0 12px 0;">${params.mensagem}</p>
      ${linkHtml}
      <p style="margin-top:24px;font-size:12px;color:#6b7280;">
        Este é um alerta automático do Gestify.
      </p>
    </div>
  `.trim();
}

export async function sendAlertEmail(
  input: AlertEmailInput
): Promise<AlertEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.ALERTS_FROM_EMAIL?.trim() ||
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "";

  if (!apiKey || !from) {
    return {
      ok: false,
      skipped: true,
      error:
        "RESEND_API_KEY ou ALERTS_FROM_EMAIL/RESEND_FROM_EMAIL não configurado.",
    };
  }

  if (!input.to?.trim()) {
    return {
      ok: false,
      skipped: true,
      error: "Destinatário de e-mail vazio.",
    };
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to.trim()],
        subject: input.subject,
        html: input.html,
        text: input.text?.trim() || stripHtml(input.html),
      }),
      signal: AbortSignal.timeout(RESEND_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        error: errorText || "Falha ao enviar e-mail pelo Resend.",
      };
    }

    const data = (await response.json()) as { id?: string | null };

    return {
      ok: true,
      id: data?.id ?? null,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : null;
    return {
      ok: false,
      error: message ?? "Erro inesperado ao enviar e-mail.",
    };
  }
}
