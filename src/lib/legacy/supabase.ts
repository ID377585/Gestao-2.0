import { supabase } from "@/lib/supabase/client";

type LegacyPayload = Record<string, unknown> | Record<string, unknown>[];
type LegacyScopedQuery<T extends object> = Omit<T, "then"> & {
  query: T;
};

let cachedTenant:
  | {
      establishmentId: string;
      expiresAt: number;
    }
  | null = null;

const LEGACY_TENANT_CACHE_MS = 5_000;

export function getLegacySupabase() {
  return supabase;
}

function addEstablishmentIdToPayload<T extends LegacyPayload>(
  payload: T,
  establishmentId: string
): T {
  if (Array.isArray(payload)) {
    return payload.map((item) => ({
      ...item,
      establishment_id: establishmentId,
    })) as unknown as T;
  }

  return {
    ...payload,
    establishment_id: establishmentId,
  } as T;
}

function wrapLegacyQuery<T extends object>(query: T): LegacyScopedQuery<T> {
  return new Proxy(
    { query },
    {
      get(target, prop, receiver) {
        if (prop === "then") {
          return undefined;
        }

        if (prop in target) {
          return Reflect.get(target, prop, receiver);
        }

        const value = (query as Record<PropertyKey, unknown>)[prop];
        return typeof value === "function" ? value.bind(query) : value;
      },
    }
  ) as LegacyScopedQuery<T>;
}

export function resetLegacyTenantCache() {
  cachedTenant = null;
}

export async function getLegacyActiveEstablishmentId() {
  if (cachedTenant && cachedTenant.expiresAt > Date.now()) {
    return cachedTenant.establishmentId;
  }

  if (typeof window === "undefined") {
    throw new Error("Contexto legado de empresa ativo indisponível no servidor.");
  }

  const response = await fetch("/api/tenant/me", {
    cache: "no-store",
    credentials: "same-origin",
  });

  if (!response.ok) {
    throw new Error("Não foi possível identificar a empresa ativa.");
  }

  const payload = await response.json();
  const establishmentId = String(
    payload?.tenant?.establishmentId ??
      payload?.tenant?.establishment_id ??
      ""
  ).trim();

  if (!establishmentId) {
    throw new Error("Empresa ativa não encontrada.");
  }

  cachedTenant = {
    establishmentId,
    expiresAt: Date.now() + LEGACY_TENANT_CACHE_MS,
  };

  return establishmentId;
}

export async function getLegacyTenantScope() {
  const establishmentId = await getLegacyActiveEstablishmentId();

  return {
    supabase,
    establishmentId,
  };
}

export async function legacySelect(tableName: string, columns = "*") {
  const { establishmentId } = await getLegacyTenantScope();
  const client = supabase as any;

  return wrapLegacyQuery(
    client
      .from(tableName)
      .select(columns)
      .eq("establishment_id", establishmentId)
  );
}

export async function legacyInsert<T extends LegacyPayload>(
  tableName: string,
  payload: T
) {
  const { establishmentId } = await getLegacyTenantScope();
  const client = supabase as any;

  return client
    .from(tableName)
    .insert(addEstablishmentIdToPayload(payload, establishmentId));
}

export async function legacyUpsert<T extends LegacyPayload>(
  tableName: string,
  payload: T,
  options?: Parameters<ReturnType<typeof supabase.from>["upsert"]>[1]
) {
  const { establishmentId } = await getLegacyTenantScope();
  const client = supabase as any;

  return client
    .from(tableName)
    .upsert(addEstablishmentIdToPayload(payload, establishmentId), options);
}

export async function legacyUpdate(
  tableName: string,
  payload: Record<string, unknown>
) {
  const { establishmentId } = await getLegacyTenantScope();
  const client = supabase as any;

  return wrapLegacyQuery(
    client
      .from(tableName)
      .update(payload)
      .eq("establishment_id", establishmentId)
  );
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

export function isLegacyTableMissingError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error &&
            typeof error === "object" &&
            "message" in error &&
            typeof (error as { message?: unknown }).message === "string"
          ? ((error as { message: string }).message ?? "")
          : "";

  return (
    message.includes("Could not find the table") &&
    message.includes("in the schema cache")
  );
}
