"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase-browser";

export default function SecurityPage() {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const [rotationConfirmation, setRotationConfirmation] = useState("");
  const [rotationLoading, setRotationLoading] = useState(false);
  const [rotationError, setRotationError] = useState("");

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passwordLoading) return;

    setPasswordError("");

    if (newPassword.length < 12) {
      setPasswordError("A nova senha deve ter pelo menos 12 caracteres.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação da nova senha não confere.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("Escolha uma senha diferente da senha atual.");
      return;
    }

    setPasswordLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });

      if (error) throw error;

      // Incident containment: after a password change, revoke refresh tokens for
      // every session instead of leaving other devices authenticated.
      await supabase.auth.signOut({ scope: "global" });

      router.replace("/login?redirect=%2Fdashboard%2Fseguranca");
      router.refresh();
    } catch (error: any) {
      setPasswordError(
        error?.message ?? "Não foi possível alterar a senha. Tente novamente."
      );
    } finally {
      setPasswordLoading(false);
    }
  }

  async function rotateAuthenticator() {
    if (rotationLoading || rotationConfirmation !== "ROTACIONAR") return;

    setRotationLoading(true);
    setRotationError("");

    try {
      const supabase = supabaseBrowser();
      const { data: aal, error: aalError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (aalError) throw aalError;
      if (aal.currentLevel !== "aal2") {
        throw new Error(
          "A sessão precisa estar em AAL2 para rotacionar o autenticador. Faça login com MFA e tente novamente."
        );
      }

      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) throw factorsError;

      const verifiedTotp = factors.totp.filter(
        (factor) => factor.status === "verified"
      );

      for (const factor of verifiedTotp) {
        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
          factorId: factor.id,
        });

        if (unenrollError) throw unenrollError;
      }

      // End all sessions so the next administrative login must enroll and
      // verify a fresh factor before the dashboard can be opened again.
      await supabase.auth.signOut({ scope: "global" });

      router.replace("/login?redirect=%2Fdashboard%2Fpedidos");
      router.refresh();
    } catch (error: any) {
      setRotationError(
        error?.message ??
          "Não foi possível rotacionar o autenticador. Tente novamente."
      );
    } finally {
      setRotationLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-sm font-medium text-slate-500">Segurança da conta</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">
          Credenciais e autenticação
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Use esta página apenas em um dispositivo confiável. Senhas e chaves de
          autenticador nunca devem ser enviadas por mensagem, commit ou captura de
          tela.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-950">Alterar senha</h2>
        <p className="mt-2 text-sm text-slate-600">
          A alteração exige a senha atual. Ao concluir, todas as sessões serão
          encerradas e será necessário entrar novamente.
        </p>

        {passwordError ? (
          <Alert variant="destructive" className="mt-5">
            <AlertDescription>{passwordError}</AlertDescription>
          </Alert>
        ) : null}

        <form onSubmit={changePassword} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Senha atual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={12}
              required
            />
            <p className="text-xs text-slate-500">
              Use pelo menos 12 caracteres e uma senha exclusiva, de preferência
              gerada pelo seu gerenciador de senhas.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={12}
              required
            />
          </div>

          <Button
            type="submit"
            disabled={
              passwordLoading ||
              !currentPassword ||
              newPassword.length < 12 ||
              !confirmPassword
            }
          >
            {passwordLoading ? "Alterando e encerrando sessões..." : "Alterar senha"}
          </Button>
        </form>
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
        <h2 className="text-xl font-semibold text-amber-950">
          Rotacionar aplicativo autenticador
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Esta ação remove os fatores TOTP verificados da conta, encerra todas as
          sessões e obriga um novo cadastro de autenticador no próximo login. Use-a
          quando uma chave/QR Code de MFA puder ter sido exposta.
        </p>

        {rotationError ? (
          <Alert variant="destructive" className="mt-5">
            <AlertDescription>{rotationError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="mt-6 space-y-2">
          <Label htmlFor="rotation-confirmation">
            Digite ROTACIONAR para confirmar
          </Label>
          <Input
            id="rotation-confirmation"
            value={rotationConfirmation}
            onChange={(event) =>
              setRotationConfirmation(event.target.value.toUpperCase())
            }
            autoComplete="off"
            placeholder="ROTACIONAR"
          />
        </div>

        <Button
          type="button"
          variant="destructive"
          className="mt-4"
          disabled={
            rotationLoading || rotationConfirmation !== "ROTACIONAR"
          }
          onClick={rotateAuthenticator}
        >
          {rotationLoading
            ? "Rotacionando e encerrando sessões..."
            : "Rotacionar autenticador"}
        </Button>
      </section>
    </main>
  );
}
