export type CurrentUserInfo = {
  id: string;
  email: string;
  name: string;
  role?: string;
  sector?: string | null;
  establishmentId?: string | null;
};

export async function getCurrentUserInfo(): Promise<CurrentUserInfo | null> {
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
      establishmentId: data.establishmentId ?? null,
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