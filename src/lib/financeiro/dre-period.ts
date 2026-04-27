export type DrePeriodPreset =
  | "custom"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "this_year";

export type DrePeriodRange = {
  dateFrom: string;
  dateTo: string;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function startOfQuarter(date: Date) {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
}

function endOfQuarter(date: Date) {
  const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth + 3, 0);
}

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function endOfYear(date: Date) {
  return new Date(date.getFullYear(), 11, 31);
}

function diffInDaysInclusive(dateFrom: string, dateTo: string) {
  const start = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86400000) + 1;
}

function addDays(date: string, days: number) {
  const base = new Date(`${date}T00:00:00`);
  base.setDate(base.getDate() + days);
  return toIsoDate(base);
}

export function getPresetRange(preset: DrePeriodPreset, now = new Date()): DrePeriodRange | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "this_month":
      return {
        dateFrom: toIsoDate(startOfMonth(today)),
        dateTo: toIsoDate(endOfMonth(today)),
      };

    case "last_month": {
      const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        dateFrom: toIsoDate(startOfMonth(previousMonth)),
        dateTo: toIsoDate(endOfMonth(previousMonth)),
      };
    }

    case "this_quarter":
      return {
        dateFrom: toIsoDate(startOfQuarter(today)),
        dateTo: toIsoDate(endOfQuarter(today)),
      };

    case "this_year":
      return {
        dateFrom: toIsoDate(startOfYear(today)),
        dateTo: toIsoDate(endOfYear(today)),
      };

    default:
      return null;
  }
}

export function getPreviousEquivalentPeriod(range: DrePeriodRange): DrePeriodRange {
  const totalDays = diffInDaysInclusive(range.dateFrom, range.dateTo);
  const previousDateTo = addDays(range.dateFrom, -1);
  const previousDateFrom = addDays(previousDateTo, -(totalDays - 1));

  return {
    dateFrom: previousDateFrom,
    dateTo: previousDateTo,
  };
}

export function resolveRange(
  preset: DrePeriodPreset,
  customDateFrom: string,
  customDateTo: string
): DrePeriodRange | null {
  if (preset === "custom") {
    if (!customDateFrom || !customDateTo) return null;
    return {
      dateFrom: customDateFrom,
      dateTo: customDateTo,
    };
  }

  return getPresetRange(preset);
}