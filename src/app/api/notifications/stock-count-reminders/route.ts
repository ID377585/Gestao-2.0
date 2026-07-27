import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

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
    dedupeKey: `stock-count-reminder:${dateKey}:${pad(now.hour)}`,
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

  const { data: existing, error: existingError } = await supabase
    .from("notifications")
    .select("id")
    .eq("dedupe_key", slot.dedupeKey)
    .limit(1);

  if (existingError) {
    console.error("Erro ao verificar deduplicação da contagem de estoque:", existingError);
    throw existingError;
  }

  if ((existing ?? []).length > 0) {
    return {
      created: false,
      reason: "Notificação já criada para este horário.",
      dedupeKey: slot.dedupeKey,
      now,
    };
  }

  const payload = {
    user_id: null,
    title: "Inventário",
    message: `Hoje é o último dia do mês. Usuários precisam efetuar o Inventário para fechar o mês.`,
    type: "stock_count_reminder",
    priority: "critical",
    action_url: "/dashboard/inventario",
    dedupe_key: slot.dedupeKey,
    payload: {
      reminder_time: slot.timeLabel,
      stock_count_date: slot.dateKey,
      timezone: TIME_ZONE,
    },
  };

  const { error } = await supabase.from("notifications").insert(payload);

  if (error) {
    console.error("Erro ao criar notificação de contagem de estoque:", error);
    throw error;
  }

  return {
    created: true,
    dedupeKey: slot.dedupeKey,
    now,
  };
}

export async function GET() {
  try {
    const result = await createStockCountReminder();
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "Erro ao criar lembrete de contagem de estoque." },
      { status: 500 },
    );
  }
}

export async function POST() {
  return GET();
}
