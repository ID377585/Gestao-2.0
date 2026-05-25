export type UserSettings = {
  emailNotifications: boolean;
  browserNotifications: boolean;
  soundNotifications: boolean;
  darkMode: boolean;
};

const STORAGE_KEY = "gestify-user-settings";
const THEME_STORAGE_KEY = "gestify-theme";

export const DEFAULT_USER_SETTINGS: UserSettings = {
  emailNotifications: true,
  browserNotifications: true,
  soundNotifications: true,
  darkMode: false,
};

function normalizeSettings(
  parsed?: Partial<UserSettings> | null
): UserSettings {
  return {
    emailNotifications:
      parsed?.emailNotifications ?? DEFAULT_USER_SETTINGS.emailNotifications,
    browserNotifications:
      parsed?.browserNotifications ?? DEFAULT_USER_SETTINGS.browserNotifications,
    soundNotifications:
      parsed?.soundNotifications ?? DEFAULT_USER_SETTINGS.soundNotifications,
    darkMode: parsed?.darkMode ?? DEFAULT_USER_SETTINGS.darkMode,
  };
}

export function getUserSettings(): UserSettings {
  if (typeof window === "undefined") {
    return DEFAULT_USER_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return DEFAULT_USER_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings) {
  if (typeof window === "undefined") return;

  const normalized = normalizeSettings(settings);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  localStorage.setItem(
    THEME_STORAGE_KEY,
    normalized.darkMode ? "dark" : "light"
  );
}

export function applyDarkMode(enabled: boolean) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;

  if (enabled) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  localStorage.setItem(THEME_STORAGE_KEY, enabled ? "dark" : "light");
}

export function initializeTheme() {
  if (typeof window === "undefined") return;

  const settings = getUserSettings();
  applyDarkMode(settings.darkMode);
}

export async function fetchUserSettingsFromApi(): Promise<UserSettings> {
  try {
    const response = await fetch("/api/user/notification-preferences", {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return getUserSettings();
    }

    const data = (await response.json()) as Partial<UserSettings>;
    const merged = normalizeSettings(data);

    saveUserSettings(merged);
    applyDarkMode(merged.darkMode);

    return merged;
  } catch {
    return getUserSettings();
  }
}

export async function persistUserSettingsToApi(
  settings: UserSettings
): Promise<UserSettings> {
  const normalized = normalizeSettings(settings);

  saveUserSettings(normalized);
  applyDarkMode(normalized.darkMode);

  try {
    const response = await fetch("/api/user/notification-preferences", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(normalized),
    });

    if (!response.ok) {
      return normalized;
    }

    const data = (await response.json()) as Partial<UserSettings>;
    const merged = normalizeSettings(data);

    saveUserSettings(merged);
    applyDarkMode(merged.darkMode);

    return merged;
  } catch {
    return normalized;
  }
}

export async function syncUserSettingsWithServer(): Promise<UserSettings> {
  const local = getUserSettings();

  try {
    const remote = await fetchUserSettingsFromApi();
    return normalizeSettings(remote);
  } catch {
    return local;
  }
}
