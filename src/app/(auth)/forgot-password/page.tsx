"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";

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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const redirectTo = `${window.location.origin}/login`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );

      if (resetError) {
        setError(resetError.message || "Erro ao enviar email de recuperação.");
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(
        err?.message || "Erro ao enviar email de recuperação. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-white font-bold text-2xl">G2</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Gestão 2.0</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-green-600">Email Enviado!</CardTitle>
              <CardDescription>
                Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Image
                    src="https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/5bd453db-e56d-492e-9045-433bcf22a34d.png"
                    alt="Sucesso"
                    width={32}
                    height={32}
                    className="w-8 h-8"
                  />
                </div>

                <p className="text-sm text-gray-600">
                  Um email foi enviado para <strong>{email}</strong> com instruções para redefinir sua senha.
                </p>

                <Link href="/login">
                  <Button className="w-full">Voltar para Login</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">G2</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão 2.0</h1>
          <p className="text-gray-600">Recuperar Senha</p>
        </div>

        {/* Reset Form */}
        <Card>
          <CardHeader>
            <CardTitle>Esqueci minha senha</CardTitle>
            <CardDescription>
              Digite seu email para receber instruções de recuperação
            </CardDescription>
          </CardHeader>

          <CardContent>
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
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                disabled={loading}
              >
                {loading ? "Enviando..." : "Enviar Email de Recuperação"}
              </Button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800">
                  ← Voltar para login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
