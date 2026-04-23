"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  acceptOptionalCookies,
  getDefaultCookieConsent,
  readCookieConsentPreferences,
  rejectOptionalCookies,
  shouldRenderCookieBanner,
  writeCookieConsentPreferences,
  type CookieConsentPreferences,
} from "@/lib/cookie-consent";

function CookiePreferenceRow({
  title,
  description,
  checked,
  disabled = false,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">{title}</p>
        <p className="text-sm leading-6 text-slate-300">{description}</p>
      </div>

      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-label={title}
      />
    </div>
  );
}

export function CookieBanner() {
  const pathname = usePathname();
  const isPublicPath = shouldRenderCookieBanner(pathname);

  const [mounted, setMounted] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [hasDecision, setHasDecision] = useState(false);
  const [preferences, setPreferences] = useState<CookieConsentPreferences>(
    getDefaultCookieConsent()
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isPublicPath) {
      setPanelOpen(false);
      setPreferencesExpanded(false);
      return;
    }

    const storedPreferences = readCookieConsentPreferences();

    if (storedPreferences) {
      setPreferences(storedPreferences);
      setHasDecision(true);
      setPanelOpen(false);
      setPreferencesExpanded(false);
      return;
    }

    setPreferences(getDefaultCookieConsent());
    setHasDecision(false);
    setPanelOpen(true);
    setPreferencesExpanded(false);
  }, [isPublicPath, mounted, pathname]);

  const hasVisiblePanel = mounted && isPublicPath && panelOpen;
  const showManageButton = mounted && isPublicPath && hasDecision && !panelOpen;

  const preferenceRows = useMemo(
    () => [
      {
        key: "necessary",
        title: "Necessários",
        description:
          "Mantêm o funcionamento técnico do site e a integridade de recursos essenciais.",
        checked: true,
        disabled: true,
      },
      {
        key: "functional",
        title: "Funcionais",
        description:
          "Memorizam preferências de navegação e tornam a experiência mais consistente.",
        checked: preferences.functional,
        onCheckedChange: (checked: boolean) =>
          setPreferences((current) => ({ ...current, functional: checked })),
      },
      {
        key: "analytics",
        title: "Analíticos",
        description:
          "Ajudam a entender desempenho, uso e pontos de melhoria do site.",
        checked: preferences.analytics,
        onCheckedChange: (checked: boolean) =>
          setPreferences((current) => ({ ...current, analytics: checked })),
      },
      {
        key: "marketing",
        title: "Marketing",
        description:
          "Reservados para mensuração e comunicação comercial quando esse tipo de integração existir.",
        checked: preferences.marketing,
        onCheckedChange: (checked: boolean) =>
          setPreferences((current) => ({ ...current, marketing: checked })),
      },
    ],
    [preferences.analytics, preferences.functional, preferences.marketing]
  );

  const handleAcceptOptional = () => {
    const nextPreferences = acceptOptionalCookies();
    setPreferences(nextPreferences);
    setHasDecision(true);
    setPanelOpen(false);
    setPreferencesExpanded(false);
  };

  const handleRejectOptional = () => {
    const nextPreferences = rejectOptionalCookies();
    setPreferences(nextPreferences);
    setHasDecision(true);
    setPanelOpen(false);
    setPreferencesExpanded(false);
  };

  const handleSavePreferences = () => {
    const nextPreferences = writeCookieConsentPreferences(preferences);
    setPreferences(nextPreferences);
    setHasDecision(true);
    setPanelOpen(false);
    setPreferencesExpanded(false);
  };

  if (!hasVisiblePanel && !showManageButton) {
    return null;
  }

  return (
    <>
      {showManageButton ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="pointer-events-auto">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPanelOpen(true)}
              className="border-white/15 bg-slate-950/90 text-slate-100 shadow-2xl backdrop-blur hover:bg-slate-900"
            >
              Preferências de cookies
            </Button>
          </div>
        </div>
      ) : null}

      {hasVisiblePanel ? (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[28px] border border-white/10 bg-slate-950/95 p-6 text-white shadow-2xl shadow-black/40 backdrop-blur-xl">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                  Cookies e preferências
                </p>
                <h2 className="text-2xl font-semibold text-white">
                  A Gestify usa cookies para manter o site estável, lembrar
                  preferências e preparar medições opcionais.
                </h2>
                <p className="text-sm leading-7 text-slate-300">
                  Os cookies necessários permanecem ativos. Você pode aceitar,
                  recusar ou personalizar as categorias opcionais sem afetar os
                  fluxos principais do site.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 lg:max-w-sm lg:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRejectOptional}
                  className="border-white/15 bg-white/5 text-white hover:bg-white hover:text-slate-950"
                >
                  Recusar opcionais
                </Button>
                <Button
                  type="button"
                  onClick={handleAcceptOptional}
                  className="bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
                >
                  Aceitar opcionais
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setPreferencesExpanded((current) => !current)
                  }
                  className="text-slate-300 hover:bg-white/5 hover:text-white"
                >
                  {preferencesExpanded ? "Ocultar preferências" : "Gerenciar preferências"}
                </Button>
              </div>
            </div>

            {preferencesExpanded ? (
              <div className="mt-6 grid gap-4 lg:grid-cols-2">
                {preferenceRows.map((item) => (
                  <CookiePreferenceRow
                    key={item.key}
                    title={item.title}
                    description={item.description}
                    checked={item.checked}
                    disabled={item.disabled}
                    onCheckedChange={item.onCheckedChange}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-6 text-slate-400">
                Nenhum script opcional é ativado automaticamente aqui. As
                preferências ficam registradas localmente para futuras integrações
                com analytics ou marketing.
              </p>

              {preferencesExpanded ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleSavePreferences}
                  className="bg-white text-slate-950 hover:bg-slate-100"
                >
                  Salvar preferências
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
