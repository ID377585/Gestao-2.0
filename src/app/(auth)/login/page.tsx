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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GestifyLogo } from "@/components/brand/GestifyLogo";
import { LegalLinks } from "@/components/site/LegalLinks";

type AuthMode = "login" | "signup";

function safeRedirect(raw: string | null) {
  if (!raw) return "/dashboard/pedidos";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return "/dashboard/pedidos";
  }
  if (!raw.startsWith("/")) return "/dashboard/pedidos";
  return raw;
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const redirect = safeRedirect(searchParams.get("redirect"));
  const termsRequired = searchParams.get("terms") === TERMS_REQUIRED_QUERY_VALUE;

  const [authMode, setAuthMode] = useState<AuthMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupCompany, setSignupCompany] = useState("");
  const [signupMessage, setSignupMessage] = useState("");

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [error, setError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");
  const [consentError, setConsentError] = useState("");

  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionRequiresTerms, setSessionRequiresTerms] = useState(false);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [sessionAccessToken, setSessionAccessToken] = useState<string | null>(
    null
  );

  const isLoginMode = authMode === "login";

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
        acceptError?.message ?? "Não foi possível registrar o aceite dos termos."
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
    setRequestSuccess("");

    try {
      const supabase = supabaseBrowser();

      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({
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

  const handleAccessRequest = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (requestLoading) return;

    setRequestLoading(true);
    setError("");
    setRequestSuccess("");

    try {
      const subject = encodeURIComponent("Solicitação de acesso ao Gestify");
      const body = encodeURIComponent(
        [
          "Olá, gostaria de solicitar acesso ao Gestify.",
          "",
          `Nome: ${signupName}`,
          `Email: ${signupEmail}`,
          `Empresa/Restaurante: ${signupCompany}`,
          "",
          `Mensagem: ${signupMessage || "Sem mensagem adicional."}`,
        ].join("\n")
      );

      window.location.href = `mailto:suporte@gestify.app?subject=${subject}&body=${body}`;

      setRequestSuccess(
        "Abrimos seu aplicativo de email com a solicitação preenchida. Envie a mensagem para concluir o pedido de acesso."
      );
    } catch {
      setError(
        "Não foi possível abrir seu aplicativo de email. Entre em contato com o suporte para solicitar acesso."
      );
    } finally {
      setRequestLoading(false);
    }
  };

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setError("");
    setRequestSuccess("");
    setConsentError("");
  };

  const LoginForm = (
    <form onSubmit={handleLogin} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {requestSuccess && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{requestSuccess}</AlertDescription>
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
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
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
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
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
        <p>Contrato SaaS vigente: {CURRENT_TERMS_DOCUMENT_VERSION}.</p>
        <p>Última atualização: {CURRENT_TERMS_UPDATED_AT}.</p>
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
        disabled={loading || !acceptedTerms}
      >
        {loading ? "Entrando..." : "Entrar"}
      </Button>

      <div className="flex flex-col items-center gap-2 text-center text-sm sm:flex-row sm:justify-between">
        <Link href="/forgot-password" className="text-blue-600 hover:text-blue-800">
          Esqueci minha senha
        </Link>

        <button
          type="button"
          onClick={() => switchMode("signup")}
          className="font-medium text-slate-600 transition hover:text-slate-950 lg:hidden"
        >
          Criar ou solicitar acesso
        </button>
      </div>
    </form>
  );

  const SignupForm = (
    <form onSubmit={handleAccessRequest} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {requestSuccess && (
        <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
          <AlertDescription>{requestSuccess}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4 text-sm leading-6 text-cyan-950">
        Preencha os dados abaixo para solicitar acesso ao Gestify. A ativação da
        conta será feita pela equipe responsável pela operação.
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-name">Nome</Label>
        <Input
          id="signup-name"
          type="text"
          placeholder="Seu nome"
          value={signupName}
          onChange={(e) => setSignupName(e.target.value)}
          required
          autoComplete="name"
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="seu@email.com"
          value={signupEmail}
          onChange={(e) => setSignupEmail(e.target.value)}
          required
          autoComplete="email"
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-company">Empresa ou restaurante</Label>
        <Input
          id="signup-company"
          type="text"
          placeholder="Nome da operação"
          value={signupCompany}
          onChange={(e) => setSignupCompany(e.target.value)}
          required
          autoComplete="organization"
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signup-message">Mensagem</Label>
        <Input
          id="signup-message"
          type="text"
          placeholder="Ex.: preciso liberar acesso para minha equipe"
          value={signupMessage}
          onChange={(e) => setSignupMessage(e.target.value)}
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
        />
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-blue-600 font-semibold text-white shadow-lg shadow-cyan-500/20 transition hover:-translate-y-0.5 hover:from-emerald-400 hover:via-cyan-400 hover:to-blue-500"
        disabled={requestLoading}
      >
        {requestLoading ? "Preparando solicitação..." : "Solicitar acesso"}
      </Button>

      <div className="text-center text-sm">
        <button
          type="button"
          onClick={() => switchMode("login")}
          className="font-medium text-blue-600 transition hover:text-blue-800 lg:hidden"
        >
          Já tenho acesso
        </button>
      </div>
    </form>
  );

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.24),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.2),transparent_26%),linear-gradient(to_bottom,rgba(15,23,42,0.96),rgba(2,6,23,1))]" />

      <div className="pointer-events-none fixed left-10 top-10 h-40 w-40 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="pointer-events-none fixed bottom-10 right-10 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-6xl">
          <div className="mb-8 flex justify-center">
            <GestifyLogo
              size={78}
              showText
              subtitle="Sistema de gestão para restaurantes"
              textClassName="text-left"
            />
          </div>

          {!sessionChecked ? (
            <div className="mx-auto max-w-md rounded-[2rem] border border-white/10 bg-white/95 p-8 text-center text-slate-700 shadow-2xl shadow-black/30">
              <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-cyan-500" />
              <p className="text-sm font-medium">
                Validando sua sessão e os requisitos de acesso...
              </p>
            </div>
          ) : sessionRequiresTerms ? (
            <div className="mx-auto max-w-lg rounded-[2rem] border border-white/10 bg-white/95 p-6 text-slate-900 shadow-2xl shadow-black/30 sm:p-8">
              <div className="mb-6">
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
                  Ação necessária
                </p>
                <h1 className="text-3xl font-black tracking-tight">
                  Aceite obrigatório dos termos
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Sua sessão já está ativa, mas o acesso só continua após o
                  aceite da versão atual do contrato SaaS.
                </p>
              </div>

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
                    className="h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
                    disabled={loading || !acceptedTerms}
                    onClick={handleAcceptExistingSession}
                  >
                    {loading ? "Registrando aceite..." : "Aceitar e continuar"}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full rounded-2xl"
                    disabled={loading}
                    onClick={handleSignOutAndSwitchAccount}
                  >
                    Entrar com outra conta
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="relative mx-auto grid min-h-[650px] w-full overflow-hidden rounded-[2.2rem] border border-white/10 bg-white text-slate-900 shadow-2xl shadow-black/40 lg:grid-cols-2">
              <div
                className={`absolute inset-y-0 z-20 hidden w-1/2 overflow-hidden bg-gradient-to-br from-blue-600 via-cyan-500 to-emerald-500 text-white transition-transform duration-700 ease-in-out lg:block ${
                  isLoginMode ? "translate-x-full" : "translate-x-0"
                }`}
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_24%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.18),transparent_26%)]" />
                <div className="relative flex h-full flex-col items-center justify-center px-12 text-center">
                  <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white/15 shadow-2xl shadow-slate-950/20 ring-1 ring-white/30 backdrop-blur">
                    <span className="text-5xl">G</span>
                  </div>

                  <h2 className="text-4xl font-black tracking-tight">
                    {isLoginMode ? "Bem-vindo de volta!" : "Comece com o Gestify"}
                  </h2>

                  <p className="mt-5 max-w-sm text-sm leading-7 text-white/85">
                    {isLoginMode
                      ? "Acesse sua operação com segurança e continue gerenciando pedidos, produção, estoque e financeiro."
                      : "Solicite seu acesso para centralizar sua operação em uma plataforma moderna e feita para restaurantes."}
                  </p>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => switchMode(isLoginMode ? "signup" : "login")}
                    className="mt-9 h-12 rounded-full border-white/70 bg-white/10 px-10 font-bold uppercase tracking-[0.18em] text-white backdrop-blur transition hover:bg-white hover:text-slate-950"
                  >
                    {isLoginMode ? "Criar acesso" : "Já tenho acesso"}
                  </Button>
                </div>
              </div>

              <section
                className={`flex items-center p-6 transition-opacity duration-500 sm:p-10 lg:p-12 ${
                  isLoginMode ? "lg:opacity-100" : "lg:opacity-0"
                }`}
              >
                <div className="mx-auto w-full max-w-md">
                  <div className="mb-8">
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-cyan-600">
                      Acesso seguro
                    </p>
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                      Entrar no sistema
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Digite suas credenciais para acessar sua operação.
                    </p>
                  </div>

                  {LoginForm}
                </div>
              </section>

              <section
                className={`flex items-center p-6 transition-opacity duration-500 sm:p-10 lg:p-12 ${
                  isLoginMode ? "lg:opacity-0" : "lg:opacity-100"
                }`}
              >
                <div className="mx-auto w-full max-w-md">
                  <div className="mb-8">
                    <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">
                      Novo acesso
                    </p>
                    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                      Solicitar acesso
                    </h1>
                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Envie seus dados para a equipe liberar sua conta no
                      Gestify.
                    </p>
                  </div>

                  {SignupForm}
                </div>
              </section>
            </div>
          )}

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