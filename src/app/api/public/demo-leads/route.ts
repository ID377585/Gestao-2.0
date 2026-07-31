import { createHash } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { sendAlertEmail } from "@/lib/alerts/email";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const gestifyWhatsappNumber = "5511986754605";
const gestifyLeadEmail = "id377585@gmail.com";

const demoLeadSchema = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(254),
  whatsapp: z.string().trim().min(8).max(32),
  establishment: z.string().trim().min(2).max(180),
  businessType: z.string().trim().min(2).max(80),
  need: z.string().trim().min(2).max(120),
  message: z.string().trim().max(2000).optional().default(""),
  contactPreference: z.enum(["whatsapp", "email"]).default("whatsapp"),
  consentTerms: z.boolean().refine((value) => value === true),
  consentMarketing: z.boolean().optional().default(false),
});

function getRequestIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() || "unknown";

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function hashIp(ip: string) {
  const salt = process.env.LEAD_IP_HASH_SALT || process.env.CRON_SECRET || "gestify";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function buildLeadMessage(lead: z.infer<typeof demoLeadSchema>) {
  return [
    "Ola, equipe Gestify.",
    "",
    "Gostaria de solicitar uma demonstracao da plataforma.",
    "",
    `Nome: ${lead.name}`,
    `Email: ${lead.email}`,
    `WhatsApp: ${lead.whatsapp}`,
    `Estabelecimento: ${lead.establishment}`,
    `Tipo de negocio: ${lead.businessType}`,
    `Principal necessidade: ${lead.need}`,
    "",
    "Mensagem:",
    lead.message || "-",
  ].join("\n");
}

function buildContactLinks(lead: z.infer<typeof demoLeadSchema>) {
  const message = buildLeadMessage(lead);
  const subject = encodeURIComponent("Solicitacao de demonstracao - Gestify");
  const body = encodeURIComponent(message);
  const text = encodeURIComponent(message);

  return {
    whatsappUrl: `https://wa.me/${gestifyWhatsappNumber}?text=${text}`,
    mailtoHref: `mailto:${gestifyLeadEmail}?subject=${subject}&body=${body}`,
  };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildLeadEmailHtml(lead: z.infer<typeof demoLeadSchema>) {
  const rows = [
    ["Nome", lead.name],
    ["Email", lead.email],
    ["WhatsApp", lead.whatsapp],
    ["Estabelecimento", lead.establishment],
    ["Tipo de negocio", lead.businessType],
    ["Principal necessidade", lead.need],
    ["Preferencia de contato", lead.contactPreference],
    ["Aceite comercial", lead.consentMarketing ? "Sim" : "Não"],
  ];

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.5;">
      <h2 style="margin:0 0 16px 0;">Nova solicitação de demonstração - Gestify</h2>
      <table style="border-collapse:collapse;width:100%;max-width:680px;">
        <tbody>
          ${rows
            .map(
              ([label, value]) => `
                <tr>
                  <th style="border:1px solid #e5e7eb;padding:8px;text-align:left;background:#f9fafb;">${escapeHtml(
                    label
                  )}</th>
                  <td style="border:1px solid #e5e7eb;padding:8px;">${escapeHtml(
                    value
                  )}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
      <h3 style="margin:20px 0 8px 0;">Mensagem</h3>
      <p style="white-space:pre-wrap;margin:0;">${escapeHtml(lead.message || "-")}</p>
    </div>
  `.trim();
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  const limitedByIp = rateLimit(request, {
    key: "public-demo-leads:ip",
    limit: 8,
    windowMs: 60 * 60_000,
    identifier: ip,
  });
  if (limitedByIp) return limitedByIp;

  let json: unknown;

  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Dados inválidos para solicitar demonstração." },
      { status: 400 }
    );
  }

  const parsed = demoLeadSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Revise os dados informados e aceite os termos para continuar.",
      },
      { status: 400 }
    );
  }

  const lead = parsed.data;
  const leadIdentifier = `${lead.email.toLowerCase()}:${lead.whatsapp.replace(
    /\D/g,
    ""
  )}`;
  const limitedByLead = rateLimit(request, {
    key: "public-demo-leads:lead",
    limit: 3,
    windowMs: 24 * 60 * 60_000,
    identifier: leadIdentifier,
  });
  if (limitedByLead) return limitedByLead;

  const links = buildContactLinks(lead);
  let supabaseAdmin: ReturnType<typeof getSupabaseAdminClient>;

  try {
    supabaseAdmin = getSupabaseAdminClient();
  } catch (error) {
    console.error("[demo-leads] admin client error:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          "O canal direto foi preparado, mas o registro interno de leads ainda não está configurado.",
        ...links,
      },
      { status: 503 }
    );
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;

  const { error } = await supabaseAdmin.from("demo_leads").insert({
    name: lead.name,
    email: lead.email.toLowerCase(),
    whatsapp: lead.whatsapp,
    establishment_name: lead.establishment,
    business_type: lead.businessType,
    need: lead.need,
    message: lead.message || null,
    contact_preference: lead.contactPreference,
    consent_terms: lead.consentTerms,
    consent_marketing: lead.consentMarketing,
    source: "site_publico",
    user_agent: userAgent,
    ip_hash: hashIp(ip),
  });

  if (error) {
    console.error("[demo-leads] insert error:", {
      code: (error as any)?.code,
      message: error.message,
    });

    return NextResponse.json(
      {
        ok: false,
        error:
          "Não foi possível registrar sua solicitação agora. Você ainda pode falar com a Gestify pelo WhatsApp ou e-mail.",
        ...links,
      },
      { status: 503 }
    );
  }

  const emailResult = await sendAlertEmail({
    to: gestifyLeadEmail,
    subject: `Nova demonstração Gestify - ${lead.establishment}`,
    html: buildLeadEmailHtml(lead),
    text: buildLeadMessage(lead),
  });

  if (!emailResult.ok) {
    console.warn("[demo-leads] email skipped:", emailResult.error);
  }

  return NextResponse.json({ ok: true, ...links }, { status: 201 });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Método não permitido. Use POST." },
    {
      status: 405,
      headers: { Allow: "POST" },
    }
  );
}
