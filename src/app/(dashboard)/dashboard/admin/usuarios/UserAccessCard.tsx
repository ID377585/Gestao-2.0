"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Collaborator, ProfileRole } from "./actions";
import {
  ACCESS_MODULES,
  type UserModulePermissionMap,
} from "./access-modules";

const ROLE_LABEL: Record<ProfileRole, string> = {
  admin: "Admin",
  operacao: "Operação",
  producao: "Produção",
  estoque: "Estoque",
  fiscal: "Fiscal",
  entrega: "Entrega",
};

function formatCardDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

type UserAccessCardProps = {
  collaborator: Collaborator;
  establishmentId: string;
  modulePermissions: UserModulePermissionMap;
  updateAction: (formData: FormData) => void | Promise<void>;
  updateAccessAction: (formData: FormData) => void | Promise<void>;
  resetPasswordAction: (formData: FormData) => void | Promise<void>;
  toggleStatusAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

const dialogInputClass = "border-slate-300 bg-white text-slate-950 placeholder:text-slate-400";
const dialogSelectClass = "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950";
const dialogCardClass = "rounded-xl border border-slate-200 bg-white p-3 text-sm transition hover:bg-slate-50";

export function UserAccessCard({
  collaborator,
  establishmentId,
  modulePermissions,
  updateAction,
  updateAccessAction,
  resetPasswordAction,
  toggleStatusAction,
  deleteAction,
}: UserAccessCardProps) {
  const enabledModules = ACCESS_MODULES.filter(
    (module) => modulePermissions?.[module.key]
  );

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div>
            <p className="truncate text-base font-semibold text-gray-900">
              {collaborator.full_name || "Usuário sem nome"}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {collaborator.email || "Sem e-mail"}
            </p>
          </div>

          <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-3">
            <p>
              <span className="font-medium text-gray-700">Setor:</span>{" "}
              {collaborator.sector || "—"}
            </p>
            <p>
              <span className="font-medium text-gray-700">Criado em:</span>{" "}
              {formatCardDate(collaborator.created_at)}
            </p>
            <p>
              <span className="font-medium text-gray-700">Último acesso:</span>{" "}
              {formatCardDate(collaborator.last_sign_in_at)}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {enabledModules.length > 0 ? (
              enabledModules.map((module) => (
                <Badge key={module.key} variant="secondary" className="rounded-full">
                  {module.label}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">
                Nenhuma sessão liberada.
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Badge variant="outline">{ROLE_LABEL[collaborator.role]}</Badge>
          <Badge variant={collaborator.is_active ? "default" : "secondary"}>
            {collaborator.is_active ? "Ativo" : "Inativo"}
          </Badge>
          <Badge variant="outline">{enabledModules.length} sessões</Badge>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Editar perfil
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl bg-white text-slate-950">
            <DialogHeader>
              <DialogTitle>Editar perfil</DialogTitle>
              <DialogDescription>
                Ajuste nome, papel, setor e status do usuário.
              </DialogDescription>
            </DialogHeader>

            <form action={updateAction} className="space-y-4">
              <input type="hidden" name="user_id" value={collaborator.id} />
              <input type="hidden" name="establishment_id" value={establishmentId} />

              <div className="space-y-1">
                <Label className="text-slate-800">Nome completo</Label>
                <Input name="full_name" defaultValue={collaborator.full_name} className={dialogInputClass} required />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-slate-800">Papel</Label>
                  <select
                    name="role"
                    className={dialogSelectClass}
                    defaultValue={collaborator.role}
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
                  <Label className="text-slate-800">Status de acesso</Label>
                  <select
                    name="is_active"
                    className={dialogSelectClass}
                    defaultValue={String(collaborator.is_active)}
                  >
                    <option value="true">Ativo</option>
                    <option value="false">Inativo</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-slate-800">Setor</Label>
                <Input
                  name="sector"
                  defaultValue={collaborator.sector ?? ""}
                  placeholder="Ex.: Estoque"
                  className={dialogInputClass}
                />
              </div>

              <DialogFooter>
                <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">Salvar alterações</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Liberar acesso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl bg-white text-slate-950">
            <DialogHeader>
              <DialogTitle>Liberar sessões de acesso</DialogTitle>
              <DialogDescription>
                Marque as áreas que este usuário pode acessar dentro da empresa ativa.
              </DialogDescription>
            </DialogHeader>

            <form action={updateAccessAction} className="space-y-4">
              <input type="hidden" name="user_id" value={collaborator.id} />
              <input type="hidden" name="establishment_id" value={establishmentId} />

              <div className="grid gap-3 sm:grid-cols-2">
                {ACCESS_MODULES.map((module) => (
                  <label
                    key={module.key}
                    className={dialogCardClass}
                  >
                    <input
                      type="checkbox"
                      name="modules"
                      value={module.key}
                      defaultChecked={Boolean(modulePermissions?.[module.key])}
                      className="mt-1 h-4 w-4 accent-blue-600"
                    />
                    <span>
                      <span className="block font-medium text-slate-900">{module.label}</span>
                      <span className="block text-xs text-slate-600">
                        {module.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <DialogFooter>
                <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">Salvar acessos</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              Redefinir senha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white text-slate-950">
            <DialogHeader>
              <DialogTitle>Redefinir senha</DialogTitle>
              <DialogDescription>
                Defina uma nova senha temporária para este usuário.
              </DialogDescription>
            </DialogHeader>

            <form action={resetPasswordAction} className="space-y-4">
              <input type="hidden" name="user_id" value={collaborator.id} />
              <div className="space-y-1">
                <Label className="text-slate-800">Nova senha</Label>
                <Input type="password" name="password" placeholder="••••••••" className={dialogInputClass} required />
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800">Atualizar senha</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <form action={toggleStatusAction}>
          <input type="hidden" name="user_id" value={collaborator.id} />
          <input type="hidden" name="establishment_id" value={establishmentId} />
          <input type="hidden" name="is_active" value={String(!collaborator.is_active)} />
          <Button type="submit" variant="outline" size="sm">
            {collaborator.is_active ? "Desativar" : "Reativar"}
          </Button>
        </form>

        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" size="sm" className="bg-red-600 text-white hover:bg-red-700">
              Excluir usuário
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white text-slate-950">
            <DialogHeader>
              <DialogTitle>Excluir usuário</DialogTitle>
              <DialogDescription>
                Esta ação remove o vínculo deste estabelecimento. Se o usuário não tiver
                outros vínculos, ele também será excluído do Auth.
              </DialogDescription>
            </DialogHeader>

            <form action={deleteAction} className="space-y-4">
              <input type="hidden" name="user_id" value={collaborator.id} />
              <input type="hidden" name="establishment_id" value={establishmentId} />
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                Confirme apenas se deseja remover o acesso de {collaborator.full_name || collaborator.email}.
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-red-600 text-white hover:bg-red-700">
                  Confirmar exclusão
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
