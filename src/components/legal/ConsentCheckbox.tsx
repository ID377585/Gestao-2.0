"use client";

import type { CheckedState } from "@radix-ui/react-checkbox";
import Link from "next/link";

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
  secondaryConsent?: SecondaryConsent;
};

function toBoolean(checked: CheckedState) {
  return checked === true;
}

export function ConsentCheckbox({
  id = "legal-consent",
  value,
  onChange,
  error,
  required = true,
  disabled = false,
  className,
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

        <div className="space-y-1">
          <Label
            htmlFor={id}
            className="cursor-pointer text-sm font-medium leading-6 text-slate-800"
          >
            Li e aceito os{" "}
            <Link
              href="/termos-de-uso"
              className="text-blue-700 underline underline-offset-4 transition hover:text-blue-800"
            >
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link
              href="/politica-de-privacidade"
              className="text-blue-700 underline underline-offset-4 transition hover:text-blue-800"
            >
              Política de Privacidade
            </Link>
            .
          </Label>

          <p id={helperId} className="text-xs leading-5 text-slate-500">
            Use este componente em formulários públicos que dependam de aceite
            contratual ou consentimento informado.
          </p>
        </div>
      </div>

      {secondaryConsent ? (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <Checkbox
            id={secondaryConsent.id || `${id}-marketing`}
            checked={secondaryConsent.value}
            onCheckedChange={(checked) =>
              secondaryConsent.onChange(toBoolean(checked))
            }
            disabled={disabled}
            className="mt-0.5"
          />

          <div className="space-y-1">
            <Label
              htmlFor={secondaryConsent.id || `${id}-marketing`}
              className="cursor-pointer text-sm font-medium leading-6 text-slate-700"
            >
              {secondaryConsent.label ||
                "Aceito receber comunicações comerciais e institucionais da Gestify."}
            </Label>
            {secondaryConsent.description ? (
              <p className="text-xs leading-5 text-slate-500">
                {secondaryConsent.description}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
