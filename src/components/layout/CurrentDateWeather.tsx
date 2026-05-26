"use client";

import { useEffect, useMemo, useState } from "react";

type WeatherData = {
  temperatureC: number | null;
  emoji: string;
  condition: string;
  source: "company" | "device" | "fallback";
  locationLabel: string | null;
};

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateLabel(date: Date) {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  const year = new Intl.DateTimeFormat("pt-BR", { year: "numeric" }).format(date);

  return `${capitalize(weekday)}: ${day} de ${capitalize(month)} ${year}`;
}

function formatCompactDateLabel(date: Date) {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date).replace(".", "");
  const dayMonth = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);

  return `${capitalize(weekday)}: ${dayMonth}`;
}

async function fetchWeather(latitude?: number, longitude?: number) {
  const params = new URLSearchParams();

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    params.set("lat", String(latitude));
    params.set("lon", String(longitude));
  }

  const queryString = params.toString();
  const response = await fetch(`/api/weather/current${queryString ? `?${queryString}` : ""}`, {
    cache: "no-store",
  });

  if (!response.ok) throw new Error("Não foi possível carregar o clima.");
  return (await response.json()) as WeatherData;
}

export function CurrentDateWeather() {
  const [now, setNow] = useState(() => new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCompanyWeather() {
      try {
        const data = await fetchWeather();
        if (!cancelled) setWeather(data);

        if (data.temperatureC !== null || typeof navigator === "undefined" || !navigator.geolocation) {
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            try {
              const deviceData = await fetchWeather(position.coords.latitude, position.coords.longitude);
              if (!cancelled) setWeather(deviceData);
            } catch {
              // Keep company/fallback result.
            }
          },
          () => {
            // Browser location is optional. Keep company/fallback result.
          },
          { maximumAge: 900_000, timeout: 4000 },
        );
      } catch {
        if (!cancelled) {
          setWeather({
            temperatureC: null,
            emoji: "🌡️",
            condition: "Clima indisponível",
            source: "fallback",
            locationLabel: null,
          });
        }
      }
    }

    void loadCompanyWeather();
    const intervalId = window.setInterval(() => void loadCompanyWeather(), 15 * 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const dateLabel = useMemo(() => formatDateLabel(now), [now]);
  const compactDateLabel = useMemo(() => formatCompactDateLabel(now), [now]);
  const weatherLabel = weather?.temperatureC !== null && weather?.temperatureC !== undefined
    ? `${weather.temperatureC}ºC ${weather.emoji}`
    : weather?.emoji ?? "🌡️";
  const fullTitle = weather?.locationLabel
    ? `${dateLabel} — ${weatherLabel} • ${weather.condition} • ${weather.locationLabel}`
    : `${dateLabel} — ${weatherLabel} • ${weather?.condition ?? "Data e clima"}`;

  return (
    <div
      className="flex max-w-[380px] items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm sm:px-3 sm:py-2 sm:text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      title={fullTitle}
    >
      <span className="hidden truncate sm:inline 2xl:hidden">{compactDateLabel}</span>
      <span className="hidden truncate 2xl:inline">{dateLabel}</span>
      <span className="hidden mx-2 shrink-0 text-slate-300 sm:inline dark:text-slate-600">—</span>
      <span className="shrink-0 whitespace-nowrap">{weatherLabel}</span>
    </div>
  );
}
