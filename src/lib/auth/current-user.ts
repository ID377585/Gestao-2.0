export type CurrentUserInfo = {
  id: string;
  email: string;
  name: string;
  role?: string;
  sector?: string | null;
  avatar?: string | null;
  establishmentId?: string | null;
  establishmentName?: string | null;
  lastSignInAt?: string | null;
};

const CURRENT_USER_CACHE_MS = 10_000;

let cachedCurrentUser:
  | {
      value: CurrentUserInfo | null;
      expiresAt: number;
    }
  | null = null;

let currentUserRequest: Promise<CurrentUserInfo | null> | null = null;

export function clearCurrentUserInfoCache() {
  cachedCurrentUser = null;
  currentUserRequest = null;
}

export async function getCurrentUserInfo(options?: {
  force?: boolean;
}): Promise<CurrentUserInfo | null> {
  if (
    !options?.force &&
    cachedCurrentUser &&
    cachedCurrentUser.expiresAt > Date.now()
  ) {
    return cachedCurrentUser.value;
  }

  if (!options?.force && currentUserRequest) {
    return currentUserRequest;
  }

  currentUserRequest = fetchCurrentUserInfo();

  try {
    const value = await currentUserRequest;
    cachedCurrentUser = {
      value,
      expiresAt: Date.now() + CURRENT_USER_CACHE_MS,
    };
    return value;
  } finally {
    currentUserRequest = null;
  }
}

async function fetchCurrentUserInfo(): Promise<CurrentUserInfo | null> {
  try {
    const response = await fetch("/api/user/me", {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as CurrentUserInfo;

    if (!data?.id) {
      return null;
    }

    return {
      id: String(data.id ?? ""),
      email: String(data.email ?? ""),
      name: String(data.name ?? ""),
      role: data.role ? String(data.role) : undefined,
      sector: data.sector ?? null,
      avatar: data.avatar ?? null,
      establishmentId: data.establishmentId ?? null,
      establishmentName: data.establishmentName ?? null,
      lastSignInAt: data.lastSignInAt ?? null,
    };
  } catch (error) {
    console.error("Erro ao carregar usuário atual:", error);
    return null;
  }
}

export function buildCreatedByLabel(user: CurrentUserInfo | null) {
  if (!user) return "";

  const name = String(user.name ?? "").trim();
  const email = String(user.email ?? "").trim();

  if (name && email) {
    return `${name} <${email}>`;
  }

  if (name) return name;
  if (email) return email;

  return "";
}
