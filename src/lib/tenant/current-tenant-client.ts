export type CurrentTenantItem = {
  id: string;
  role: string;
  establishment_id: string | null;
  establishment_name?: string | null;
  display_name?: string | null;
  org_id: string | null;
  unit_id: string | null;
  is_active: boolean;
};

export type CurrentTenantPayload = {
  tenant?: {
    establishmentId: string;
    establishmentName?: string | null;
    role: string;
    displayName?: string | null;
  } | null;
  tenants?: CurrentTenantItem[];
};

const CURRENT_TENANT_CACHE_MS = 10_000;

let cachedTenant:
  | {
      value: CurrentTenantPayload;
      expiresAt: number;
    }
  | null = null;

let tenantRequest: Promise<CurrentTenantPayload> | null = null;

export function clearCurrentTenantCache() {
  cachedTenant = null;
  tenantRequest = null;
}

export async function getCurrentTenantPayload(options?: {
  force?: boolean;
}): Promise<CurrentTenantPayload> {
  if (
    !options?.force &&
    cachedTenant &&
    cachedTenant.expiresAt > Date.now()
  ) {
    return cachedTenant.value;
  }

  if (!options?.force && tenantRequest) {
    return tenantRequest;
  }

  tenantRequest = fetchCurrentTenantPayload();

  try {
    const value = await tenantRequest;
    cachedTenant = {
      value,
      expiresAt: Date.now() + CURRENT_TENANT_CACHE_MS,
    };
    return value;
  } finally {
    tenantRequest = null;
  }
}

async function fetchCurrentTenantPayload(): Promise<CurrentTenantPayload> {
  const response = await fetch("/api/tenant/me", {
    method: "GET",
    cache: "no-store",
    credentials: "same-origin",
  });

  const data = (await response.json().catch(() => ({}))) as
    | CurrentTenantPayload
    | { error?: string };

  if (!response.ok) {
    const message =
      "error" in data && data.error
        ? data.error
        : "Não foi possível carregar a empresa ativa.";
    throw new Error(message);
  }

  return data as CurrentTenantPayload;
}
