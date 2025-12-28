"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Mesmo conjunto de papéis que você já usa no sistema
export type ProfileRole =
  | "admin"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "entrega";

export type Collaborator = {
  id: string;
  email: string;
  full_name: string;
  role: ProfileRole;
  sector: string | null;
};

// 🔹 Lista usuários + perfis (para usar na tela)
export async function listCollaborators(): Promise<Collaborator[]> {
  // 1) Busca perfis
  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, sector")
    .order("full_name", { ascending: true });

  if (profilesErr) {
    console.error("Erro ao listar perfis:", profilesErr);
    throw new Error("Erro ao listar colaboradores");
  }

  const profilesById = new Map<
    string,
    { id: string; full_name: string; role: string; sector: string | null }
  >(
    (profiles ?? []).map((p: any) => [
      p.id,
      {
        id: p.id,
        full_name: p.full_name,
        role: p.role,
        sector: p.sector ?? null,
      },
    ])
  );

  // 2) Busca usuários do auth (para pegar e-mail)
  const { data: usersList, error: usersErr } =
    await supabaseAdmin.auth.admin.listUsers();
  if (usersErr) {
    console.error("Erro ao listar usuários auth:", usersErr);
    throw new Error("Erro ao listar colaboradores");
  }

  const result: Collaborator[] = [];

  for (const user of usersList.users) {
    const profile = profilesById.get(user.id);
    if (!profile) {
      // Usuário sem perfil ainda -> ignora por enquanto
      continue;
    }

    result.push({
      id: user.id,
      email: user.email ?? "",
      full_name: profile.full_name,
      role: profile.role as ProfileRole,
      sector: profile.sector,
    });
  }

  return result;
}

// 🔹 Cria usuário + perfil de colaborador
export async function createCollaborator(formData: FormData) {
  "use server";

  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "").trim() as ProfileRole;
  const sectorRaw = String(formData.get("sector") ?? "").trim();
  const sector = sectorRaw.length > 0 ? sectorRaw : null;

  if (!full_name || !email || !password || !role) {
    throw new Error("Preencha Nome, E-mail, Senha e Papel.");
  }

  // 1) Cria o usuário no auth (não mexe na sessão atual pois usa service role)
  const { data: userResp, error: userErr } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        sector,
      },
    });

  if (userErr || !userResp?.user) {
    console.error("Erro ao criar usuário:", userErr);
    throw new Error(userErr?.message ?? "Erro ao criar usuário");
  }

  const userId = userResp.user.id;

  // 2) Cria o perfil vinculado
  const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
    id: userId,
    full_name,
    role,
    sector,
  });

  if (profileErr) {
    console.error("Erro ao criar perfil:", profileErr);
    throw new Error("Usuário criado, mas falhou ao salvar o perfil.");
  }

  // 3) Revalida a página de usuários
  revalidatePath("/dashboard/admin/usuarios");
}
