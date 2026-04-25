"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const labelsMap: Record<string, string> = {
  dashboard: "Dashboard",
  pedidos: "Pedidos",
  producao: "Produção",
  produtividade: "Produtividade",
  estoque: "Estoque",
  entradas: "Entradas",
  inventario: "Inventário",
  produtos: "Produtos",
  "fichas-tecnicas": "Fichas Técnicas",
  etiquetas: "Etiquetas",
  "historico-pedidos": "Histórico",
  perdas: "Perdas",
  transferencias: "Transferências",
  compras: "Hub de Dados",
  financeiro: "Financeiro",
  dre: "DRE",
  controladoria: "Controladoria",
  admin: "Administração",
  usuarios: "Usuários",
};

function formatLabel(part: string) {
  return labelsMap[part] ?? part.replace(/-/g, " ");
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);

  return (
    <nav className="text-sm text-gray-500 dark:text-slate-400">
      <ol className="flex flex-wrap items-center gap-2">
        <li>
          <Link
            href="/dashboard/pedidos"
            className="transition-colors hover:text-gray-700 dark:hover:text-slate-200"
          >
            Dashboard
          </Link>
        </li>

        {parts.slice(1).map((part, index) => {
          const href = "/" + parts.slice(0, index + 2).join("/");

          return (
            <li key={href} className="flex items-center gap-2">
              <span className="text-gray-400 dark:text-slate-500">/</span>
              <Link
                href={href}
                className="capitalize transition-colors hover:text-gray-700 dark:hover:text-slate-200"
              >
                {formatLabel(part)}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
