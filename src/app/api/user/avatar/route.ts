import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const AVATAR_BUCKET = "avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 5 * 60;

type AvatarProfile = {
  avatar_path?: string | null;
  avatar_url?: string | null;
  avatar_updated_at?: string | null;
};

function jsonNoStore(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

function requestOrigins(request: Request) {
  const origins = new Set<string>();

  try {
    origins.add(new URL(request.url).origin);
  } catch {
    // Invalid request URLs are rejected by the framework before this route.
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost) origins.add(`${forwardedProto}://${forwardedHost}`);

  const host = request.headers.get("host")?.trim();
  if (host) {
    const protocol = host.startsWith("localhost") ? "http" : forwardedProto;
    origins.add(`${protocol}://${host}`);
  }

  return origins;
}

function isSameOriginMutation(request: Request) {
  const allowedOrigins = requestOrigins(request);
  const origin = request.headers.get("origin")?.trim();

  if (origin) return allowedOrigins.has(origin);

  const fetchSite = request.headers.get("sec-fetch-site")?.trim();
  if (fetchSite && fetchSite !== "same-origin") return false;

  const referer = request.headers.get("referer")?.trim();
  if (!referer) return false;

  try {
    return allowedOrigins.has(new URL(referer).origin);
  } catch {
    return false;
  }
}

function extractLegacyAvatarPath(value?: string | null) {
  const source = String(value ?? "").trim();
  const marker = "/storage/v1/object/public/avatars/";
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) return null;

  const encodedPath = source.slice(markerIndex + marker.length).split("?")[0] ?? "";
  if (!encodedPath) return null;

  try {
    return decodeURIComponent(encodedPath);
  } catch {
    return encodedPath;
  }
}

function normalizeOwnAvatarPath(userId: string, value?: string | null) {
  const path = String(value ?? "").trim().replace(/^\/+/, "");
  if (!path || path.includes("..") || !path.startsWith(`${userId}/`)) return null;
  return path;
}

function resolveAvatarPath(userId: string, profile?: AvatarProfile | null) {
  return (
    normalizeOwnAvatarPath(userId, profile?.avatar_path) ??
    normalizeOwnAvatarPath(userId, extractLegacyAvatarPath(profile?.avatar_url))
  );
}

function avatarProxyUrl(updatedAt?: string | null) {
  const version = encodeURIComponent(String(updatedAt ?? Date.now()));
  return `/api/user/avatar?v=${version}`;
}

async function getAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return { supabase, user: null };
  return { supabase, user };
}

async function getAvatarProfile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string
) {
  return supabase
    .from("profiles")
    .select("avatar_path, avatar_url, avatar_updated_at")
    .eq("id", userId)
    .maybeSingle();
}

async function removeAvatarObjects(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  keepPath?: string | null;
  fallbackPath?: string | null;
}) {
  const stalePaths = new Set<string>();
  const keepPath = normalizeOwnAvatarPath(params.userId, params.keepPath);
  const fallbackPath = normalizeOwnAvatarPath(params.userId, params.fallbackPath);

  if (fallbackPath && fallbackPath !== keepPath) stalePaths.add(fallbackPath);

  const { data: objects, error: listError } = await params.supabase.storage
    .from(AVATAR_BUCKET)
    .list(params.userId, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });

  if (listError) {
    console.warn("[user-avatar] não foi possível listar avatares antigos.");
  } else {
    for (const object of objects ?? []) {
      const objectPath = `${params.userId}/${object.name}`;
      if (object.name && objectPath !== keepPath) stalePaths.add(objectPath);
    }
  }

  if (stalePaths.size === 0) return;

  const { error: removeError } = await params.supabase.storage
    .from(AVATAR_BUCKET)
    .remove(Array.from(stalePaths));

  if (removeError) {
    console.warn("[user-avatar] não foi possível remover todos os avatares antigos.");
  }
}

