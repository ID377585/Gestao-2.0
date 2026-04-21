import { supabase } from "@/lib/supabase/client";

export function getLegacySupabase() {
  return supabase;
}

export function createLegacyId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function toIsoString(value?: string | null) {
  return value ?? "";
}

export function toNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;
  return Boolean(value);
}

export function toText(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (value == null) return fallback;
  return String(value);
}

export function assertSupabaseSuccess(error: { message?: string } | null, message: string) {
  if (!error) return;
  throw new Error(`${message}: ${error.message ?? "erro desconhecido"}`);
}
