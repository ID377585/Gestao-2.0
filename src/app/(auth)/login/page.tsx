"use client";

import React, { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase-browser";

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

  const [email, setEmail] = useState("admin@gestao2.com");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;

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

      router.replace(redirect);
      router.refresh();
    } catch (err: any) {
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
              <CardTitle className="text-2xl">Entrar no sistema</CardTitle>
              <CardDescription>
                Digite suas credenciais para acessar sua operação
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

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

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
                  disabled={loading}
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

              <div className="mt-6 rounded-xl bg-slate-100 p-4">
                <p className="text-sm font-medium text-slate-700 mb-2">
                  Credenciais de demo:
                </p>
                <p className="text-sm text-slate-600">Email: admin@gestao2.com</p>
                <p className="text-sm text-slate-600">Senha: 123456</p>
                <p className="mt-2 text-xs text-slate-500">
                  * Essas credenciais precisam existir no Supabase Auth.
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  * Em ambiente de desenvolvimento, se não existir role, será definido role=admin no user_metadata.
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 text-center">
            <Link href="/" className="text-sm text-slate-300 hover:text-white">
              Voltar para página inicial
            </Link>
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