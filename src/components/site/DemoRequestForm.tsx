"use client";

import { FormEvent, useMemo, useState } from "react";
import { Loader2, Mail, MessageCircle } from "lucide-react";

import { ConsentCheckbox } from "@/components/legal/ConsentCheckbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const businessTypes = [
  "Restaurante",
  "Bar",
  "Confeitaria",
  "Padaria",
  "Cozinha central",
  "Delivery",
  "Outro",
];

const needs = [
  "Controle de estoque",
  "Fichas tecnicas e CMV",
  "Compras e fornecedores",
  "Producao e etiquetas",
  "Financeiro e indicadores",
  "Quero conhecer a plataforma completa",
];

const gestifyWhatsappNumber = "5511986754605";
const gestifyLeadEmail = "id377585@gmail.com";

type ContactPreference = "whatsapp" | "email";

export function DemoRequestForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittingPreference, setSubmittingPreference] =
    useState<ContactPreference | null>(null);
  const [consentTerms, setConsentTerms] = useState(false);
  const [consentMarketing, setConsentMarketing] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    establishment: "",
    businessType: businessTypes[0],
    need: needs[0],
    message: "",
  });

  const leadMessage = useMemo(
    () =>
      [
        "Ola, equipe Gestify.",
        "",
        "Gostaria de solicitar uma demonstracao da plataforma.",
        "",
        `Nome: ${form.name}`,
        `Email: ${form.email}`,
        `WhatsApp: ${form.whatsapp}`,
        `Estabelecimento: ${form.establishment}`,
        `Tipo de negocio: ${form.businessType}`,
        `Principal necessidade: ${form.need}`,
        "",
        "Mensagem:",
        form.message || "-",
      ].join("\n"),
    [form]
  );

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent("Solicitacao de demonstracao - Gestify");
    const body = encodeURIComponent(leadMessage);

    return `mailto:${gestifyLeadEmail}?subject=${subject}&body=${body}`;
  }, [leadMessage]);

  const whatsappHref = useMemo(() => {
    const text = encodeURIComponent(leadMessage);

    return `https://wa.me/${gestifyWhatsappNumber}?text=${text}`;
  }, [leadMessage]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitLead(contactPreference: ContactPreference) {
    if (!consentTerms) {
      setSubmitError(
        "Aceite os termos e a política de privacidade para solicitar a demonstração."
      );
      return;
    }

    setSubmitError(null);
    setSubmitted(false);
    setSubmittingPreference(contactPreference);

    try {
      const response = await fetch("/api/public/demo-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          contactPreference,
          consentTerms,
          consentMarketing,
        }),
      });
      const result = await response.json().catch(() => null);

      const nextWhatsappHref =
        typeof result?.whatsappUrl === "string" ? result.whatsappUrl : whatsappHref;
      const nextMailtoHref =
        typeof result?.mailtoHref === "string" ? result.mailtoHref : mailtoHref;

      if (!response.ok || !result?.ok) {
        setSubmitError(
          result?.error ||
            "Não foi possível registrar sua solicitação agora. Vamos abrir o contato direto mesmo assim."
        );
      }

      if (contactPreference === "whatsapp") {
        window.open(nextWhatsappHref, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = nextMailtoHref;
      }

      setSubmitted(Boolean(response.ok && result?.ok));
    } catch {
      setSubmitError(
        "Não foi possível registrar sua solicitação agora. Vamos abrir o WhatsApp com os dados preenchidos."
      );

      if (contactPreference === "whatsapp") {
        window.open(whatsappHref, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = mailtoHref;
      }
    } finally {
      setSubmittingPreference(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submitLead("whatsapp");
  }

  const isSubmitting = submittingPreference !== null;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-[#E2E6EA] bg-white p-6 shadow-[0_8px_24px_rgba(23,33,43,0.05)]"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2">
          <Label htmlFor="demo-name">Nome</Label>
          <Input
            id="demo-name"
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </label>

        <label className="space-y-2">
          <Label htmlFor="demo-email">Email</Label>
          <Input
            id="demo-email"
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            required
          />
        </label>

        <label className="space-y-2">
          <Label htmlFor="demo-whatsapp">WhatsApp</Label>
          <Input
            id="demo-whatsapp"
            type="tel"
            autoComplete="tel"
            value={form.whatsapp}
            onChange={(event) => updateField("whatsapp", event.target.value)}
            required
          />
        </label>

        <label className="space-y-2">
          <Label htmlFor="demo-establishment">Nome do estabelecimento</Label>
          <Input
            id="demo-establishment"
            value={form.establishment}
            onChange={(event) =>
              updateField("establishment", event.target.value)
            }
            required
          />
        </label>

        <label className="space-y-2">
          <Label htmlFor="demo-business-type">Tipo de negocio</Label>
          <select
            id="demo-business-type"
            value={form.businessType}
            onChange={(event) => updateField("businessType", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {businessTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <Label htmlFor="demo-need">Principal necessidade</Label>
          <select
            id="demo-need"
            value={form.need}
            onChange={(event) => updateField("need", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {needs.map((need) => (
              <option key={need} value={need}>
                {need}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="mt-4 block space-y-2">
        <Label htmlFor="demo-message">Mensagem</Label>
        <Textarea
          id="demo-message"
          value={form.message}
          onChange={(event) => updateField("message", event.target.value)}
          rows={5}
        />
      </label>

      <ConsentCheckbox
        id="demo-legal-consent"
        value={consentTerms}
        onChange={setConsentTerms}
        error={submitError && !consentTerms ? submitError : undefined}
        className="mt-5 rounded-lg border border-[#E2E6EA] bg-[#F7F8FA] p-4"
        helperText="Usaremos os dados enviados somente para registrar o interesse, entrar em contato sobre a demonstração e cumprir obrigações legais de privacidade."
        secondaryConsent={{
          id: "demo-marketing-consent",
          value: consentMarketing,
          onChange: setConsentMarketing,
          label: "Aceito receber comunicações comerciais da Gestify.",
          description:
            "Esse aceite é opcional e pode ser revogado a qualquer momento.",
        }}
      />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-[#D8A640] text-[#17212B] hover:bg-[#E8BD5C]"
        >
          {submittingPreference === "whatsapp" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <MessageCircle className="size-4" />
          )}
          {submittingPreference === "whatsapp"
            ? "Registrando..."
            : "Enviar pelo WhatsApp"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => void submitLead("email")}
        >
          {submittingPreference === "email" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Mail className="size-4" />
          )}
          {submittingPreference === "email" ? "Registrando..." : "Enviar por e-mail"}
        </Button>
      </div>

      {submitted ? (
        <p className="mt-4 rounded-md bg-[#F7F8FA] px-4 py-3 text-sm font-semibold text-[#313A46]">
          Solicitação registrada. Abrimos o canal escolhido com a mensagem preenchida.
        </p>
      ) : null}

      {submitError && consentTerms ? (
        <p
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
          aria-live="polite"
        >
          {submitError}
        </p>
      ) : null}
    </form>
  );
}
