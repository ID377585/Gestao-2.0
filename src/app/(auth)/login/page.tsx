"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { setSession } from "@/lib/auth/session";

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

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Login de demonstração (dev)
      if (email === "admin@gestao2.com" && password === "123456") {
        setSession({
          name: "Admin User",
          email: "admin@gestao2.com",
          role: "admin",
          avatar:
            "https://storage.googleapis.com/workspace-0f70711f-8b4e-4d94-86f1-2a93ccde5887/image/95215156-4b22-4f5b-abd9-f1893fb3cc73.png",
        });

        router.replace("/dashboard/pedidos");
        return;
      }

      setError("Email ou senha incorretos");
    } catch {
      setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-600 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">G2</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão 2.0</h1>
          <p className="text-gray-600">
            Sistema de Gestão para Restaurantes
          </p>
        </div>

        {/* Card Login */}
        <Card>
          <CardHeader>
            <CardTitle>Entrar no Sistema</CardTitle>
            <CardDescription>
              Digite suas credenciais para acessar o sistema
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

              <Button type="submit" className="w-full" disabled={loading}>
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

            {/* Credenciais demo */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Credenciais de Demo:
              </p>
              <p className="text-sm text-gray-600">
                Email: admin@gestao2.com
              </p>
              <p className="text-sm text-gray-600">Senha: 123456</p>
            </div>
          </CardContent>
        </Card>

        {/* Voltar */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Voltar para página inicial
          </Link>
        </div>
      </div>
    </div>
  );
}
