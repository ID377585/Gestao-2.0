import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  authorizeCronSecret,
  cronUnauthorizedResponse,
} from "@/lib/security/cron-secret";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const REMINDER_HOURS = [6, 15, 21];
const TIME_ZONE = "America/Sao_Paulo";

type SaoPauloNow = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

type ReminderRecipient = {
  establishment_id: string | null;
  user_id: string | null;
};

function getSaoPauloNow(reference = new Date()): SaoPauloNow {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(reference);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function getLastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function isAuthorizedBySecret(request: Request) {
  return authorizeCronSecret(request, {
    routeLabel: "stock-count-reminders",
    envNames: ["ALERTS_CRON_SECRET", "CRON_SECRET"],
    acceptedHeaderNames: ["x-alerts-secret", "x-cron-secret"],
  });
}

function getReminderSlot(now: SaoPauloNow) {
  const lastDay = getLastDayOfMonth(now.year, now.month);

  if (now.day !== lastDay) return null;
  if (!REMINDER_HOURS.includes(now.hour)) return null;
  if (now.minute > 10) return null;

  const dateKey = `${now.year}-${pad(now.month)}-${pad(now.day)}`;
  const timeLabel = `${pad(now.hour)}:00`;

  return {
    dateKey,
    timeLabel,
    dedupeKeyPrefix: `stock-count-reminder:${dateKey}:${pad(now.hour)}`,
  };
}

async function createStockCountReminder() {
  const now = getSaoPauloNow();
  const slot = getReminderSlot(now);

  if (!slot) {
    return {
      created: false,
      reason: "Fora da janela de contagem de estoque.",
      now,
    };
  }

  const supabase = createSupabaseAdminClient();

  const { data: recipients, error: recipientsError } = await supabase
    .from("memberships")
    .select("establishment_id,user_id")
    .eq("is_active", true)
    .not("establishment_id", "is", null)
    .in("role", ["admin", "operacao", "estoque"]);

  if (recipientsError) {
    console.error("Erro ao buscar destinatários da contagem de estoque:", recipientsError);
    throw recipientsError;
  }

  const uniqueRecipients = Array.from(
    new Map(
      ((recipients ?? []) as ReminderRecipient[])
        .filter((item) => item.establishment_id && item.user_id)
        .map((item) => [
          `${item.establishment_id}:${item.user_id}`,
          {
            establishmentId: String(item.establishment_id),
            userId: String(item.user_id),
          },
        ])
    ).values()
  );

  if (uniqueRecipients.length === 0) {
    return {
      created: false,
      reason: "Nenhum destinatário ativo encontrado para o lembrete.",
      now,
    };
  }

  const payloads = uniqueRecipients.map((recipient) => ({
    user_id: recipient.userId,
    establishment_id: recipient.establishmentId,
    title: "Inventário",
    message: `Hoje é o último dia do mês. Usuários precisam efetuar o Inventário para fechar o mês.`,
    type: "stock_count_reminder",
    priority: "critical",
    action_url: "/dashboard/inventario",
    dedupe_key: `${slot.dedupeKeyPrefix}:${recipient.establishmentId}:${recipient.userId}`,
    payload: {
      establishment_id: recipient.establishmentId,
      reminder_time: slot.timeLabel,
      stock_count_date: slot.dateKey,
      timezone: TIME_ZONE,
    },
  }));

  let { error } = await supabase
    .from("notifications")
    .upsert(payloads, { onConflict: "dedupe_key", ignoreDuplicates: true });

  if (error) {
    const payloadsWithoutEstablishmentColumn = payloads.map(
      ({ establishment_id: _ignored, ...payload }) => payload
    );

    ({ error } = await supabase
      .from("notifications")
      .upsert(payloadsWithoutEstablishmentColumn, {
        onConflict: "dedupe_key",
        ignoreDuplicates: true,
      }));
  }

  if (error) {
    console.error("Erro ao criar notificação de contagem de estoque:", error);
    throw error;
  }

  return {
    created: true,
    recipients: payloads.length,
    dedupeKeyPrefix: slot.dedupeKeyPrefix,
    now,
  };
}

export async function GET(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "stock-count-reminders",
      limit: 30,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const authorization = isAuthorizedBySecret(request);
    if (!authorization.authorized) return cronUnauthorizedResponse(authorization);

    const result = await createStockCountReminder();
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro ao criar lembrete de contagem de estoque." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
