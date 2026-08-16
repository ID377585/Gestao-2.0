"use client";

import React, { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import {
  CURRENT_TERMS_DOCUMENT_TITLE,
  CURRENT_TERMS_DOCUMENT_VERSION,
  CURRENT_TERMS_UPDATED_AT,
  TERMS_REQUIRED_QUERY_VALUE,
  hasAcceptedCurrentTerms,
  readTermsComplianceFromMetadata,
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

        const sessionState = readTermsComplianceFromMetadata(
          session.user.app_metadata as Record<string, unknown> | undefined
        );

        if (hasAcceptedCurrentTerms(sessionState)) {
          router.replace(redirect);
          router.refresh();
          return;
        }

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

      const sessionState = readTermsComplianceFromMetadata(
        data.user.app_metadata as Record<string, unknown> | undefined
      );

      if (!hasAcceptedCurrentTerms(sessionState)) {
        await ensureTermsAcceptance({
          accessToken,
          source: "login_form",
        });
      }

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

      <div className="space-y-2">
        <Label htmlFor="signupName">Nome</Label>
        <Input
          id="signupName"
          type="text"
          placeholder="Seu nome"
          value={signupName}
          onChange={(e) => setSignupName(e.target.value)}
          required
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signupEmail">Email</Label>
        <Input
          id="signupEmail"
          type="email"
          placeholder="seu@email.com"
          value={signupEmail}
          onChange={(e) => setSignupEmail(e.target.value)}
          required
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signupCompany">Empresa/Restaurante</Label>
        <Input
          id="signupCompany"
          type="text"
          placeholder="Nome da empresa"
          value={signupCompany}
          onChange={(e) => setSignupCompany(e.target.value)}
          required
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="signupMessage">Mensagem opcional</Label>
        <Input
          id="signupMessage"
          type="text"
          placeholder="Conte rapidamente o que precisa"
          value={signupMessage}
          onChange={(e) => setSignupMessage(e.target.value)}
          className="h-12 rounded-2xl border-slate-200 bg-slate-50 px-4 text-base transition focus-visible:ring-cyan-500"
        />
      </div>

      <Button
        type="submit"
        className="h-12 w-full rounded-2xl bg-slate-950 font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
        disabled={requestLoading}
      >
        {requestLoading ? "Preparando..." : "Solicitar acesso"}
      </Button>
    </form>
  );

  if (!sessionChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
          <p className="text-sm text-slate-300">Verificando sessão...</p>
        </div>
      </div>
    );
  }

  if (sessionRequiresTerms) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-slate-950 shadow-2xl">
          <GestifyLogo className="mx-auto mb-6 h-14 w-14" />
          <h1 className="mb-2 text-2xl font-bold">Aceite necessário</h1>
          <p className="mb-5 text-sm text-slate-600">
            A sessão de {sessionEmail ?? "usuário autenticado"} precisa aceitar a versão atual dos termos para continuar.
          </p>

          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <ConsentCheckbox
            id="existing-session-legal-consent"
            value={acceptedTerms}
            onChange={(value) => {
              setAcceptedTerms(value);
              if (value) setConsentError("");
            }}
            error={consentError}
            helperText="O aceite é obrigatório para liberar o acesso à área do usuário."
          />

          <Button
            type="button"
            className="mt-5 h-12 w-full rounded-2xl bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 font-semibold text-white"
            disabled={loading || !acceptedTerms}
            onClick={handleAcceptExistingSession}
          >
            {loading ? "Liberando..." : "Aceitar e continuar"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="mt-3 w-full"
            onClick={handleSignOutAndSwitchAccount}
            disabled={loading}
          >
            Sair e usar outra conta
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen overflow-hidden bg-slate-950 text-slate-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.22),_transparent_30%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-10">
        <div className="mb-8 flex items-center gap-3 text-white">
          <GestifyLogo className="h-14 w-14" />
          <div>
            <p className="text-xl font-bold leading-none">Gestify</p>
            <p className="text-xs text-slate-300">Sistema de gestão para restaurantes</p>
          </div>
        </div>

        <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl lg:grid-cols-[1fr_1.15fr]">
          <section className="p-8 sm:p-12 lg:p-14">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-cyan-600">
              Acesso seguro
            </p>
            <h1 className="mb-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              {isLoginMode ? "Entrar no sistema" : "Solicitar acesso"}
            </h1>
            <p className="mb-8 text-sm text-slate-600">
              {isLoginMode
                ? "Digite suas credenciais para acessar sua operação."
                : "Informe seus dados para solicitar a criação ou liberação do acesso."}
            </p>

            {isLoginMode ? LoginForm : SignupForm}
          </section>

          <section className="relative hidden min-h-[520px] items-center justify-center overflow-hidden bg-gradient-to-br from-blue-600 via-cyan-500 to-emerald-400 p-10 text-white lg:flex">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.25),_transparent_32%)]" />
            <div className="relative max-w-sm text-center">
              <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20 shadow-2xl backdrop-blur">
                <span className="text-4xl font-black">G</span>
              </div>
              <h2 className="mb-4 text-4xl font-black tracking-tight">Bem-vindo de volta!</h2>
              <p className="mb-8 text-sm leading-6 text-white/90">
                Acesse sua operação com segurança e continue gerenciando pedidos, produção, estoque e financeiro.
              </p>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/60 bg-white/10 px-10 py-6 text-xs font-bold uppercase tracking-[0.25em] text-white backdrop-blur hover:bg-white hover:text-slate-950"
                onClick={() => switchMode(isLoginMode ? "signup" : "login")}
              >
                {isLoginMode ? "Criar acesso" : "Voltar ao login"}
              </Button>
            </div>
          </section>
        </div>

        <div className="mt-6 text-center text-xs text-slate-400">
          <LegalLinks />
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-cyan-300 border-t-transparent" />
            <p className="text-sm text-slate-300">Carregando...</p>
          </div>
        </div>
      }
    >
      <LoginInner />
    </Suspense>
  );
}
