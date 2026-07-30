"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Copy, Link2, MailPlus, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createTenantInvitationForAdminAction,
  resendTenantInvitationForAdminAction,
  type CreateTenantInvitationActionState,
  type TenantInvitationSummary,
} from "./actions";

const INITIAL_STATE: CreateTenantInvitationActionState = {
  status: "idle",
  message: null,
  inviteUrl: null,
  email: null,
  expiresAt: null,
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  operacao: "Operação",
  producao: "Produção",
  estoque: "Estoque",
  fiscal: "Fiscal",
  entrega: "Entrega",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  expired: "Expirado",
  canceled: "Cancelado",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getInvitationStatus(invitation: TenantInvitationSummary) {
  const expiresAt = invitation.expires_at
    ? new Date(invitation.expires_at).getTime()
    : null;

  if (
    invitation.status === "pending" &&
    expiresAt !== null &&
    expiresAt < Date.now()
  ) {
    return "expired";
  }

  return invitation.status;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      <MailPlus className="h-4 w-4" />
      {pending ? "Gerando convite..." : "Gerar convite"}
    </Button>
  );
}

function ResendButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending}>
      <RotateCw className={pending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
      {pending ? "Reenviando..." : "Reenviar"}
    </Button>
  );
}

export function InviteUserCard({
  invitations,
}: {
  invitations: TenantInvitationSummary[];
}) {
  const [state, formAction] = useActionState(
    createTenantInvitationForAdminAction,
    INITIAL_STATE
  );
  const [resendState, resendFormAction] = useActionState(
    resendTenantInvitationForAdminAction,
    INITIAL_STATE
  );
  const [copied, setCopied] = useState(false);
  const recentInvitations = useMemo(() => invitations.slice(0, 6), [invitations]);
  const visibleState = resendState.status !== "idle" ? resendState : state;

  async function copyInviteUrl() {
    if (!visibleState.inviteUrl) return;

    try {
      await navigator.clipboard.writeText(visibleState.inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MailPlus className="h-5 w-5" />
          Convite de usuário
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-5">
        <form action={formAction} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="invite_email">E-mail do convidado</Label>
            <Input
              id="invite_email"
              name="invite_email"
              type="email"
              placeholder="usuario@empresa.com"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="invite_role">Papel</Label>
              <select
                id="invite_role"
                name="invite_role"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="producao"
                required
              >
                <option value="admin">Admin</option>
                <option value="operacao">Operação</option>
                <option value="producao">Produção</option>
                <option value="estoque">Estoque</option>
                <option value="fiscal">Fiscal</option>
                <option value="entrega">Entrega</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="invite_expires_hours">Validade</Label>
              <select
                id="invite_expires_hours"
                name="invite_expires_hours"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                defaultValue="72"
              >
                <option value="24">24 horas</option>
                <option value="72">3 dias</option>
                <option value="168">7 dias</option>
                <option value="720">30 dias</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="invite_sector">Setor / Área</Label>
            <Input
              id="invite_sector"
              name="invite_sector"
              placeholder="Ex.: Estoque, Fiscal, Produção"
            />
          </div>

          <SubmitButton />
        </form>

        {visibleState.message ? (
          <div
            className={
              visibleState.status === "success"
                ? "rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
                : "rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
            }
            aria-live="polite"
          >
            {visibleState.message}
          </div>
        ) : null}

        {visibleState.inviteUrl ? (
          <div className="space-y-2 rounded-lg border bg-slate-50 p-3">
            <Label htmlFor="created_invite_url" className="text-xs">
              Link do convite
            </Label>
            <div className="flex gap-2">
              <Input
                id="created_invite_url"
                value={visibleState.inviteUrl}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Copiar link do convite"
                onClick={copyInviteUrl}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {copied
                ? "Link copiado."
                : `Expira em ${formatDate(visibleState.expiresAt)}.`}
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">Convites recentes</p>
            <Badge variant="outline">{invitations.length}</Badge>
          </div>

          {recentInvitations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum convite criado para a empresa ativa.
            </p>
          ) : (
            <div className="space-y-2">
              {recentInvitations.map((invitation) => {
                const status = getInvitationStatus(invitation);

                return (
                  <div
                    key={invitation.id}
                    className="rounded-lg border p-3 text-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {invitation.email}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {ROLE_LABEL[invitation.role] ?? invitation.role}
                          {invitation.sector ? ` · ${invitation.sector}` : ""}
                        </p>
                      </div>
                      <Badge variant={status === "accepted" ? "default" : "outline"}>
                        {STATUS_LABEL[status] ?? status}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Link2 className="h-3 w-3" />
                        <span>Criado {formatDate(invitation.created_at)}</span>
                        <span>· expira {formatDate(invitation.expires_at)}</span>
                      </div>

                      {status === "pending" || status === "expired" ? (
                        <form action={resendFormAction}>
                          <input
                            type="hidden"
                            name="invitation_id"
                            value={invitation.id}
                          />
                          <ResendButton />
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
