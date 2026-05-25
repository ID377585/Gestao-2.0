import { ClipboardCheck, CreditCard, ShieldCheck, Users } from "lucide-react";

const COMPANY_OPERATIONS = [
  {
    title: "Validar acesso",
    description: "Confirme se a empresa ativa, o perfil do usuário e os vínculos estão corretos antes de operar.",
    icon: ShieldCheck,
  },
  {
    title: "Revisar assinatura",
    description: "Verifique plano, status e possíveis pendências antes de liberar crescimento da operação.",
    icon: CreditCard,
  },
  {
    title: "Conferir usuários",
    description: "Mantenha colaboradores, permissões e convites alinhados com a empresa selecionada.",
    icon: Users,
  },
  {
    title: "Acompanhar auditoria",
    description: "Use os registros administrativos para rastrear trocas de empresa e alterações sensíveis.",
    icon: ClipboardCheck,
  },
];

export function CompanyOperationsGuide() {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
            Rotina operacional multiempresa
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
            Use este guia para manter cada tenant organizado, seguro e pronto para crescimento.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COMPANY_OPERATIONS.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className="rounded-xl border border-gray-200 p-4 dark:border-slate-800"
            >
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-50 p-2 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="font-medium text-gray-900 dark:text-slate-100">
                  {item.title}
                </h3>
              </div>
              <p className="mt-3 text-sm text-gray-600 dark:text-slate-400">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
