export type AppRole =
  | "admin"
  | "user"
  | "cliente"
  | "operacao"
  | "producao"
  | "estoque"
  | "fiscal"
  | "entrega";

export type AppUser = {
  id?: string;
  name: string;
  email: string;
  role?: AppRole;
  avatar?: string;
  sector?: string | null;
};

const COOKIE_NAME = "auth-session";
const LS_USER_KEY = "g2:user";

export function setSession(user: AppUser) {
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_NAME}=dev; path=/; max-age=${
      60 * 60 * 24
    }; SameSite=Lax`;
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
  }
}

export function getUser(): AppUser | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export function clearSession() {
  if (typeof document !== "undefined") {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
    document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }

  if (typeof window !== "undefined") {
    localStorage.removeItem(LS_USER_KEY);
  }
}

export function isLoggedInClient(): boolean {
  return Boolean(getUser());
}