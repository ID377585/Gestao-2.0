"use client";

import { FormEvent, useMemo, useState } from "react";
import { ArrowRight, Mail, MessageCircle } from "lucide-react";

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

type DemoRequestFormProps = {
  whatsappUrl?: string | null;
};

export function DemoRequestForm({ whatsappUrl }: DemoRequestFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    whatsapp: "",
    establishment: "",
    businessType: businessTypes[0],
    need: needs[0],
    message: "",
  });

  const mailtoHref = useMemo(() => {
    const subject = encodeURIComponent("Solicitacao de demonstracao - Gestify");
    const body = encodeURIComponent(
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
      ].join("\n")
    );

    return `mailto:suporte@gestify.app?subject=${subject}&body=${body}`;
  }, [form]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    window.location.href = mailtoHref;
  }

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

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          className="bg-[#D8A640] text-[#17212B] hover:bg-[#E8BD5C]"
        >
          Solicitar demonstracao
          <ArrowRight className="size-4" />
        </Button>
        <Button asChild variant="outline">
          <a href={whatsappUrl || mailtoHref}>
            {whatsappUrl ? (
              <MessageCircle className="size-4" />
            ) : (
              <Mail className="size-4" />
            )}
            {whatsappUrl ? "Falar pelo WhatsApp" : "Enviar por e-mail"}
          </a>
        </Button>
      </div>

      {submitted ? (
        <p className="mt-4 rounded-md bg-[#F7F8FA] px-4 py-3 text-sm font-semibold text-[#313A46]">
          Abrimos seu aplicativo de e-mail com a solicitacao preenchida.
        </p>
      ) : null}
    </form>
  );
}
