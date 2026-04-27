"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

const titles: Record<string, string> = {
  "/financeiro": "Financeiro",
  "/financeiro/dre": "DRE",
  "/financeiro/dre/drilldown": "Drill-down da DRE",
  "/financeiro/dre/fornecedores": "Drill-down por Fornecedor",
  "/financeiro/dre/produtos": "Drill-down por Produto",
  "/financeiro/dre/relatorio": "Relatório Executivo da DRE",
  "/financeiro/contas-a-pagar": "Contas a Pagar",
  "/financeiro/contas-a-receber": "Contas a Receber",
  "/financeiro/fluxo-de-caixa": "Fluxo de Caixa",
  "/financeiro/dashboard-bancario": "Dashboard Bancário",
  "/financeiro/contas-bancarias": "Contas Bancárias",
  "/financeiro/conciliacao-bancaria": "Conciliação Bancária",
  "/financeiro/plano-de-contas": "Plano de Contas",
  "/financeiro/centros-de-custo": "Centros de Custo",
  "/financeiro/relatorios": "Relatórios",
  "/financeiro/auditoria": "Auditoria Financeira",
  "/dashboard/pedidos": "Pedidos",
  "/dashboard/producao": "Produção",
  "/dashboard/produtividade": "Produtividade",
  "/dashboard/estoque": "Estoque",
  "/dashboard/entradas": "Entradas",
  "/dashboard/inventario": "Inventário",
  "/dashboard/produtos": "Produtos",
  "/dashboard/fichas-tecnicas": "Fichas Técnicas",
  "/dashboard/etiquetas": "Etiquetas",
  "/dashboard/historico-pedidos": "Histórico",
  "/dashboard/perdas": "Perdas",
  "/dashboard/transferencias": "Transferências",
  "/dashboard/compras": "Hub de Dados",
  "/dashboard/controladoria": "Controladoria",
  "/dashboard/admin/usuarios": "Usuários",
};

export function PageHeader() {
  const pathname = usePathname();
  const title = titles[pathname] ?? "Dashboard";

  return (
    <div className="mb-6">
      <Breadcrumbs />
      <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-slate-100">
        {title}
      </h1>
    </div>
  );
}