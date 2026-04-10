import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import {
  createCollaborator,
  listCollaborators,
  resetCollaboratorPassword,
  updateCollaborator,
  type ProfileRole,
} from "./actions";

const ROLE_LABEL: Record<ProfileRole, string> = {
  admin: "Admin",
  operacao: "Operação",
  producao: "Produção",
  estoque: "Estoque",
  fiscal: "Fiscal",
  entrega: "Entrega",
};

export default async function UsuariosPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Gestão de Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre colaboradores, veja quem já tem acesso ao sistema e ajuste papéis,
          setor, status de acesso e senha.
        </p>
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
          <CardHeader>
            <CardTitle className="text-lg">Usuários com acesso</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum colaborador cadastrado ainda.
              </p>
            ) : (
              collaborators.map((colab) => (
                <div key={colab.id} className="rounded-xl border p-4">
                  <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{colab.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {colab.email || "Sem e-mail"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{ROLE_LABEL[colab.role]}</Badge>
                      <Badge variant={colab.is_active ? "default" : "secondary"}>
                        {colab.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
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

                    <form action={handleResetPassword} className="space-y-3 rounded-lg border p-4">
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
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}