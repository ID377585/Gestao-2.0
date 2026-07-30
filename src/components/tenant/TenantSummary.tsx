"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clearCurrentTenantCache,
  getCurrentTenantPayload,
  type CurrentTenantItem,
  type CurrentTenantPayload,
} from "@/lib/tenant/current-tenant-client";

type TenantSummaryProps = {
  compact?: boolean;
  className?: string;
};

function shortId(value?: string | null) {
  if (!value) return "sem empresa";
  return value.slice(0, 8);
}

function companyDisplayName(value?: string | null) {
  const name = String(value ?? "").trim();
  return name || null;
}

function tenantLabel(tenant: CurrentTenantItem) {
  return (
    companyDisplayName(tenant.display_name) ??
    companyDisplayName(tenant.establishment_name) ??
    shortId(tenant.establishment_id)
  );
}

export function TenantSummary({ compact = false, className }: TenantSummaryProps) {
  const [tenant, setTenant] = useState<CurrentTenantPayload["tenant"]>(null);
  const [tenants, setTenants] = useState<CurrentTenantItem[]>([]);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadTenant() {
      try {
        setLoadingTenant(true);
        setLoadError(null);

        const payload = await getCurrentTenantPayload();

        if (!mounted) return;

        setTenant(payload.tenant ?? null);
        setTenants(payload.tenants ?? []);
      } catch (error) {
        if (!mounted) return;

        console.error("Erro ao carregar empresa ativa:", error);
        setTenant(null);
        setTenants([]);
        setLoadError("Não foi possível carregar a empresa ativa.");
      } finally {
        if (mounted) {
          setLoadingTenant(false);
        }
      }
    }

    void loadTenant();

    return () => {
      mounted = false;
    };
  }, []);

  const activeTenants = useMemo(
    () => tenants.filter((item) => item.is_active && item.establishment_id),
    [tenants]
  );

  async function handleChange(nextEstablishmentId: string) {
    if (!nextEstablishmentId || nextEstablishmentId === tenant?.establishmentId) return;

    try {
      setSwitching(true);

      const response = await fetch("/api/tenant/switch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ establishmentId: nextEstablishmentId }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? "Não foi possível trocar a empresa ativa.");
      }

      clearCurrentTenantCache();
      window.location.reload();
    } catch (error) {
      console.error("Erro ao trocar empresa ativa:", error);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Não foi possível trocar a empresa ativa."
      );
      setSwitching(false);
    }
  }

  const hasTenant = Boolean(tenant?.establishmentId);
  const isBusy = loadingTenant || switching;
  const activeCompanyName =
    companyDisplayName(tenant?.displayName) ??
    companyDisplayName(tenant?.establishmentName);
  const fallbackCompanyId = shortId(tenant?.establishmentId);
  const companyLabel = activeCompanyName ?? fallbackCompanyId;
  const title = hasTenant
    ? activeCompanyName ?? tenant?.establishmentId
    : loadError ?? "Empresa ativa não carregada";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-800 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
        compact ? "w-full" : "min-w-[220px]",
        !hasTenant && !loadingTenant ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100" : null,
        className
      )}
      title={title}
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-500" />
      ) : (
        <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-gray-500 dark:text-slate-400">
          Empresa ativa
        </div>

        {loadingTenant ? (
          <div className="truncate text-sm font-medium">Carregando...</div>
        ) : hasTenant && activeTenants.length > 1 ? (
          <select
            value={tenant?.establishmentId ?? ""}
            onChange={(event) => void handleChange(event.target.value)}
            disabled={switching}
            className="w-full truncate bg-transparent text-sm font-medium outline-none disabled:cursor-wait disabled:opacity-70"
            aria-label="Selecionar empresa ativa"
          >
            {activeTenants.map((item) => (
              <option key={item.id} value={item.establishment_id ?? ""}>
                {tenantLabel(item)}
              </option>
            ))}
          </select>
        ) : hasTenant ? (
          <div className="truncate text-sm font-medium">{companyLabel}</div>
        ) : (
          <div className="truncate text-sm font-medium">Empresa não carregada</div>
        )}

        {loadError && !loadingTenant ? (
          <div className="mt-0.5 truncate text-[11px] text-amber-700 dark:text-amber-300">
            {loadError}
          </div>
        ) : null}
      </div>
    </div>
  );
}
