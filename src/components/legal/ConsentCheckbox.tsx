"use client";

import type { CheckedState } from "@radix-ui/react-checkbox";
import Link from "next/link";

import { CURRENT_TERMS_DOCUMENT_TITLE } from "@/lib/auth/terms-config";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type SecondaryConsent = {
  id?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  label?: string;
  description?: string;
};

type ConsentCheckboxProps = {
  id?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  helperText?: string;
  secondaryConsent?: SecondaryConsent;
};

function toBoolean(checked: CheckedState) {
  return checked === true;
}

const legalLinks = [
  ["/termos-de-uso", CURRENT_TERMS_DOCUMENT_TITLE],
  ["/politica-de-privacidade", "Política de Privacidade"],
  ["/politica-de-cookies", "Política de Cookies"],
  ["/governanca-e-protecao-de-dados", "Governança e Proteção de Dados"],
  ["/seguranca-da-informacao", "Segurança da Informação"],
  ["/dpa", "DPA / Tratamento de Dados"],
] as const;

export function ConsentCheckbox({
  id = "legal-consent",
  value,
  onChange,
  error,
  required = true,
  disabled = false,
  className,
  helperText = "Este aceite é obrigatório quando o acesso depende da versão jurídica vigente.",
  secondaryConsent,
}: ConsentCheckboxProps) {
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy = [helperId, error ? errorId : null].filter(Boolean).join(" ");

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={value}
          onCheckedChange={(checked) => onChange(toBoolean(checked))}
          aria-describedby={describedBy || undefined}
          aria-invalid={Boolean(error)}
          required={required}
          disabled={disabled}
          className="mt-0.5"
        />

        <div className="space-y-2">
          <Label htmlFor={id} className="cursor-pointer text-sm font-medium leading-6 text-slate-800">
            Declaro que li, estou ciente e aceito integralmente os termos, regras e políticas vigentes da Gestify aplicáveis ao uso da plataforma.
          </Label>
          <p className="text-xs leading-5 text-slate-600">
            Documentos integrantes: {legalLinks.map(([href, label], index) => (
              <span key={href}>
                {index > 0 ? ", " : ""}
                <Link href={href} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline underline-offset-4 hover:text-blue-800">
                  {label}
                </Link>
              </span>
            ))}.
          </p>
          <p id={helperId} className="text-xs leading-5 text-slate-500">{helperText}</p>
        </div>
      </div>

      {secondaryConsent ? (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Checkbox
            id={secondaryConsent.id || `${id}-marketing`}
            checked={secondaryConsent.value}
            onCheckedChange={(checked) => secondaryConsent.onChange(toBoolean(checked))}
            disabled={disabled}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <Label htmlFor={secondaryConsent.id || `${id}-marketing`} className="cursor-pointer text-sm font-medium leading-6 text-slate-700">
              {secondaryConsent.label || "Aceito receber comunicações comerciais e institucionais da Gestify."}
            </Label>
            {secondaryConsent.description ? <p className="text-xs leading-5 text-slate-500">{secondaryConsent.description}</p> : null}
          </div>
        </div>
      ) : null}

      {error ? <p id={errorId} className="text-sm font-medium text-red-600">{error}</p> : null}
    </div>
  );
}
