"use client";

import React, { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  CURRENT_TERMS_DOCUMENT_TITLE,
  CURRENT_TERMS_DOCUMENT_VERSION,
  CURRENT_TERMS_UPDATED_AT,
  TERMS_REQUIRED_QUERY_VALUE,
} from "@/lib/auth/terms-config";
import { supabaseBrowser } from "@/lib/supabase-browser";

import { ConsentCheckbox } from "@/components/legal/ConsentCheckbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GestifyLogo } from "@/components/brand/GestifyLogo";
import { LegalLinks } from "@/components/site/LegalLinks";

function safeRedirect(raw: string | null) {
  if (!raw) return "/dashboard/pedidos";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return "/dashboard/pedidos";
  if (!raw.startsWith("/")) return "/dashboard/pedidos";
  return raw;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = safeRedirect(searchParams.get("redirect"));
  const termsRequired = searchParams.get("terms") === TERMS_REQUIRED_QUERY_VALUE;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [consentError, setConsentError] = useState("");
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionRequiresTerms, setSessionRequiresTerms] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionAccessToken, setSessionAccessToken] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function inspectSession() {
      try {
        const supabase = supabaseBrowser();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!active) return;

        if (!session?.user) {
          setSessionChecked(true);
          return;
        }

        setSessionEmail(session.user.email ?? null);
        setSessionAccessToken(session.access_token ?? null);

        const response = await fetch("/api/auth/compliance", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        });

        const payload = await response.json().catch(() => null);

        if (!active) return;

        if (response.ok && payload?.acceptedCurrentTerms) {
          router.replace(redirect);
          router.refresh();
          return;
        }

        setSessionRequiresTerms(true);
      } catch (sessionError) {
        console.error("Falha ao validar a sessão de login:", sessionError);
      } finally {
        if (active) {
          setSessionChecked(true);
        }
      }
    }

    void inspectSession();

    return () => {
      active = false;
    };
  }, [redirect, router]);

  async function ensureTermsAcceptance(params: {
    accessToken: string;
    source: string;
  }) {
    const response = await fetch("/api/auth/compliance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({
        acceptTerms: true,
        source: params.source,
        path: "/login",
        redirectPath: redirect,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        payload?.error || "Não foi possível registrar o aceite dos termos."
      );
    }
  }

  const validateTermsConsent = () => {
    if (acceptedTerms) {
      setConsentError("");
      return true;
    }

    setConsentError(
      "Você precisa aceitar os Termos do Serviço para acessar a área do usuário."
    );
    return false;
  };

  const handleAcceptExistingSession = async () => {
    if (loading) return;
    if (!validateTermsConsent()) return;

    if (!sessionAccessToken) {
      setError("Sessão inválida. Faça login novamente para continuar.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await ensureTermsAcceptance({
        accessToken: sessionAccessToken,
        source: "existing_session_terms_gate",
      });

      router.replace(redirect);
      router.refresh();
    } catch (acceptError: any) {
      setError(
        acceptError?.message ??
          "Não foi possível registrar o aceite dos termos."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutAndSwitchAccount = async () => {
    if (loading) return;

    const supabase = supabaseBrowser();
    await supabase.auth.signOut();

    setSessionRequiresTerms(false);
    setSessionAccessToken(null);
    setSessionEmail(null);
    setAcceptedTerms(false);
    setConsentError("");
    setError("");
    setPassword("");
    router.refresh();
  };

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    if (!validateTermsConsent()) return;

    setLoading(true);
    setError("");

    try {
      const supabase = supabaseBrowser();

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message || "Credenciais inválidas");
        return;
      }

      if (!data?.user) {
        setError("Login não retornou usuário.");
        return;
      }

      const accessToken = data.session?.access_token ?? null;

      if (!accessToken) {
        setError("Não foi possível validar a sessão após o login.");
        await supabase.auth.signOut();
        return;
      }

      const currentRole =
        data.user.user_metadata?.role || data.user.app_metadata?.role;

      if (!currentRole) {
        const { error: updateErr } = await supabase.auth.updateUser({
          data: { role: "admin" },
        });

        if (updateErr) {
          console.error("Falha ao setar role no user_metadata:", updateErr);
        }

        await supabase.auth.getSession();
      }

      await ensureTermsAcceptance({
        accessToken,
        source: "login_form",
      });

      router.replace(redirect);
      router.refresh();
    } catch (err: any) {
      try {
        await supabaseBrowser().auth.signOut();
      } catch {
        // mantém o erro principal do fluxo
      }

      setError(err?.message ?? "Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.16),transparent_24%),linear-gradient(to_bottom,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />

      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="flex justify-center">
              <GestifyLogo
                size={72}
                showText
                subtitle="Sistema de gestão para restaurantes"
                textClassName="text-left"
              />
            </div>
          </div>

          <Card className="border-white/10 bg-white/95 text-slate-900 shadow-2xl shadow-black/30">
            <CardHeader>
              <CardTitle className="text-2xl">
                {sessionRequiresTerms
                  ? "Aceite obrigatório dos termos"
                  : "Entrar no sistema"}
              </CardTitle>
              <CardDescription>
                {sessionRequiresTerms
                  ? "Sua sessão já está ativa, mas o acesso só continua após o aceite da versão atual do contrato SaaS."
                  : "Digite suas credenciais para acessar sua operação"}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {!sessionChecked ? (
                <div className="space-y-3 text-sm text-slate-600">
                  <p>Validando sua sessão e os requisitos de acesso...</p>
                </div>
              ) : sessionRequiresTerms ? (
                <div className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {termsRequired ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      O acesso foi interrompido até que a versão atual dos termos
                      seja aceita.
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">
                      Sessão identificada{sessionEmail ? `: ${sessionEmail}` : "."}
                    </p>
                    <p className="mt-2">
                      Versão atual do contrato: {CURRENT_TERMS_DOCUMENT_VERSION} •
                      atualização em {CURRENT_TERMS_UPDATED_AT}.
                    </p>
                  </div>

                  <ConsentCheckbox
                    id="terms-gate-consent"
                    value={acceptedTerms}
                    onChange={(value) => {
                      setAcceptedTerms(value);
                      if (value) setConsentError("");
                    }}
                    error={consentError}
                    helperText="O aceite é obrigatório para liberar a entrada na área do usuário e registrar a versão contratual vinculada à sua sessão."
                  />

                  <div className="space-y-2">
                    <Button
                      type="button"
                      className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
                      disabled={loading || !acceptedTerms}
                      onClick={handleAcceptExistingSession}
                    >
                      {loading ? "Registrando aceite..." : "Aceitar e continuar"}
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={loading}
                      onClick={handleSignOutAndSwitchAccount}
                    >
                      Entrar com outra conta
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {termsRequired ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                      Para acessar a área do usuário, o aceite da versão atual dos{" "}
                      {CURRENT_TERMS_DOCUMENT_TITLE.toLowerCase()} é obrigatório.
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Senha</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>

                  <ConsentCheckbox
                    id="login-legal-consent"
                    value={acceptedTerms}
                    onChange={(value) => {
                      setAcceptedTerms(value);
                      if (value) setConsentError("");
                    }}
                    error={consentError}
                    helperText="O aceite é obrigatório para autenticar, registrar a versão contratual aceita e liberar o acesso à área do usuário."
                  />

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                    <p>
                      Contrato SaaS vigente: {CURRENT_TERMS_DOCUMENT_VERSION}.
                    </p>
                    <p>Última atualização: {CURRENT_TERMS_UPDATED_AT}.</p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
                    disabled={loading || !acceptedTerms}
                  >
                    {loading ? "Entrando..." : "Entrar"}
                  </Button>

                  <div className="text-center">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Esqueci minha senha
                    </Link>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-slate-300 hover:text-white">
              Voltar para página inicial
            </Link>
          </div>

          <div className="mt-4 border-t border-white/10 pt-4 text-center">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">
              Informações jurídicas
            </p>
            <LegalLinks variant="auth" className="flex justify-center" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm text-muted-foreground">Carregando...</div>}
    >
      <LoginInner />
    </Suspense>
  );
}
