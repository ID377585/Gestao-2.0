export type StockCountCountdown = {
  enabled: boolean;
  isLastDayOfMonth: boolean;
  targetDate: Date;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
};

export const STOCK_COUNT_REMINDER_HOURS = [6, 15, 21] as const;

export function getLastDayOfMonth(reference = new Date()) {
  return new Date(
    reference.getFullYear(),
    reference.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

export function getStartOfLastThreeDays(reference = new Date()) {
  const lastDay = getLastDayOfMonth(reference);
  return new Date(
    lastDay.getFullYear(),
    lastDay.getMonth(),
    lastDay.getDate() - 3,
    0,
    0,
    0,
    0,
  );
}

export function isInStockCountCountdownWindow(reference = new Date()) {
  const start = getStartOfLastThreeDays(reference);
  const lastDay = getLastDayOfMonth(reference);
  return reference >= start && reference <= lastDay;
}

export function isLastDayOfMonth(reference = new Date()) {
  return reference.getDate() === getLastDayOfMonth(reference).getDate();
}

export function getNextStockCountReminder(reference = new Date()) {
  if (!isLastDayOfMonth(reference)) return null;

  for (const hour of STOCK_COUNT_REMINDER_HOURS) {
    const reminder = new Date(
      reference.getFullYear(),
      reference.getMonth(),
      reference.getDate(),
      hour,
      0,
      0,
      0,
    );

    if (reference <= reminder) return reminder;
  }

  return null;
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatCountdownParts(days: number, hours: number, minutes: number, seconds: number) {
  return `${days} dias - ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function getStockCountCountdown(reference = new Date()): StockCountCountdown {
  const targetDate = getLastDayOfMonth(reference);
  const enabled = isInStockCountCountdownWindow(reference);
  const diff = Math.max(0, targetDate.getTime() - reference.getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    enabled,
    isLastDayOfMonth: isLastDayOfMonth(reference),
    targetDate,
    days,
    hours,
    minutes,
    seconds,
    label: formatCountdownParts(days, hours, minutes, seconds),
  };
}

export function getStockCountReminderSlot(reference = new Date()) {
  if (!isLastDayOfMonth(reference)) return null;

  const hour = reference.getHours();
  const minute = reference.getMinutes();

  if (!STOCK_COUNT_REMINDER_HOURS.includes(hour as (typeof STOCK_COUNT_REMINDER_HOURS)[number])) {
    return null;
  }

  // Janela de 10 minutos para tolerar cron/execução atrasada sem duplicar demais.
  if (minute > 10) return null;

  return {
    hour,
    dedupeKey: `stock-count-reminder:${reference.getFullYear()}-${pad(reference.getMonth() + 1)}-${pad(reference.getDate())}:${pad(hour)}`,
    label: `${pad(hour)}:00`,
  };
}
