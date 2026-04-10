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
  is_active: boolean;
  created_at?: string | null;
};

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "ENV ausente: NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

async function getContextOrThrow() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("Não autenticado.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("establishment_memberships")
    .select("establishment_id, role, is_active, created_at")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("Erro ao buscar membership do usuário atual:", membershipError);
    throw new Error("Erro ao validar acesso do usuário atual.");
  }

  if (!membership) {
    throw new Error("Sem acesso ao estabelecimento.");
  }

  if (membership.role !== "admin" && membership.role !== "operacao") {
    throw new Error("Apenas admin ou operação podem gerenciar usuários.");
  }

  return {
    userId: user.id,
    establishment_id: String(membership.establishment_id),
    role: String(membership.role),
  };
}

function normalizeRole(value: string): ProfileRole {
  const allowed: ProfileRole[] = [
    "admin",
    "operacao",
    "producao",
    "estoque",
    "fiscal",
    "entrega",
  ];

  if (allowed.includes(value as ProfileRole)) {
    return value as ProfileRole;
  }

  return "producao";
}

export async function listCollaborators(): Promise<Collaborator[]> {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const { data: memberships, error: memErr } = await supabaseAdmin
    .from("establishment_memberships")
    .select("user_id, role, is_active, created_at")
    .eq("establishment_id", ctx.establishment_id)
    .order("created_at", { ascending: false });

  if (memErr) {
    console.error("Erro ao listar memberships:", memErr);
    throw new Error("Erro ao listar usuários.");
  }

  const uniqueMemberships = new Map<
    string,
    { user_id: string; role: string; is_active: boolean; created_at?: string | null }
  >();

  for (const item of memberships ?? []) {
    if (!uniqueMemberships.has(item.user_id)) {
      uniqueMemberships.set(item.user_id, {
        user_id: item.user_id,
        role: item.role,
        is_active: Boolean(item.is_active),
        created_at: item.created_at ?? null,
      });
    }
  }

  const userIds = Array.from(uniqueMemberships.keys());

  if (userIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profilesErr } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name, role, sector")
    .in("id", userIds);

  if (profilesErr) {
    console.error("Erro ao listar profiles:", profilesErr);
    throw new Error("Erro ao listar usuários.");
  }

  const profilesById = new Map<
    string,
    { id: string; full_name: string; role: string; sector: string | null }
  >(
    (profiles ?? []).map((p: any) => [
      String(p.id),
      {
        id: String(p.id),
        full_name: String(p.full_name ?? ""),
        role: String(p.role ?? "producao"),
        sector: p.sector ? String(p.sector) : null,
      },
    ])
  );

  const emailById = new Map<string, string>();
  const perPage = 200;

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error("Erro ao listar usuários do Auth:", error);
      throw new Error("Erro ao listar usuários.");
    }

    for (const u of data.users) {
      if (u?.id) {
        emailById.set(String(u.id), u.email ?? "");
      }
    }

    if (data.users.length < perPage) break;
  }

  const result: Collaborator[] = userIds.map((userId) => {
    const membership = uniqueMemberships.get(userId);
    const profile = profilesById.get(userId);

    return {
      id: userId,
      email: emailById.get(userId) ?? "",
      full_name: profile?.full_name ?? "",
      role: normalizeRole(String(membership?.role ?? profile?.role ?? "producao")),
      sector: profile?.sector ?? null,
      is_active: Boolean(membership?.is_active ?? false),
      created_at: membership?.created_at ?? null,
    };
  });

  result.sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  return result;
}

export async function createCollaborator(formData: FormData) {
  const ctx = await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const full_name = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "").trim();
  const role = normalizeRole(String(formData.get("role") ?? "").trim());

  const sectorRaw = String(formData.get("sector") ?? "").trim();
  const sector = sectorRaw.length > 0 ? sectorRaw : null;

  if (!full_name || !email || !password || !role) {
    throw new Error("Preencha nome, e-mail, senha e papel.");
  }

  if (password.length < 6) {
    throw new Error("A senha inicial deve ter pelo menos 6 caracteres.");
  }

  const { data: userResp, error: userErr } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

  if (userErr || !userResp?.user) {
    console.error("Erro ao criar usuário no Auth:", userErr);
    throw new Error(userErr?.message ?? "Erro ao criar usuário.");
  }

  const userId = userResp.user.id;

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

export async function updateCollaborator(formData: FormData) {
  await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const userId = String(formData.get("user_id") ?? "").trim();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = normalizeRole(String(formData.get("role") ?? "").trim());
  const sectorRaw = String(formData.get("sector") ?? "").trim();
  const sector = sectorRaw.length > 0 ? sectorRaw : null;
  const is_active = String(formData.get("is_active") ?? "").trim() === "true";
  const establishmentId = String(formData.get("establishment_id") ?? "").trim();

  if (!userId || !full_name || !role || !establishmentId) {
    throw new Error("Dados obrigatórios do usuário não informados.");
  }

  const { error: profileErr } = await supabaseAdmin
    .from("profiles")
    .update({
      full_name,
      role,
      sector,
    })
    .eq("id", userId);

  if (profileErr) {
    console.error("Erro ao atualizar profile:", profileErr);
    throw new Error("Não foi possível atualizar o perfil do usuário.");
  }

  const { error: membershipErr } = await supabaseAdmin
    .from("establishment_memberships")
    .update({
      role,
      is_active,
    })
    .eq("establishment_id", establishmentId)
    .eq("user_id", userId);

  if (membershipErr) {
    console.error("Erro ao atualizar membership:", membershipErr);
    throw new Error("Não foi possível atualizar o acesso do usuário.");
  }

  revalidatePath("/dashboard/admin/usuarios");
}

export async function resetCollaboratorPassword(formData: FormData) {
  await getContextOrThrow();
  const supabaseAdmin = getSupabaseAdmin();

  const userId = String(formData.get("user_id") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!userId || !password) {
    throw new Error("Usuário e nova senha são obrigatórios.");
  }

  if (password.length < 6) {
    throw new Error("A nova senha deve ter pelo menos 6 caracteres.");
  }

  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    console.error("Erro ao redefinir senha:", error);
    throw new Error(error.message ?? "Não foi possível redefinir a senha.");
  }

  revalidatePath("/dashboard/admin/usuarios");
}