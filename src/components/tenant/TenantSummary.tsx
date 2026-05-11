"use client";

import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

type TenantSummaryPayload = {
  tenant?: {
    establishmentId: string;
    role: string;
  } | null;
  tenants?: Array<{
    id: string;
    establishment_id: string | null;
    is_active: boolean;
  }>;
};

type TenantSummaryProps = {
  compact?: boolean;
  className?: string;
};

function shortId(value?: string | null) {
  if (!value) return "sem empresa";
  return value.slice(0, 8);
}

export function TenantSummary({ compact = false, className }: TenantSummaryProps) {
  const [tenant, setTenant] = useState<TenantSummaryPayload["tenant"]>(null);
  const [tenantCount, setTenantCount] = useState(0);

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
        setTenantCount(data.tenants?.length ?? 0);
      } catch (error) {
        console.error("Erro ao carregar empresa ativa:", error);
      }
    }

    void loadTenant();

    return () => {
      mounted = false;
    };
  }, []);

  if (!tenant?.establishmentId) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-800 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100",
        compact ? "w-full" : "min-w-[180px]",
        className
      )}
      title={tenant.establishmentId}
    >
      <Building2 className="h-4 w-4 shrink-0 text-gray-500" />
      <div className="min-w-0">
        <div className="truncate text-xs text-gray-500 dark:text-slate-400">
          Empresa ativa
        </div>
        <div className="truncate text-sm font-medium">
          {shortId(tenant.establishmentId)}
          {tenantCount > 1 ? ` · ${tenantCount} empresas` : ""}
        </div>
      </div>
    </div>
  );
}
