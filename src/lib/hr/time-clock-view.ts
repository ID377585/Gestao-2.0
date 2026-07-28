import type { TimeClockDashboardData } from "@/lib/hr/time-clock-types";

function dateInTimezone(value: string, timezone: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function prepareTimeClockDashboardForClient(
  data: TimeClockDashboardData
): TimeClockDashboardData {
  if (data.currentShift) return data;

  const today = dateInTimezone(data.serverNow, data.timezone);
  const latestToday = data.history.find(
    (shift) => shift.workDate === today && shift.status === "closed"
  );

  if (!latestToday) return data;

  return {
    ...data,
    currentShift: latestToday,
    closedMonthBalanceSeconds:
      data.closedMonthBalanceSeconds - latestToday.balanceSeconds,
  };
}
