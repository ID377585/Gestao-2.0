export type UserSettings = {
  emailNotifications: boolean;
  browserNotifications: boolean;
  darkMode: boolean;
};

const STORAGE_KEY = "gestify:user-settings";

const defaultSettings: UserSettings = {
  emailNotifications: true,
  browserNotifications: true,
  darkMode: false,
};

export function getUserSettings(): UserSettings {
  if (typeof window === "undefined") return defaultSettings;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;

    const parsed = JSON.parse(raw) as Partial<UserSettings>;

    return {
      emailNotifications:
        typeof parsed.emailNotifications === "boolean"
          ? parsed.emailNotifications
          : defaultSettings.emailNotifications,
      browserNotifications:
        typeof parsed.browserNotifications === "boolean"
          ? parsed.browserNotifications
          : defaultSettings.browserNotifications,
      darkMode:
        typeof parsed.darkMode === "boolean"
          ? parsed.darkMode
          : defaultSettings.darkMode,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveUserSettings(settings: UserSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function applyDarkMode(enabled: boolean) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;

  if (enabled) {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}