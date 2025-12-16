"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

const titles: Record<string, string> = {
  "/dashboard/pedidos": "Pedidos",
  "/dashboard/producao": "Produção",
  "/dashboard/produtividade": "Produtividade",
  "/dashboard/estoque": "Estoque",
  "/dashboard/fichas-tecnicas": "Fichas Técnicas",
  "/dashboard/etiquetas": "Etiquetas",
  "/dashboard/historico-pedidos": "Histórico de Pedidos",
  "/dashboard/compras": "Compras",
};

export function PageHeader() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Dashboard";

  return (
    <div className="mb-6">
      <Breadcrumbs />
      <h1 className="mt-2 text-2xl font-semibold text-gray-900">
        {title}
      </h1>
    </div>
  );
}
