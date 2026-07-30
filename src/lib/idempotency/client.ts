"use client";

export function createClientIdempotencyKey(prefix: string) {
  const cleanPrefix = String(prefix || "operation")
    .trim()
    .replace(/[^a-zA-Z0-9._:-]/g, "-")
    .slice(0, 60);

  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${cleanPrefix}:${random}`;
}
