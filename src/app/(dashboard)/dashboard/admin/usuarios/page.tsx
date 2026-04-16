import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  createCollaborator,
  deleteCollaborator,
  listCollaborators,
  listUserAccessAuditLogs,
  resetCollaboratorPassword,
  toggleCollaboratorStatus,
  updateCollaborator,
  type ProfileRole,
  type UserAccessAuditLog,
} from "./actions";

const ROLE_LABEL: Record<ProfileRole, string> = {
  admin: "Admin",
  operacao: "Operação",
  producao: "Produção",
  estoque: "Estoque",
  fiscal: "Fiscal",
  entrega: "Entrega",
};

const AUDIT_LABEL: Record<string, string> = {
  create_user: "Criação de usuário",
  update_user: "Atualização de usuário",
  reset_password: "Redefinição de senha",
  deactivate_user: "Desativação temporária",
  reactivate_user: "Reativação de acesso",
  delete_user: "Exclusão de usuário",
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

function getQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function AuditLogCard({ log }: { log: UserAccessAuditLog }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-gray-900">
            {AUDIT_LABEL[log.action] ?? log.action}
          </p>
          <p className="text-xs text-muted-foreground">{formatDate(log.created_at)}</p>
        </div>

        <Badge variant="outline">{AUDIT_LABEL[log.action] ?? log.action}</Badge>
      </div>

      <div className="space-y-1 text-sm">
        <p>
          <span className="font-medium">Quem executou:</span>{" "}
          {log.actor_name || "Sistema"}
          {log.actor_email ? ` • ${log.actor_email}` : ""}
        </p>

        <p>
          <span className="font-medium">Usuário alvo:</span>{" "}
          {log.target_name || "—"}
          {log.target_email ? ` • ${log.target_email}` : ""}
        </p>

        {log.details?.after ? (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground">
            <p className="font-medium text-gray-700">Resumo da alteração</p>
            <pre className="mt-2 whitespace-pre-wrap break-words">
              {JSON.stringify(log.details.after, null, 2)}
            </pre>
          </div>
        ) : null}

        {log.action === "delete_user" ? (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground">
            <p>
              Exclusão do acesso ao estabelecimento:{" "}
              {log.details?.removed_from_establishment ? "sim" : "não"}
            </p>
            <p>
              Exclusão no Auth: {log.details?.auth_user_deleted ? "sim" : "não"}
            </p>
            <p>
              Possuía outros vínculos: {log.details?.had_other_memberships ? "sim" : "não"}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default async function UsuariosPage({
  searchParams,
}: {
  searchParams?: {
    q?: string | string[];
    role?: string | string[];
    status?: string | string[];
    sector?: string | string[];
  };
}) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let establishmentId = "";

  if (user?.id) {
    const { data: membership } = await supabase
      .from("establishment_memberships")
      .select("establishment_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    establishmentId = String(membership?.establishment_id ?? "");
  }

  const collaborators = await listCollaborators();
  const auditLogs = await listUserAccessAuditLogs(30);

  const q = getQueryValue(searchParams?.q).trim().toLowerCase();
  const roleFilter = getQueryValue(searchParams?.role).trim();
  const statusFilter = getQueryValue(searchParams?.status).trim();
  const sectorFilter = getQueryValue(searchParams?.sector).trim();

  const sectors = Array.from(
    new Set(
      collaborators
        .map((colab) => (colab.sector ?? "").trim())
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filteredCollaborators = collaborators.filter((colab) => {
    const matchesQuery =
      !q ||
      colab.full_name.toLowerCase().includes(q) ||
      colab.email.toLowerCase().includes(q) ||
      (colab.sector ?? "").toLowerCase().includes(q);

    const matchesRole = !roleFilter || colab.role === roleFilter;

    const matchesStatus =
      !statusFilter ||
      statusFilter === "todos" ||
      (statusFilter === "ativos" && colab.is_active) ||
      (statusFilter === "inativos" && !colab.is_active);

    const matchesSector = !sectorFilter || (colab.sector ?? "") === sectorFilter;

    return matchesQuery && matchesRole && matchesStatus && matchesSector;
  });

  const total = collaborators.length;
  const totalAtivos = collaborators.filter((colab) => colab.is_active).length;
  const totalInativos = collaborators.filter((colab) => !colab.is_active).length;

  async function handleCreate(formData: FormData) {
    "use server";
    await createCollaborator(formData);
  }

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateCollaborator(formData);
  }

  async function handleResetPassword(formData: FormData) {
    "use server";
    await resetCollaboratorPassword(formData);
  }

  async function handleToggleStatus(formData: FormData) {
    "use server";
    await toggleCollaboratorStatus(formData);
  }

  async function handleDelete(formData: FormData) {
    "use server";
    await deleteCollaborator(formData);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestão de Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre colaboradores, pesquise, filtre, ajuste papéis, setor, status de
          acesso, senha, exclusão e acompanhe os logs de auditoria.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total de usuários</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total}</div>
            <p className="text-xs text-muted-foreground">Cadastrados no estabelecimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAtivos}</div>
            <p className="text-xs text-muted-foreground">Com acesso liberado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInativos}</div>
            <p className="text-xs text-muted-foreground">Desativados temporariamente</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resultado filtrado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredCollaborators.length}</div>
            <p className="text-xs text-muted-foreground">Após busca e filtros</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Novo colaborador</CardTitle>
          </CardHeader>

          <CardContent>
            <form action={handleCreate} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="full_name">Nome completo</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="Ex.: Ana Produção"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="ana@gestify.app"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password">Senha inicial</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="role">Papel de acesso</Label>
                <select
                  id="role"
                  name="role"
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
                <Label htmlFor="sector">Setor / Área</Label>
                <Input
                  id="sector"
                  name="sector"
                  placeholder="Ex.: Confeitaria, Estoque, Logística"
                />
              </div>

              <Button type="submit" className="w-full">
                Salvar colaborador
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-4">
            <CardTitle className="text-lg">Usuários com acesso</CardTitle>

            <form method="get" className="grid gap-3 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <Label htmlFor="q">Buscar</Label>
                <Input
                  id="q"
                  name="q"
                  defaultValue={q}
                  placeholder="Nome, e-mail ou setor..."
                />
              </div>

              <div>
                <Label htmlFor="role-filter">Papel</Label>
                <select
                  id="role-filter"
                  name="role"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={roleFilter}
                >
                  <option value="">Todos</option>
                  <option value="admin">Admin</option>
                  <option value="operacao">Operação</option>
                  <option value="producao">Produção</option>
                  <option value="estoque">Estoque</option>
                  <option value="fiscal">Fiscal</option>
                  <option value="entrega">Entrega</option>
                </select>
              </div>

              <div>
                <Label htmlFor="status-filter">Status</Label>
                <select
                  id="status-filter"
                  name="status"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={statusFilter || "todos"}
                >
                  <option value="todos">Todos</option>
                  <option value="ativos">Ativos</option>
                  <option value="inativos">Inativos</option>
                </select>
              </div>

              <div className="lg:col-span-2">
                <Label htmlFor="sector-filter">Setor</Label>
                <select
                  id="sector-filter"
                  name="sector"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue={sectorFilter}
                >
                  <option value="">Todos</option>
                  {sectors.map((sector) => (
                    <option key={sector} value={sector}>
                      {sector}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end gap-2 lg:col-span-2">
                <Button type="submit" className="flex-1">
                  Aplicar filtros
                </Button>
                <a
                  href="/dashboard/admin/usuarios"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium"
                >
                  Limpar
                </a>
              </div>
            </form>
          </CardHeader>

          <CardContent className="space-y-4">
            {filteredCollaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum colaborador encontrado com os filtros informados.
              </p>
            ) : (
              filteredCollaborators.map((colab) => (
                <div key={colab.id} className="rounded-xl border p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{colab.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {colab.email || "Sem e-mail"}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                        <p>Setor: {colab.sector || "—"}</p>
                        <p>Criado em: {formatDate(colab.created_at)}</p>
                        <p>Último acesso: {formatDate(colab.last_sign_in_at)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{ROLE_LABEL[colab.role]}</Badge>
                      <Badge variant={colab.is_active ? "default" : "secondary"}>
                        {colab.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <form action={handleUpdate} className="space-y-3 rounded-lg border p-4">
                      <input type="hidden" name="user_id" value={colab.id} />
                      <input
                        type="hidden"
                        name="establishment_id"
                        value={establishmentId}
                      />

                      <div className="space-y-1">
                        <Label>Nome completo</Label>
                        <Input name="full_name" defaultValue={colab.full_name} required />
                      </div>

                      <div className="space-y-1">
                        <Label>Papel</Label>
                        <select
                          name="role"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          defaultValue={colab.role}
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
                        <Label>Setor</Label>
                        <Input
                          name="sector"
                          defaultValue={colab.sector ?? ""}
                          placeholder="Ex.: Estoque"
                        />
                      </div>

                      <div className="space-y-1">
                        <Label>Status de acesso</Label>
                        <select
                          name="is_active"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                          defaultValue={String(colab.is_active)}
                        >
                          <option value="true">Ativo</option>
                          <option value="false">Inativo</option>
                        </select>
                      </div>

                      <Button type="submit" className="w-full">
                        Salvar alterações
                      </Button>
                    </form>

                    <div className="space-y-4 rounded-lg border p-4">
                      <form action={handleResetPassword} className="space-y-3">
                        <input type="hidden" name="user_id" value={colab.id} />

                        <div>
                          <p className="mb-1 text-sm font-medium">Redefinir senha</p>
                          <p className="text-xs text-muted-foreground">
                            Defina uma nova senha para este usuário.
                          </p>
                        </div>

                        <div className="space-y-1">
                          <Label>Nova senha</Label>
                          <Input
                            type="password"
                            name="password"
                            placeholder="••••••••"
                            required
                          />
                        </div>

                        <Button type="submit" variant="outline" className="w-full">
                          Atualizar senha
                        </Button>
                      </form>

                      <form action={handleToggleStatus} className="space-y-3">
                        <input type="hidden" name="user_id" value={colab.id} />
                        <input
                          type="hidden"
                          name="establishment_id"
                          value={establishmentId}
                        />
                        <input
                          type="hidden"
                          name="is_active"
                          value={String(!colab.is_active)}
                        />

                        <div>
                          <p className="mb-1 text-sm font-medium">
                            {colab.is_active
                              ? "Desativar temporariamente"
                              : "Reativar acesso"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {colab.is_active
                              ? "Remove o acesso sem apagar o cadastro."
                              : "Libera novamente o acesso ao sistema."}
                          </p>
                        </div>

                        <Button type="submit" variant="outline" className="w-full">
                          {colab.is_active ? "Desativar acesso" : "Reativar acesso"}
                        </Button>
                      </form>
                    </div>

                    <form action={handleDelete} className="space-y-3 rounded-lg border p-4">
                      <input type="hidden" name="user_id" value={colab.id} />
                      <input
                        type="hidden"
                        name="establishment_id"
                        value={establishmentId}
                      />

                      <div>
                        <p className="mb-1 text-sm font-medium">Excluir usuário</p>
                        <p className="text-xs text-muted-foreground">
                          Remove o vínculo deste estabelecimento. Se o usuário não tiver
                          outros vínculos, ele também será excluído do Auth.
                        </p>
                      </div>

                      <Button
                        type="submit"
                        variant="destructive"
                        className="w-full bg-red-600 text-white hover:bg-red-700"
                      >
                        Excluir usuário
                      </Button>
                    </form>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Logs de auditoria</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum log encontrado ainda.
            </p>
          ) : (
            auditLogs.map((log) => <AuditLogCard key={log.id} log={log} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}