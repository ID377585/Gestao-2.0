"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TenantItem = {
  id: string;
  role: string;
  establishment_id: string | null;
  org_id: string | null;
  unit_id: string | null;
  is_active: boolean;
};

type TenantSummaryPayload = {
  tenant?: {
    establishmentId: string;
    role: string;
  } | null;
  tenants?: TenantItem[];
};

type TenantSummaryProps = {
  compact?: boolean;
  className?: string;
};

function shortId(value?: string | null) {
  if (!value) return "sem empresa";
  return value.slice(0, 8);
}

function tenantLabel(tenant: TenantItem) {
  return `Empresa ${shortId(tenant.establishment_id)}`;
}

export function TenantSummary({ compact = false, className }: TenantSummaryProps) {
  const [tenant, setTenant] = useState<TenantSummaryPayload["tenant"]>(null);
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadTenant() {
      try {
        const response = await fetch("/api/tenant/me", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = (await response.json()) as TenantSummaryPayload;

        if (!mounted) return;

        setTenant(data.tenant ?? null);
        setTenants(data.tenants ?? []);
      } catch (error) {
        console.error("Erro ao carregar empresa ativa:", error);
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

  if (!tenant?.establishmentId) return null;

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

      window.location.reload();
    } catch (error) {
      console.error("Erro ao trocar empresa ativa:", error);
      setSwitching(false);
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-800 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
        compact ? "w-full" : "min-w-[220px]",
        className
      )}
      title={tenant.establishmentId}
    >
      {switching ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-gray-500" />
      ) : (
        <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
      )}

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-gray-500 dark:text-slate-400">
          Empresa ativa
        </div>

        {activeTenants.length > 1 ? (
          <select
            value={tenant.establishmentId}
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
        ) : (
          <div className="truncate text-sm font-medium">
            Empresa {shortId(tenant.establishmentId)}
          </div>
        )}
      </div>
    </div>
  );
}
