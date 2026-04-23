export const COOKIE_CONSENT_STORAGE_KEY = "gestify.cookie-consent.v1";
export const COOKIE_CONSENT_EVENT = "gestify:cookie-consent-change";
export const COOKIE_CONSENT_OPEN_EVENT = "gestify:cookie-consent-open";

export type CookieConsentPreferences = {
  necessary: true;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  updatedAt: string;
};

const DEFAULT_COOKIE_CONSENT: CookieConsentPreferences = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  updatedAt: "",
};

const PUBLIC_COOKIE_BANNER_PATHS = new Set([
  "/",
  "/login",
  "/forgot-password",
  "/reset-password",
  "/politica-de-privacidade",
  "/termos-de-uso",
  "/politica-de-cookies",
  "/acessibilidade",
]);

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeCookieConsent(
  value?: Partial<CookieConsentPreferences> | null
): CookieConsentPreferences {
  return {
    necessary: true,
    functional: Boolean(value?.functional),
    analytics: Boolean(value?.analytics),
    marketing: Boolean(value?.marketing),
    updatedAt: value?.updatedAt || new Date().toISOString(),
  };
}

function dispatchCookieConsentEvent(preferences: CookieConsentPreferences) {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_EVENT, {
      detail: preferences,
    })
  );
}

export function getDefaultCookieConsent(): CookieConsentPreferences {
  return normalizeCookieConsent(DEFAULT_COOKIE_CONSENT);
}

export function shouldRenderCookieBanner(pathname: string | null) {
  return pathname ? PUBLIC_COOKIE_BANNER_PATHS.has(pathname) : false;
}

export function readCookieConsentPreferences(): CookieConsentPreferences | null {
  if (!isBrowser()) return null;

  try {
    const rawValue = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!rawValue) return null;

    const parsedValue = JSON.parse(rawValue) as Partial<CookieConsentPreferences>;
    return normalizeCookieConsent(parsedValue);
  } catch {
    return null;
  }
}

export function hasCookieConsentDecision() {
  return Boolean(readCookieConsentPreferences());
}

export function writeCookieConsentPreferences(
  value: Partial<CookieConsentPreferences>
) {
  const normalizedValue = normalizeCookieConsent(value);

  if (!isBrowser()) return normalizedValue;

  window.localStorage.setItem(
    COOKIE_CONSENT_STORAGE_KEY,
    JSON.stringify(normalizedValue)
  );
  dispatchCookieConsentEvent(normalizedValue);

  return normalizedValue;
}

export function acceptOptionalCookies() {
  return writeCookieConsentPreferences({
    functional: true,
    analytics: true,
    marketing: true,
  });
}

export function rejectOptionalCookies() {
  return writeCookieConsentPreferences({
    functional: false,
    analytics: false,
    marketing: false,
  });
}

export function requestCookiePreferencesPanel(options?: {
  expandPreferences?: boolean;
}) {
  if (!isBrowser()) return;

  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_OPEN_EVENT, {
      detail: {
        expandPreferences: Boolean(options?.expandPreferences),
      },
    })
  );
}
