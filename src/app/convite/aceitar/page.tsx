import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptTenantInvitationInternalAction } from "@/lib/tenant/invitations.server";

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams?: Promise<{
    token?: string | string[];
    accepted?: string | string[];
    error?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const token = getQueryValue(resolvedSearchParams?.token).trim();
  const accepted = getQueryValue(resolvedSearchParams?.accepted).trim() === "1";
  const errorMessage = getQueryValue(resolvedSearchParams?.error).trim();

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!token && !accepted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Convite inválido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>O link de convite está incompleto ou inválido.</p>
            <Button asChild>
              <a href="/login">Ir para login</a>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!user && token) {
    redirect(`/login?redirect=${encodeURIComponent(`/convite/aceitar?token=${token}`)}`);
  }

  async function acceptInvitationAction(formData: FormData) {
    "use server";

    const invitationToken = String(formData.get("token") ?? "").trim();
    if (!invitationToken) {
      redirect("/convite/aceitar?error=Convite inválido.");
    }

    const serverSupabase = await createSupabaseServerClient();
    const {
      data: { user: currentUser },
      error: userError,
    } = await serverSupabase.auth.getUser();

    if (userError || !currentUser) {
      redirect(`/login?redirect=${encodeURIComponent(`/convite/aceitar?token=${invitationToken}`)}`);
    }

    try {
      await acceptTenantInvitationInternalAction({
        token: invitationToken,
        userId: currentUser.id,
      });
    } catch (error: any) {
      const message = encodeURIComponent(
        String(error?.message ?? "Não foi possível aceitar o convite.").slice(0, 180)
      );
      redirect(`/convite/aceitar?token=${encodeURIComponent(invitationToken)}&error=${message}`);
    }

    redirect("/convite/aceitar?accepted=1");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>{accepted ? "Convite aceito" : "Aceitar convite"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {accepted ? (
            <>
              <p className="text-sm text-muted-foreground">
                Seu acesso à empresa foi liberado com sucesso.
              </p>
              <Button asChild className="w-full">
                <a href="/dashboard/pedidos">Ir para o dashboard</a>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Você está prestes a aceitar um convite de acesso a uma empresa no Gestify.
              </p>

              {user?.email ? (
                <div className="rounded-lg border bg-slate-50 p-3 text-sm">
                  Conta logada: <span className="font-medium">{user.email}</span>
                </div>
              ) : null}

              {errorMessage ? (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {errorMessage}
                </div>
              ) : null}

              <form action={acceptInvitationAction} className="space-y-3">
                <input type="hidden" name="token" value={token} />
                <Button type="submit" className="w-full">
                  Aceitar convite
                </Button>
              </form>

              <Button asChild variant="outline" className="w-full">
                <a href="/dashboard/pedidos">Voltar ao dashboard</a>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
