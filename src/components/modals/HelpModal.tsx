"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const quickLinks = [
  {
    title: "Pedidos",
    description: "Criar, acompanhar, avançar status e consultar histórico.",
    href: "/dashboard/pedidos",
  },
  {
    title: "Produção",
    description: "Monitorar andamento operacional e execução interna.",
    href: "/dashboard/producao",
  },
  {
    title: "Estoque",
    description: "Acompanhar níveis, inventário, críticos e ajustes.",
    href: "/dashboard/estoque",
  },
  {
    title: "Produtos",
    description: "Cadastrar insumos, pré-preparos e produtos acabados.",
    href: "/dashboard/produtos",
  },
  {
    title: "Fichas Técnicas",
    description: "Gerenciar receitas, custos, escalas e modo de preparo.",
    href: "/dashboard/fichas-tecnicas",
  },
  {
    title: "Usuários",
    description: "Cadastrar, editar, redefinir senha e revisar acessos.",
    href: "/dashboard/admin/usuarios",
  },
];

export function HelpModal({ open, onClose }: HelpModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Ajuda
          </h3>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="space-y-5 text-sm text-gray-700 dark:text-slate-300">
          <div>
            <p>
              Use este menu para acessar rapidamente as principais áreas do sistema
              e entender o que cada módulo faz.
            </p>
          </div>

          <div className="rounded-md border border-gray-200 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Como usar o menu do usuário
            </div>

            <ul className="mt-3 list-disc pl-5 space-y-2">
              <li>
                <strong>Perfil:</strong> mostra seus dados reais de acesso.
              </li>
              <li>
                <strong>Configurações:</strong> ativa email, push no navegador e tema escuro.
              </li>
              <li>
                <strong>Ajuda:</strong> abre este painel com orientações rápidas.
              </li>
              <li>
                <strong>Sair:</strong> encerra sua sessão atual no sistema.
              </li>
            </ul>
          </div>

          <div className="rounded-md border border-gray-200 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
              Atalhos rápidos
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="rounded-lg border border-gray-200 p-3 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <div className="font-medium text-gray-900 dark:text-slate-100">
                    {item.title}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.description}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-slate-50 p-4 text-xs text-muted-foreground dark:bg-slate-800/60">
            Dica: para receber alertas de estoque baixo, alteração de usuários e
            eventos operacionais, mantenha as notificações por email e navegador
            ativadas em <strong>Configurações</strong>.
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}