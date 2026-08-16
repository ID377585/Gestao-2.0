"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GestifyLogo } from "@/components/brand/GestifyLogo";
import { supabaseBrowser } from "@/lib/supabase-browser";

function safeRedirect(raw: string | null) {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard/pedidos";
  }

  return raw;
}

type TotpSetup = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export default function MfaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = useMemo(
    () => safeRedirect(searchParams.get("redirect")),
    [searchParams]
  );

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [existingFactorId, setExistingFactorId] = useState<string | null>(null);
  const [setup, setSetup] = useState<TotpSetup | null>(null);

  useEffect(() => {
    let active = true;

    async function inspectMfa() {
      try {
        const supabase = supabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.user) {
          router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
          return;
        }

        const { data: aal, error: aalError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (aalError) throw aalError;

        if (aal.currentLevel === "aal2") {
          router.replace(redirect);
          router.refresh();
          return;
        }

        const { data: factors, error: factorsError } =
          await supabase.auth.mfa.listFactors();

        if (factorsError) throw factorsError;

        const verifiedTotp = factors.totp.find(
          (factor) => factor.status === "verified"
        );

        if (verifiedTotp) {
          if (active) setExistingFactorId(verifiedTotp.id);
          return;
        }

        const { data: enrolled, error: enrollError } = await supabase.auth.mfa.enroll({
          factorType: "totp",
          friendlyName: "Gestify Admin",
        });

        if (enrollError) throw enrollError;

        if (active) {
          setSetup({
            factorId: enrolled.id,
            qrCode: enrolled.totp.qr_code,
            secret: enrolled.totp.secret,
          });
        }
      } catch (err: any) {
        if (active) {
          setError(
            err?.message ?? "Não foi possível preparar a autenticação em dois fatores."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void inspectMfa();

    return () => {
      active = false;
    };
  }, [redirect, router]);

  async function verifyMfa() {
    if (submitting) return;

    const factorId = existingFactorId ?? setup?.factorId;
    if (!factorId) {
      setError("Fator MFA não encontrado. Atualize a página e tente novamente.");
      return;
    }

    const normalizedCode = code.replace(/\s+/g, "");
    if (!/^\d{6}$/.test(normalizedCode)) {
      setError("Digite o código de 6 dígitos do seu aplicativo autenticador.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const supabase = supabaseBrowser();
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: normalizedCode,
      });

      if (verifyError) throw verifyError;

      const { data: refreshed, error: refreshError } =
        await supabase.auth.refreshSession();

      if (refreshError) throw refreshError;
      if (!refreshed.session) {
        throw new Error("Sessão MFA não pôde ser atualizada.");
      }

      router.replace(redirect);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Código inválido. Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  async function signOut() {
    await supabaseBrowser().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
        <div className="mb-8 flex justify-center">
          <GestifyLogo />
        </div>

        <h1 className="text-2xl font-semibold">Verificação em duas etapas</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Contas administrativas do Gestify exigem um segundo fator antes de acessar o painel.
        </p>

        {error ? (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loading ? (
          <div className="mt-8 text-sm text-slate-300">Preparando MFA...</div>
        ) : (
          <div className="mt-8 space-y-6">
            {setup ? (
              <div className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950 p-4">
                <div>
                  <h2 className="font-medium">Cadastre o autenticador</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Leia o QR Code com Google Authenticator, Microsoft Authenticator, 1Password ou outro app TOTP.
                  </p>
                </div>

                <div className="flex justify-center rounded-xl bg-white p-4">
                  <img
                    src={setup.qrCode}
                    alt="QR Code para configurar autenticação em dois fatores"
                    className="h-52 w-52"
                  />
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    Chave manual de backup do cadastro
                  </p>
                  <code className="mt-2 block break-all rounded-lg bg-slate-900 p-3 text-sm text-slate-200">
                    {setup.secret}
                  </code>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm text-slate-300">
                Seu autenticador já está cadastrado. Digite o código atual para continuar.
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="mfa-code">Código de 6 dígitos</Label>
              <Input
                id="mfa-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="h-12 bg-slate-950 text-center text-xl tracking-[0.35em]"
              />
            </div>

            <Button
              type="button"
              onClick={verifyMfa}
              disabled={submitting || code.length !== 6}
              className="h-12 w-full"
            >
              {submitting ? "Verificando..." : "Verificar e continuar"}
            </Button>

            <button
              type="button"
              onClick={signOut}
              className="w-full text-center text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline"
            >
              Sair e usar outra conta
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
