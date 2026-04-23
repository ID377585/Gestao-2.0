"use client";

import React, { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setError(error.message || "Erro ao enviar email de recuperação.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Erro ao enviar email de recuperação. Tente novamente.");
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
                subtitle="Recuperação de acesso"
                textClassName="text-left"
              />
            </div>
          </div>

          <Card className="border-white/10 bg-white/95 text-slate-900 shadow-2xl shadow-black/30">
            <CardHeader>
              <CardTitle className="text-2xl">
                {success ? "Email enviado" : "Esqueci minha senha"}
              </CardTitle>
              <CardDescription>
                {success
                  ? "Verifique sua caixa de entrada para continuar a redefinição da senha."
                  : "Digite seu email para receber o link de recuperação de acesso."}
              </CardDescription>
            </CardHeader>

            <CardContent>
              {success ? (
                <div className="space-y-4">
                  <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                    <AlertDescription>
                      Um email de recuperação foi enviado para <strong>{email}</strong>.
                    </AlertDescription>
                  </Alert>

                  <p className="text-sm text-slate-600">
                    Abra sua caixa de entrada, clique no link recebido e siga as etapas para cadastrar uma nova senha.
                  </p>

                  <Link href="/login">
                    <Button className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400">
                      Voltar para login
                    </Button>
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
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

                  <Button
                    type="submit"
                    className="w-full bg-gradient-to-r from-blue-600 via-cyan-500 to-emerald-500 text-white hover:from-blue-500 hover:via-cyan-400 hover:to-emerald-400"
                    disabled={loading}
                  >
                    {loading ? "Enviando..." : "Enviar link de recuperação"}
                  </Button>

                  <div className="text-center">
                    <Link
                      href="/login"
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      Voltar para login
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
