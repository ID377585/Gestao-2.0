export type AppUser = {
  name: string;
  email: string;
  role: "admin" | "user";
  avatar?: string;
};

const COOKIE_NAME = "auth-session";

// Em DEV vamos guardar um token simples no cookie e os dados no localStorage.
// (Depois, com Supabase, você troca isso por sessão real.)
const LS_USER_KEY = "g2:user";

export function setSession(user: AppUser) {
  // cookie para o middleware
  document.cookie = `${COOKIE_NAME}=dev; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;

  // dados do usuário para UI
  localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
}

export function getUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppUser;
  } catch {
    return null;
  }
}

export function clearSession() {
  // remove cookie (dupla forma)
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;

  // remove user
  localStorage.removeItem(LS_USER_KEY);
}

export function isLoggedInClient(): boolean {
  // client-only check (middleware é a proteção real)
  return Boolean(getUser());
}
