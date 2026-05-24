import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptTenantInvitationInternalAction } from "@/lib/tenant/invitations.server";

export const dynamic = "force-dynamic";

type ConvitePageProps = {
  searchParams?: Promise<{
    token?: string | string[];
  }>;
};

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function buildLoginUrl(token: string) {
  const redirectPath = `/convite?token=${encodeURIComponent(token)}`;
  return `/login?redirect=${encodeURIComponent(redirectPath)}`;
}

function MessageCard({
  title,
  message,
  variant,
}: {
  title: string;
  message: string;
  variant: "error" | "success";
}) {
  const Icon = variant === "success" ? CheckCircle2 : AlertCircle;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-4 text-slate-900">
      <Card className="w-full max-w-md border-white/10 bg-white/95 shadow-2xl shadow-black/30">
        <CardHeader>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
            <Icon
              className={
                variant === "success"
                  ? "h-6 w-6 text-emerald-600"
                  : "h-6 w-6 text-red-600"
              }
            />
          </div>
          <CardTitle className="text-2xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">{message}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1">
              <Link href="/login">Entrar no Gestify</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href="/">Voltar ao início</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default async function ConvitePage({ searchParams }: ConvitePageProps) {
  const resolvedSearchParams = await searchParams;
  const token = getQueryValue(resolvedSearchParams?.token).trim();

  if (!token) {
    return (
      <MessageCard
        title="Convite inválido"
        message="O link acessado não possui um token de convite válido."
        variant="error"
      />
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect(buildLoginUrl(token));
  }

  try {
    await acceptTenantInvitationInternalAction({
      token,
      userId: user.id,
      userEmail: user.email ?? null,
    });
  } catch (error: any) {
    return (
      <MessageCard
        title="Não foi possível aceitar o convite"
        message={error?.message ?? "O convite não pôde ser validado."}
        variant="error"
      />
    );
  }

  redirect("/dashboard/pedidos?convite=aceito");
}
