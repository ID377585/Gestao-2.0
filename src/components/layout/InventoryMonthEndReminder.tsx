"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

function getSaoPauloDateParts(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(reference);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function isLastDayOfMonth(reference = new Date()) {
  const parts = getSaoPauloDateParts(reference);
  const lastDay = new Date(parts.year, parts.month, 0).getDate();

  return parts.day === lastDay;
}

export function InventoryMonthEndReminder() {
  const [visible, setVisible] = useState(false);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  const reminderKey = useMemo(() => {
    const parts = getSaoPauloDateParts();
    return `inventory-month-end:${parts.year}-${String(parts.month).padStart(2, "0")}`;
  }, []);

  useEffect(() => {
    const dismissed = window.sessionStorage.getItem(reminderKey);
    setDismissedKey(dismissed);
    setVisible(isLastDayOfMonth() && dismissed !== "dismissed");

    const intervalId = window.setInterval(() => {
      const dismissedAgain = window.sessionStorage.getItem(reminderKey);
      setVisible(isLastDayOfMonth() && dismissedAgain !== "dismissed");
    }, 10 * 60_000);

    return () => window.clearInterval(intervalId);
  }, [reminderKey]);

  if (!visible || dismissedKey === "dismissed") return null;

  return (
    <div className="sticky top-0 z-30 border-b border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 shadow-sm dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-100 md:px-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-sm font-medium">
            Hoje é o último dia do mês. Usuários precisam efetuar o Inventário para fechar o mês.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/dashboard/inventario"
            className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900 dark:text-amber-50"
          >
            Abrir Inventário
          </Link>
          <button
            type="button"
            className="rounded-md px-2 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900"
            onClick={() => {
              window.sessionStorage.setItem(reminderKey, "dismissed");
              setDismissedKey("dismissed");
              setVisible(false);
            }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
