"use client";

function normalizeIdempotencyKeyPrefix(prefix: string) {
  const cleanPrefix = String(prefix || "operation")
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "-")
    .slice(0, 60);

  return cleanPrefix || "operation";
}

function createRandomSuffix() {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSessionStorageKey(scope: string) {
  return `gestify:idempotency:${normalizeIdempotencyKeyPrefix(scope).slice(
    0,
    140
  )}`;
}

export function createClientIdempotencyKey(prefix: string) {
  const cleanPrefix = normalizeIdempotencyKeyPrefix(prefix);

  return `${cleanPrefix}:${createRandomSuffix()}`;
}

export function getStableClientIdempotencyKey(scope: string, prefix = scope) {
  const storageKey = getSessionStorageKey(scope);

  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) return existing;

    const next = createClientIdempotencyKey(prefix);
    window.sessionStorage.setItem(storageKey, next);
    return next;
  } catch {
    return createClientIdempotencyKey(prefix);
  }
}

export function clearStableClientIdempotencyKey(scope: string) {
  try {
    window.sessionStorage.removeItem(getSessionStorageKey(scope));
  } catch {}
}
