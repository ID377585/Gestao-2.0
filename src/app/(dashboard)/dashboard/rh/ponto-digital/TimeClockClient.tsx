"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coffee,
  Loader2,
  LogIn,
  LogOut,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  TimeClockDashboardData,
  TimeClockEventType,
  TimeClockSettingsInput,
  TimeClockShiftSummary,
  TimeClockState,
} from "@/lib/hr/time-clock-types";
import {
  refreshTimeClockAction,
  registerNextTimeClockEventAction,
  saveTimeClockSettingsAction,
} from "./actions";

type TimeClockClientProps = {
  initialData: TimeClockDashboardData;
};

const EVENT_ORDER: Array<{
  type: TimeClockEventType;
  label: string;
  shortLabel: string;
}> = [
  { type: "clock_in", label: "Entrada", shortLabel: "Entrada" },
  {
    type: "break_start",
    label: "Saída para almoço/janta",
    shortLabel: "Início do intervalo",
  },
  {
    type: "break_end",
    label: "Volta do almoço/janta",
    shortLabel: "Retorno",
  },
  { type: "clock_out", label: "Saída", shortLabel: "Saída" },
];

function formatClock(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function formatTimestamp(value: string | null, timezone: string) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatWorkDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function formatDuration(totalSeconds: number, options?: { signed?: boolean }) {
  const rounded = Math.round(totalSeconds);
  const sign = rounded < 0 ? "-" : options?.signed && rounded > 0 ? "+" : "";
  const absolute = Math.abs(rounded);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor((absolute % 3600) / 60);
  const seconds = absolute % 60;

  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

function stateLabel(state: TimeClockState) {
  switch (state) {
    case "working":
      return "Trabalhando";
    case "on_break":
      return "Em intervalo";
    case "finished":
      return "Jornada encerrada";
    case "blocked":
      return "Jornada pendente de ajuste";
    default:
      return "Jornada não iniciada";
  }
}

function stateClasses(state: TimeClockState) {
  switch (state) {
    case "working":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300";
    case "on_break":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300";
    case "finished":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300";
    case "blocked":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300";
    default:
      return "border-gray-200 bg-gray-50 text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  }
}

function buttonIcon(eventType: TimeClockEventType) {
  switch (eventType) {
    case "clock_in":
      return LogIn;
    case "break_start":
      return Coffee;
    case "break_end":
      return RotateCcw;
    case "clock_out":
      return LogOut;
  }
}

function getLiveShiftValues(
  data: TimeClockDashboardData,
  nowMs: number
): {
  workedSeconds: number;
  breakSeconds: number;
  balanceSeconds: number;
  remainingSeconds: number;
  monthBalanceSeconds: number;
} {
  const shift = data.currentShift;

  if (!shift) {
    return {
      workedSeconds: 0,
      breakSeconds: 0,
      balanceSeconds: -data.settings.dailyMinutes * 60,
      remainingSeconds: data.settings.dailyMinutes * 60,
      monthBalanceSeconds: data.closedMonthBalanceSeconds,
    };
  }

  const serverNowMs = new Date(data.serverNow).getTime();
  const liveElapsedSeconds = Math.max(
    0,
    Math.floor((nowMs - serverNowMs) / 1000)
  );
  const workedSeconds =
    shift.workedSeconds + (shift.liveWorkStartedAt ? liveElapsedSeconds : 0);
  const breakSeconds =
    shift.breakSeconds + (shift.liveBreakStartedAt ? liveElapsedSeconds : 0);
  const balanceSeconds =
    workedSeconds - shift.targetSeconds + shift.adjustmentSeconds;
  const remainingSeconds = Math.max(0, -balanceSeconds);
  const monthBalanceSeconds =
    data.closedMonthBalanceSeconds + balanceSeconds;

  return {
    workedSeconds,
    breakSeconds,
    balanceSeconds,
    remainingSeconds,
    monthBalanceSeconds,
  };
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
  valueClassName,
}: {
  label: string;
  value: string;
  helper?: string;
  icon: typeof Clock3;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
            {label}
          </p>
          <p
            className={cn(
              "mt-2 font-mono text-2xl font-semibold tabular-nums text-gray-900 dark:text-slate-100",
              valueClassName
            )}
          >
            {value}
          </p>
          {helper ? (
            <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              {helper}
            </p>
          ) : null}
        </div>
        <div className="rounded-xl bg-gray-100 p-2.5 text-gray-600 dark:bg-slate-800 dark:text-slate-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function EventTimeline({
  shift,
  timezone,
}: {
  shift: TimeClockShiftSummary | null;
  timezone: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {EVENT_ORDER.map((item, index) => {
        const event = shift?.events.find(
          (candidate) => candidate.eventType === item.type
        );
        const complete = Boolean(event);

        return (
          <div
            key={item.type}
            className={cn(
              "relative rounded-xl border p-3",
              complete
                ? "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20"
                : "border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-900/60"
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                  complete
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-200 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
                )}
              >
                {complete ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </span>
              <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                {item.label}
              </span>
            </div>
            <p className="mt-3 font-mono text-xl font-semibold tabular-nums text-gray-900 dark:text-slate-100">
              {formatTimestamp(event?.occurredAt ?? null, timezone)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function SettingsPanel({
  data,
  saving,
  onSave,
}: {
  data: TimeClockDashboardData;
  saving: boolean;
  onSave: (input: TimeClockSettingsInput) => Promise<void>;
}) {
  const [draft, setDraft] = useState<TimeClockSettingsInput>({
    ...data.settings,
  });

  useEffect(() => {
    setDraft({ ...data.settings });
  }, [data.settings]);

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-slate-100">
            <Settings2 className="h-4 w-4" />
            Configuração da jornada
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Valores padrão da empresa. As marcações existentes não são alteradas.
          </p>
        </div>
        <Switch
          checked={draft.enabled}
          onCheckedChange={(enabled) =>
            setDraft((current) => ({ ...current, enabled }))
          }
          aria-label="Ativar Ponto Digital"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
            Jornada trabalhada por dia (minutos)
          </span>
          <input
            type="number"
            min={1}
            max={1440}
            value={draft.dailyMinutes}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                dailyMinutes: Number(event.target.value),
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <span className="mt-1 block text-[11px] text-gray-500 dark:text-slate-400">
            {formatDuration(draft.dailyMinutes * 60)} de trabalho efetivo.
          </span>
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
            Intervalo previsto (minutos)
          </span>
          <input
            type="number"
            min={0}
            max={480}
            value={draft.breakMinutes}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                breakMinutes: Number(event.target.value),
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
            Tolerância no saldo (minutos)
          </span>
          <input
            type="number"
            min={0}
            max={120}
            value={draft.toleranceMinutes}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                toleranceMinutes: Number(event.target.value),
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
            Fuso horário
          </span>
          <input
            type="text"
            value={draft.timezone}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                timezone: event.target.value,
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
            Duração máxima da jornada (horas)
          </span>
          <input
            type="number"
            min={1}
            max={36}
            value={draft.maxShiftHours}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                maxShiftHours: Number(event.target.value),
              }))
            }
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 px-3 py-2 dark:border-slate-700">
          <div>
            <p className="text-xs font-medium text-gray-700 dark:text-slate-300">
              Jornada noturna
            </p>
            <p className="text-[11px] text-gray-500 dark:text-slate-400">
              Permitir atravessar a meia-noite.
            </p>
          </div>
          <Switch
            checked={draft.allowOvernight}
            onCheckedChange={(allowOvernight) =>
              setDraft((current) => ({ ...current, allowOvernight }))
            }
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          disabled={saving}
          onClick={() => void onSave(draft)}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          {saving ? "Salvando..." : "Salvar jornada"}
        </Button>
      </div>
    </div>
  );
}

export function TimeClockClient({ initialData }: TimeClockClientProps) {
  const [data, setData] = useState(initialData);
  const [nowMs, setNowMs] = useState(() => new Date(initialData.serverNow).getTime());
  const [registering, setRegistering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const serverOffsetRef = useRef(
    new Date(initialData.serverNow).getTime() - Date.now()
  );

  useEffect(() => {
    serverOffsetRef.current = new Date(data.serverNow).getTime() - Date.now();
    setNowMs(Date.now() + serverOffsetRef.current);
  }, [data.serverNow]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now() + serverOffsetRef.current);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const live = useMemo(
    () => getLiveShiftValues(data, nowMs),
    [data, nowMs]
  );
  const NextActionIcon = buttonIcon(data.nextEventType);
  const balancePositive = live.balanceSeconds > 0;
  const balanceNegative = live.balanceSeconds < 0;

  const applyData = (nextData: TimeClockDashboardData) => {
    setData(nextData);
    serverOffsetRef.current = new Date(nextData.serverNow).getTime() - Date.now();
    setNowMs(Date.now() + serverOffsetRef.current);
  };

  const registerPoint = async () => {
    try {
      setRegistering(true);
      setMessage(null);
      setError(null);

      const result = await registerNextTimeClockEventAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }

      applyData(result.data);
      setMessage(result.message);
    } finally {
      setRegistering(false);
    }
  };

  const refresh = async () => {
    try {
      setRefreshing(true);
      setMessage(null);
      setError(null);

      const result = await refreshTimeClockAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }

      applyData(result.data);
    } finally {
      setRefreshing(false);
    }
  };

  const saveSettings = async (input: TimeClockSettingsInput) => {
    try {
      setSavingSettings(true);
      setMessage(null);
      setError(null);

      const result = await saveTimeClockSettingsAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      applyData(result.data);
      setMessage(result.message);
    } finally {
      setSavingSettings(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-blue-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-900 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
                  stateClasses(data.state)
                )}
              >
                {stateLabel(data.state)}
              </span>
              <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                Controle interno
              </span>
            </div>

            <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-slate-100 sm:text-3xl">
              Olá, {data.user.name}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
              As marcações usam o horário do servidor e não podem ser alteradas pelo funcionário.
            </p>
          </div>

          <div className="flex items-center gap-3 lg:text-right">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
                Horário atual
              </p>
              <p className="mt-1 font-mono text-3xl font-semibold tabular-nums text-gray-900 dark:text-slate-100 sm:text-4xl">
                {formatClock(new Date(nowMs), data.timezone)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {data.timezone}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={refreshing}
              aria-label="Atualizar ponto"
              onClick={() => void refresh()}
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <EventTimeline shift={data.currentShift} timezone={data.timezone} />
        </div>

        <div className="mt-6 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button
            type="button"
            size="lg"
            className="h-14 flex-1 rounded-xl text-base font-semibold sm:max-w-sm"
            disabled={
              registering ||
              refreshing ||
              !data.settings.enabled ||
              data.state === "blocked"
            }
            onClick={() => void registerPoint()}
          >
            {registering ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <NextActionIcon className="mr-2 h-5 w-5" />
            )}
            {registering ? "Registrando..." : data.nextActionLabel}
          </Button>

          {!data.settings.enabled ? (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              O Ponto Digital está desativado para esta empresa.
            </p>
          ) : null}

          {data.state === "blocked" ? (
            <p className="flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              Procure um administrador para regularizar a jornada aberta.
            </p>
          ) : null}
        </div>

        <div aria-live="polite" className="mt-3">
          {message ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Tempo trabalhado"
          value={formatDuration(live.workedSeconds)}
          helper={`Meta: ${formatDuration(data.settings.dailyMinutes * 60)}`}
          icon={Timer}
        />
        <SummaryCard
          label={live.remainingSeconds > 0 ? "Falta para terminar" : "Tempo excedente"}
          value={
            live.remainingSeconds > 0
              ? formatDuration(live.remainingSeconds)
              : formatDuration(Math.max(0, live.balanceSeconds))
          }
          helper={
            data.state === "on_break"
              ? "O contador de trabalho está pausado."
              : "Atualização em tempo real."
          }
          icon={live.remainingSeconds > 0 ? Clock3 : TrendingUp}
          valueClassName={
            live.remainingSeconds > 0
              ? "text-blue-700 dark:text-blue-300"
              : "text-emerald-700 dark:text-emerald-300"
          }
        />
        <SummaryCard
          label="Intervalo realizado"
          value={formatDuration(live.breakSeconds)}
          helper={`Previsto: ${formatDuration(data.settings.breakMinutes * 60)}`}
          icon={Coffee}
        />
        <SummaryCard
          label="Saldo do mês"
          value={formatDuration(live.monthBalanceSeconds, { signed: true })}
          helper="Jornadas encerradas + jornada atual."
          icon={
            live.monthBalanceSeconds >= 0 ? TrendingUp : TrendingDown
          }
          valueClassName={
            live.monthBalanceSeconds > 0
              ? "text-emerald-700 dark:text-emerald-300"
              : live.monthBalanceSeconds < 0
                ? "text-red-700 dark:text-red-300"
                : undefined
          }
        />
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex flex-col gap-2 border-b border-gray-200 p-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-slate-100">
              <CalendarDays className="h-4 w-4" />
              Histórico recente
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              O saldo considera a jornada padrão e a tolerância configurada.
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 text-sm font-medium",
              balancePositive && "text-emerald-700 dark:text-emerald-300",
              balanceNegative && "text-red-700 dark:text-red-300"
            )}
          >
            {balancePositive ? (
              <TrendingUp className="h-4 w-4" />
            ) : balanceNegative ? (
              <TrendingDown className="h-4 w-4" />
            ) : (
              <Clock3 className="h-4 w-4" />
            )}
            Hoje: {formatDuration(live.balanceSeconds, { signed: true })}
          </div>
        </div>

        {data.history.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500 dark:text-slate-400">
            Nenhuma jornada registrada ainda.
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-slate-800">
            {data.history.map((shift) => (
              <div
                key={shift.shiftId}
                className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr] lg:items-center"
              >
                <div>
                  <p className="text-sm font-semibold capitalize text-gray-900 dark:text-slate-100">
                    {formatWorkDate(shift.workDate)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    {formatTimestamp(
                      shift.events.find((event) => event.eventType === "clock_in")
                        ?.occurredAt ?? null,
                      data.timezone
                    )}
                    {" — "}
                    {formatTimestamp(
                      shift.events.find((event) => event.eventType === "clock_out")
                        ?.occurredAt ?? null,
                      data.timezone
                    )}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Trabalhado
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-slate-100">
                    {formatDuration(shift.workedSeconds)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Intervalo
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-gray-900 dark:text-slate-100">
                    {formatDuration(shift.breakSeconds)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Saldo
                  </p>
                  <p
                    className={cn(
                      "mt-1 font-mono text-sm font-semibold tabular-nums",
                      shift.balanceSeconds > 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : shift.balanceSeconds < 0
                          ? "text-red-700 dark:text-red-300"
                          : "text-gray-900 dark:text-slate-100"
                    )}
                  >
                    {formatDuration(shift.balanceSeconds, { signed: true })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {data.canManageSettings ? (
        <SettingsPanel
          data={data}
          saving={savingSettings}
          onSave={saveSettings}
        />
      ) : null}

      <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Este módulo é um controle interno de jornada. Ele não deve ser apresentado
            como REP-P oficial ou substituto de obrigações legais sem a etapa específica
            de conformidade da Portaria nº 671.
          </p>
        </div>
      </section>
    </div>
  );
}
