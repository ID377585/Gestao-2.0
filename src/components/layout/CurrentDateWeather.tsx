"use client";

import { useEffect, useMemo, useState } from "react";

type WeatherData = {
  temperatureC: number | null;
  emoji: string;
  condition: string;
  source: "company" | "device" | "fallback";
  locationLabel: string | null;
};

function formatDateLabel(date: Date) {
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long" }).format(date);
  const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit" }).format(date);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(date);
  const year = new Intl.DateTimeFormat("pt-BR", { year: "numeric" }).format(date);

  const formattedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const formattedMonth = month.charAt(0).toUpperCase() + month.slice(1);

  return `${formattedWeekday}: ${day} de ${formattedMonth} ${year}`;
}

async function fetchWeather(latitude?: number, longitude?: number) {
  const params = new URLSearchParams();

  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    params.set("lat", String(latitude));
    params.set("lon", String(longitude));
  }

  const response = await fetch(`/api/weather/current${params.size ? `?${params}` : ""}`, {
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
  const weatherLabel = weather?.temperatureC !== null && weather?.temperatureC !== undefined
    ? `${weather.temperatureC}ºC ${weather.emoji}`
    : weather?.emoji ?? "🌡️";

  return (
    <div
      className="hidden items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm lg:flex dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      title={weather?.locationLabel ? `${weather.condition} • ${weather.locationLabel}` : weather?.condition ?? "Data e clima"}
    >
      <span className="whitespace-nowrap">{dateLabel}</span>
      <span className="mx-2 text-slate-300 dark:text-slate-600">—</span>
      <span className="whitespace-nowrap">{weatherLabel}</span>
    </div>
  );
}
