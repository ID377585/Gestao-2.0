"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "ENV ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY (Vercel)."
    );
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}

async function getContextOrThrow() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) throw new Error("Não autenticado.");

  // Fonte única: establishment_memberships (precisa RLS select own membership)
  const { data: membership, error: membershipError } = await supabase
    .from("establishment_memberships")
    .select("establishment_id, role, is_active, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    throw new Error("Sem acesso (membership).");
  }

  if (membership.role !== "admin" && membership.role !== "operacao") {
    throw new Error("Apenas admin ou operação podem gerenciar colaboradores.");
  }

  return {
    userId: user.id,
    establishment_id: membership.establishment_id as string,
    role: membership.role as string,
  };
}

// Lista colaboradores do ESTABELECIMENTO (profiles + membership) + email do Auth
export async function listCollaborators(): Promise<Collaborator[]> {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  // 1) Memberships do estabelecimento
  const { data: memberships, error: memErr } = await supabaseAdmin
    .from("establishment_memberships")
    .select("user_id, role, is_active")
    .eq("establishment_id", ctx.establishment_id)
    .eq("is_active", true);

  if (memErr) {
    console.error("Erro ao listar memberships:", memErr);
    throw new Error("Erro ao listar colaboradores.");
  }

  const userIds = (memberships ?? []).map((m: any) => m.user_id);
  if (userIds.length === 0) return [];

  // 2) Profiles
  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, sector")
    .in("id", userIds)
    .order("full_name", { ascending: true });

  if (profilesErr) {
    console.error("Erro ao listar profiles:", profilesErr);
    throw new Error("Erro ao listar colaboradores.");
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

  // 3) Auth users (email) - com paginação (evita perder emails se tiver mais usuários)
  const emailById = new Map<string, string>();
  const perPage = 200;
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("Erro ao listar usuários auth:", error);
      throw new Error("Erro ao listar colaboradores.");
    }

    for (const u of data.users) {
      if (u?.id) emailById.set(u.id, u.email ?? "");
    }

    if (data.users.length < perPage) break;
  }

  const result: Collaborator[] = [];

  for (const userId of userIds) {
    const profile = profilesById.get(userId);
    if (!profile) continue;

    result.push({
      id: userId,
      email: emailById.get(userId) ?? "",
      full_name: profile.full_name ?? "",
      role: (profile.role ?? "producao") as ProfileRole,
      sector: profile.sector,
    });
  }

  result.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  return result;
}

// Cria usuário (Auth) + profile + membership no estabelecimento
export async function createCollaborator(formData: FormData) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim() as ProfileRole;

  const sectorRaw = String(formData.get("sector") ?? "").trim();
  const sector = sectorRaw.length > 0 ? sectorRaw : null;

  if (!full_name || !email || !password || !role) {
    throw new Error("Preencha Nome, E-mail, Senha e Papel.");
  }

  // 1) Cria o usuário no Auth
  const { data: userResp, error: userErr } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

  if (userErr || !userResp?.user) {
    console.error("Erro ao criar usuário (auth):", userErr);
    throw new Error(userErr?.message ?? "Erro ao criar usuário.");
  }

  const userId = userResp.user.id;

  // 2) Upsert do profile (evita quebrar se já existir por algum motivo)
  const { error: profileErr } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      full_name,
      role,
      sector,
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    console.error("Erro ao salvar profile:", profileErr);
    throw new Error("Usuário criado, mas falhou ao salvar o perfil.");
  }

  // 3) Upsert do membership (evita duplicate key)
  const { error: membershipErr } = await supabaseAdmin
    .from("establishment_memberships")
    .upsert(
      {
        establishment_id: ctx.establishment_id,
        user_id: userId,
        role,
        is_active: true,
      },
      { onConflict: "establishment_id,user_id" }
    );

  if (membershipErr) {
    console.error("Erro ao salvar membership:", membershipErr);
    throw new Error(
      "Usuário criado, mas falhou ao vincular ao estabelecimento."
    );
  }

  revalidatePath("/dashboard/admin/usuarios");
}