export async function GET(request: Request) {
  const limited = rateLimit(request, {
    key: "api:user:avatar:read",
    limit: 180,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return jsonNoStore({ error: "Não autenticado." }, 401);

    const userLimited = rateLimit(request, {
      key: "api:user:avatar:read:user",
      identifier: user.id,
      limit: 180,
      windowMs: 60_000,
    });
    if (userLimited) return userLimited;

    const { data: profile, error: profileError } = await getAvatarProfile(
      supabase,
      user.id
    );

    if (profileError) {
      console.error("[user-avatar] falha ao consultar o perfil.");
      return jsonNoStore({ error: "Foto indisponível." }, 404);
    }

    const avatarPath = resolveAvatarPath(user.id, profile as AvatarProfile | null);
    if (!avatarPath) return jsonNoStore({ error: "Foto não encontrada." }, 404);

    const { data, error } = await supabase.storage
      .from(AVATAR_BUCKET)
      .createSignedUrl(avatarPath, SIGNED_URL_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      console.error("[user-avatar] falha ao assinar a foto privada.");
      return jsonNoStore({ error: "Foto indisponível." }, 404);
    }

    const response = NextResponse.redirect(data.signedUrl, 302);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  } catch {
    console.error("[user-avatar] falha inesperada ao carregar a foto.");
    return jsonNoStore({ error: "Foto indisponível." }, 500);
  }
}

export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return jsonNoStore({ error: "Origem da requisição não autorizada." }, 403);
  }

  const limited = rateLimit(request, {
    key: "api:user:avatar:write",
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;

  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return jsonNoStore({ error: "Não autenticado." }, 401);

    const userLimited = rateLimit(request, {
      key: "api:user:avatar:write:user",
      identifier: user.id,
      limit: 10,
      windowMs: 10 * 60_000,
    });
    if (userLimited) return userLimited;

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return jsonNoStore({ error: "Arquivo de imagem inválido." }, 400);
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return jsonNoStore({ error: "Arquivo de imagem não informado." }, 400);
    }

    if (
      file.size <= 0 ||
      file.size > MAX_AVATAR_BYTES ||
      file.type.toLowerCase() !== "image/jpeg"
    ) {
      return jsonNoStore(
        { error: "A foto processada precisa ser JPEG e ter até 2 MB." },
        400
      );
    }

    const signature = new Uint8Array(await file.slice(0, 3).arrayBuffer());
    if (signature[0] !== 0xff || signature[1] !== 0xd8 || signature[2] !== 0xff) {
      return jsonNoStore({ error: "O conteúdo enviado não é um JPEG válido." }, 400);
    }

    const { data: previousProfile, error: previousProfileError } =
      await getAvatarProfile(supabase, user.id);

    if (previousProfileError || !previousProfile) {
      console.error("[user-avatar] perfil ausente ou indisponível para atualização.");
      return jsonNoStore({ error: "Não foi possível atualizar a foto." }, 409);
    }

    const previousPath = resolveAvatarPath(
      user.id,
      previousProfile as AvatarProfile
    );
    const avatarPath = `${user.id}/avatar-${Date.now()}-${randomUUID()}.jpg`;
    const changedAt = new Date().toISOString();

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(avatarPath, file, {
        cacheControl: "300",
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("[user-avatar] falha no upload validado.");
      return jsonNoStore({ error: "Não foi possível enviar a foto." }, 500);
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({
        avatar_path: avatarPath,
        avatar_url: null,
        avatar_updated_at: changedAt,
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (profileError || !updatedProfile) {
      await supabase.storage.from(AVATAR_BUCKET).remove([avatarPath]);
      console.error("[user-avatar] falha ao vincular o objeto ao perfil.");
      return jsonNoStore({ error: "Não foi possível atualizar a foto." }, 500);
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        avatar_path: avatarPath,
        avatar_url: null,
      },
    });

    if (metadataError) {
      console.warn("[user-avatar] perfil atualizado, mas metadata do Auth não sincronizou.");
    }

    await removeAvatarObjects({
      supabase,
      userId: user.id,
      keepPath: avatarPath,
      fallbackPath: previousPath,
    });

    return jsonNoStore(
      {
        avatar: avatarProxyUrl(changedAt),
        updatedAt: changedAt,
      },
      200
    );
  } catch {
    console.error("[user-avatar] falha inesperada ao atualizar a foto.");
    return jsonNoStore({ error: "Não foi possível atualizar a foto." }, 500);
  }
}

export async function DELETE(request: Request) {
  if (!isSameOriginMutation(request)) {
    return jsonNoStore({ error: "Origem da requisição não autorizada." }, 403);
  }

  const limited = rateLimit(request, {
    key: "api:user:avatar:delete",
    limit: 20,
    windowMs: 10 * 60_000,
  });
  if (limited) return limited;

  try {
    const { supabase, user } = await getAuthenticatedUser();
    if (!user) return jsonNoStore({ error: "Não autenticado." }, 401);

    const userLimited = rateLimit(request, {
      key: "api:user:avatar:delete:user",
      identifier: user.id,
      limit: 10,
      windowMs: 10 * 60_000,
    });
    if (userLimited) return userLimited;

    const { data: profile, error: profileReadError } = await getAvatarProfile(
      supabase,
      user.id
    );

    if (profileReadError || !profile) {
      console.error("[user-avatar] falha ao localizar o perfil para remoção.");
      return jsonNoStore({ error: "Não foi possível remover a foto." }, 409);
    }

    const previousPath = resolveAvatarPath(user.id, profile as AvatarProfile);
    const changedAt = new Date().toISOString();

    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({
        avatar_path: null,
        avatar_url: null,
        avatar_updated_at: changedAt,
      })
      .eq("id", user.id)
      .select("id")
      .maybeSingle();

    if (profileError || !updatedProfile) {
      console.error("[user-avatar] falha ao remover o vínculo do perfil.");
      return jsonNoStore({ error: "Não foi possível remover a foto." }, 500);
    }

    const { error: metadataError } = await supabase.auth.updateUser({
      data: {
        avatar_path: null,
        avatar_url: null,
      },
    });

    if (metadataError) {
      console.warn("[user-avatar] foto removida, mas metadata do Auth não sincronizou.");
    }

    await removeAvatarObjects({
      supabase,
      userId: user.id,
      keepPath: null,
      fallbackPath: previousPath,
    });

    return jsonNoStore({ avatar: null, updatedAt: changedAt }, 200);
  } catch {
    console.error("[user-avatar] falha inesperada ao remover a foto.");
    return jsonNoStore({ error: "Não foi possível remover a foto." }, 500);
  }
}
