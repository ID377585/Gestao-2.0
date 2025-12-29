import { revalidatePath } from "next/cache";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

/**
 * Papéis permitidos para colaboradores
 */
type ProfileRole =
  | "admin"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "entrega";

const ROLE_LABEL: Record<ProfileRole, string> = {
  admin: "Admin",
  operacao: "Operação",
  producao: "Produção",
  estoque: "Estoque",
  fiscal: "Fiscal",
  entrega: "Entrega",
};

/**
 * Carrega colaboradores da tabela (por exemplo, kds_collaborators)
 * usando o client de servidor (anon key + RLS).
 */
async function listCollaborators() {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("kds_collaborators")
    .select("id, full_name, email, role, sector")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar colaboradores:", error);
    return [];
  }

  return data ?? [];
}

/**
 * Lógica de criação de colaborador a partir do FormData.
 * Não usa service role, apenas grava na tabela de colaboradores.
 * Se você depois quiser realmente criar usuários de autenticação,
 * dá pra evoluir isso separadamente.
 */
async function createCollaboratorFromForm(formData: FormData) {
  // Garante que só quem tem membership ativo acessa
  const membership = await getActiveMembershipOrRedirect();

  // Exemplo de restrição: apenas admin/operacao podem criar usuários
  if (membership.role !== "admin" && membership.role !== "operacao") {
    throw new Error("Apenas admin ou operação podem criar colaboradores.");
  }

  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const role = String(formData.get("role") ?? "producao") as ProfileRole;

  const sectorRaw = formData.get("sector");
  const sector =
    typeof sectorRaw === "string" && sectorRaw.trim().length > 0
      ? sectorRaw.trim()
      : null;

  if (!full_name || !email || !password) {
    throw new Error("Nome, e-mail e senha são obrigatórios.");
  }

  const supabase = await createSupabaseServerClient();

  // Opcional: checar se já existe colaborador com esse e-mail
  const { data: existing, error: existingError } = await supabase
    .from("kds_collaborators")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    console.error("Erro ao verificar colaborador existente:", existingError);
    throw new Error("Erro ao verificar colaborador existente.");
  }

  if (existing) {
    throw new Error("Já existe um colaborador cadastrado com este e-mail.");
  }

  // Aqui estamos apenas criando o registro de colaborador.
  // Se quiser integrar com auth, depois dá pra criar usuário separado.
  const { error } = await supabase.from("kds_collaborators").insert({
    full_name,
    email,
    role,
    sector,
  });

  if (error) {
    console.error("Erro ao salvar colaborador:", error);
    throw new Error("Erro ao salvar colaborador.");
  }

  // Revalida a página de usuários para refletir a nova lista
  revalidatePath("/dashboard/admin/usuarios");
}

export default async function UsuariosPage() {
  const collaborators = await listCollaborators();

  // Server Action usada pelo <form action={handleCreate}>
  async function handleCreate(formData: FormData) {
    "use server";
    await createCollaboratorFromForm(formData);
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Gestão de Usuários
        </h1>
        <p className="text-sm text-muted-foreground">
          Cadastre colaboradores e gerencie quem pode atuar nos módulos de
          Produção, Produtividade, Estoque, Entrega etc.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Card: Novo colaborador */}
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
                  placeholder="ana@gestao2.com"
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
                <p className="text-xs text-muted-foreground">
                  (Por enquanto esta senha é apenas referência interna; a
                  criação do usuário de login pode ser configurada depois.)
                </p>
              </div>

              <div className="space-y-1">
                <Label htmlFor="role">Papel</Label>
                <select
                  id="role"
                  name="role"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
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
                  placeholder="Ex.: Confeitaria, Cozinha Quente, Logística..."
                />
              </div>

              <Button type="submit" className="w-full">
                Salvar colaborador
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Card: Lista de colaboradores */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usuários</CardTitle>
          </CardHeader>
          <CardContent>
            {collaborators.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum colaborador cadastrado ainda. Use o formulário ao lado
                para criar o primeiro.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-2">Nome</th>
                      <th className="py-2 pr-2">E-mail</th>
                      <th className="py-2 pr-2">Papel</th>
                      <th className="py-2 pr-2">Setor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collaborators.map((colab: any) => (
                      <tr
                        key={colab.id}
                        className="border-b last:border-0 align-top"
                      >
                        <td className="py-2 pr-2 font-medium">
                          {colab.full_name}
                        </td>
                        <td className="py-2 pr-2 text-xs text-muted-foreground">
                          {colab.email}
                        </td>
                        <td className="py-2 pr-2">
                          <Badge variant="outline">
                            {ROLE_LABEL[colab.role as ProfileRole]}
                          </Badge>
                        </td>
                        <td className="py-2 pr-2 text-xs text-muted-foreground">
                          {colab.sector ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
