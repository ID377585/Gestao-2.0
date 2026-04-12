export type UserSettings = {
  emailNotifications: boolean;
  browserNotifications: boolean;
  darkMode: boolean;
};

const STORAGE_KEY = "gestify-user-settings";
const THEME_STORAGE_KEY = "gestify-theme";

const defaultSettings: UserSettings = {
  emailNotifications: true,
  browserNotifications: true,
  darkMode: false,
};

export function getUserSettings(): UserSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultSettings;
    }

    const parsed = JSON.parse(raw) as Partial<UserSettings>;

    return {
      emailNotifications:
        parsed.emailNotifications ?? defaultSettings.emailNotifications,
      browserNotifications:
        parsed.browserNotifications ?? defaultSettings.browserNotifications,
      darkMode: parsed.darkMode ?? defaultSettings.darkMode,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveUserSettings(settings: UserSettings) {
  if (typeof window === "undefined") return;

  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  localStorage.setItem(THEME_STORAGE_KEY, settings.darkMode ? "dark" : "light");
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