import Link from "next/link";
import { BadgeCheck, Clock3, Coffee, UserMinus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveTenantOrRedirect } from "@/lib/tenant/guards";

function getDateKeyInTimezone(date: Date, timezone = "America/Sao_Paulo") {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function isMissingTableError(error: any) {
  const code = String(error?.code ?? "");
  return code === "42P01" || code === "PGRST205" || code === "PGRST204";
}

export default async function RhDashboardPage() {
  const tenant = await getActiveTenantOrRedirect();
  const supabaseAdmin = getSupabaseAdminClient();
  const today = getDateKeyInTimezone(new Date());

  const [{ data: memberships }, { data: events, error: eventsError }] =
    await Promise.all([
      supabaseAdmin
        .from("memberships")
        .select("user_id, role")
        .eq("establishment_id", tenant.establishmentId)
        .eq("is_active", true),
      supabaseAdmin
        .from("hr_time_clock_events")
        .select("user_id, event_type")
        .eq("establishment_id", tenant.establishmentId)
        .eq("work_date", today),
    ]);

  if (eventsError && !isMissingTableError(eventsError)) {
    console.error("[rh-dashboard] events error:", eventsError);
  }

  const employeeIds = new Set(
    (memberships ?? [])
      .filter((membership: any) => String(membership.role ?? "") !== "cliente")
      .map((membership: any) => String(membership.user_id))
  );
  const eventRows = eventsError ? [] : events ?? [];
  const statusByUser = new Map<string, Set<string>>();

  for (const event of eventRows as any[]) {
    const userId = String(event.user_id ?? "");
    if (!userId) continue;

    if (!statusByUser.has(userId)) {
      statusByUser.set(userId, new Set());
    }

    statusByUser.get(userId)?.add(String(event.event_type ?? ""));
  }

  let presentes = 0;
  let emRefeicao = 0;

  for (const userId of employeeIds) {
    const userEvents = statusByUser.get(userId);
    if (!userEvents?.has("entrada") || userEvents.has("saida")) continue;

    presentes += 1;

    if (
      userEvents.has("saida_refeicao") &&
      !userEvents.has("retorno_refeicao")
    ) {
      emRefeicao += 1;
    }
  }

  const ativos = employeeIds.size;
  const ausentes = Math.max(0, ativos - presentes);

  const cards = [
    {
      label: "Funcionários ativos",
      value: ativos,
      icon: Users,
      className: "text-blue-700 dark:text-blue-300",
    },
    {
      label: "Presentes",
      value: presentes,
      icon: BadgeCheck,
      className: "text-emerald-700 dark:text-emerald-300",
    },
    {
      label: "Em refeição",
      value: emRefeicao,
      icon: Coffee,
      className: "text-amber-700 dark:text-amber-300",
    },
    {
      label: "Ausentes",
      value: ausentes,
      icon: UserMinus,
      className: "text-red-700 dark:text-red-300",
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Pessoas e jornada
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
            RH
          </h1>
        </div>

        <Button asChild className="gap-2">
          <Link href="/dashboard/rh/ponto-digital">
            <Clock3 className="h-4 w-4" />
            Abrir Ponto Digital
          </Link>
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <Card key={card.label} className="rounded-md">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.label}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.className}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-semibold ${card.className}`}>
                  {card.value}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-md">
        <CardHeader>
          <CardTitle className="text-base">Ponto Digital</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm text-gray-600 dark:text-slate-300">
            Registro interno de jornada com entrada, refeição, retorno e saída,
            calculando tempo trabalhado e saldo do dia em tempo real.
          </p>
          <Button asChild variant="outline">
            <Link href="/dashboard/rh/ponto-digital">Registrar ponto</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
