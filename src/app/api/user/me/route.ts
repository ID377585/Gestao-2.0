import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { getCompanySubscriptionStatusWithClient } from "@/lib/billing/subscription-status";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TENANT_COOKIE_NAME } from "@/lib/tenant/constants";
import { listCurrentUserTenantsForUser } from "@/lib/tenant/get-current-tenant";

export const dynamic = "force-dynamic";

const LEGACY_AVATAR_MARKER = "/storage/v1/object/public/avatars/";

function buildDisplayName(params: {
  profileName?: string | null;
  metadataName?: string | null;
  email?: string | null;
}) {
  const profileName = String(params.profileName ?? "").trim();
  if (profileName) return profileName;

  const metadataName = String(params.metadataName ?? "").trim();
  if (metadataName) return metadataName;

  const email = String(params.email ?? "").trim();
  if (email.includes("@")) {
    return email.split("@")[0];
  }

  return "Usuário";
}

function extractLegacyAvatarPath(value?: string | null) {
  const source = String(value ?? "").trim();
  const markerIndex = source.indexOf(LEGACY_AVATAR_MARKER);
  if (markerIndex < 0) return null;

  const encodedPath = source
    .slice(markerIndex + LEGACY_AVATAR_MARKER.length)
    .split("?")[0];
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

function isLegacyInternalAvatarUrl(value?: string | null) {
  return String(value ?? "").includes(LEGACY_AVATAR_MARKER);
}

function firstExternalAvatarUrl(values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = String(value ?? "").trim();
    if (normalized && !isLegacyInternalAvatarUrl(normalized)) return normalized;
  }

  return null;
}

function buildAvatarProxyUrl(updatedAt?: string | null) {
  const version = encodeURIComponent(String(updatedAt ?? "1"));
  return `/api/user/avatar?v=${version}`;
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

export async function GET(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "api:user:me",
      limit: 120,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return noStoreJson({ error: "Não autenticado." }, 401);
    }

    const [{ data: profile, error: profileError }, tenants] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id, full_name, role, sector, avatar_path, avatar_url, avatar_updated_at"
        )
        .eq("id", user.id)
        .maybeSingle(),
      listCurrentUserTenantsForUser(supabase, user.id),
    ]);

    if (profileError) {
      console.error("[api:user:me] falha ao consultar o perfil.");
      return noStoreJson({ error: "Não foi possível carregar o perfil." }, 500);
    }

    const cookieStore = await cookies();
    const selectedEstablishmentId =
      cookieStore.get(TENANT_COOKIE_NAME)?.value ?? null;

    const membership = selectedEstablishmentId
      ? tenants.find(
          (tenant) => tenant.establishment_id === selectedEstablishmentId
        ) ?? null
      : tenants[0] ?? null;

    const establishmentId = membership?.establishment_id ?? null;
    const establishmentName =
      membership?.display_name ?? membership?.establishment_name ?? null;

    const subscription = establishmentId
      ? await getCompanySubscriptionStatusWithClient(supabase, establishmentId)
      : null;

    const profileAvatarUrl = ((profile as any)?.avatar_url as string | null) ?? null;
    const metadataAvatarUrl =
      ((user.user_metadata as any)?.avatar_url as string | null) ?? null;

    const avatarPath =
      normalizeOwnAvatarPath(
        user.id,
        ((profile as any)?.avatar_path as string | null) ?? null
      ) ??
      normalizeOwnAvatarPath(
        user.id,
        ((user.user_metadata as any)?.avatar_path as string | null) ?? null
      ) ??
      normalizeOwnAvatarPath(user.id, extractLegacyAvatarPath(profileAvatarUrl)) ??
      normalizeOwnAvatarPath(user.id, extractLegacyAvatarPath(metadataAvatarUrl));

    const avatarUrl = avatarPath
      ? buildAvatarProxyUrl(
          ((profile as any)?.avatar_updated_at as string | null) ?? null
        )
      : firstExternalAvatarUrl([
          profileAvatarUrl,
          metadataAvatarUrl,
          ((user.user_metadata as any)?.picture as string | null) ?? null,
        ]);

    const payload = {
      id: user.id,
      email: user.email ?? "",
      name: buildDisplayName({
        profileName: (profile as any)?.full_name ?? null,
        metadataName: (user.user_metadata as any)?.full_name ?? null,
        email: user.email ?? null,
      }),
      role: String((membership as any)?.role ?? (profile as any)?.role ?? "user"),
      sector: ((profile as any)?.sector as string | null) ?? null,
      avatar: avatarUrl,
      establishmentId,
      establishmentName,
      orgId: (membership as any)?.org_id ?? null,
      unitId: (membership as any)?.unit_id ?? null,
      isActive: Boolean((membership as any)?.is_active ?? true),
      tenants,
      subscription,
      lastSignInAt: user.last_sign_in_at ?? null,
    };

    return noStoreJson(payload);
  } catch {
    console.error("[api:user:me] falha inesperada.");
    return noStoreJson({ error: "Erro inesperado." }, 500);
  }
}
