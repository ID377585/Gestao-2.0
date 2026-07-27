"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  Thermometer,
  type LucideIcon,
} from "lucide-react";

type WeatherData = {
  temperatureC: number | null;
  emoji: string;
  iconKey?:
    | "sun"
    | "moon"
    | "cloud-sun"
    | "cloud-moon"
    | "cloud"
    | "fog"
    | "drizzle"
    | "rain"
    | "snow"
    | "storm"
    | "thermometer";
  condition: string;
  source: "company" | "device" | "fallback";
  locationLabel: string | null;
  isDay?: boolean | null;
  observedAt?: string | null;
};

const WEATHER_ICON_BY_KEY: Record<NonNullable<WeatherData["iconKey"]>, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  "cloud-moon": CloudMoon,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  storm: CloudLightning,
  thermometer: Thermometer,
};

const WEATHER_ICON_CLASS_BY_KEY: Record<NonNullable<WeatherData["iconKey"]>, string> = {
  sun: "text-amber-500 dark:text-amber-300",
  moon: "text-indigo-500 dark:text-indigo-300",
  "cloud-sun": "text-amber-500 dark:text-amber-300",
  "cloud-moon": "text-indigo-500 dark:text-indigo-300",
  cloud: "text-slate-500 dark:text-slate-300",
  fog: "text-slate-400 dark:text-slate-300",
  drizzle: "text-sky-500 dark:text-sky-300",
  rain: "text-blue-600 dark:text-blue-300",
  snow: "text-cyan-500 dark:text-cyan-300",
  storm: "text-violet-600 dark:text-violet-300",
  thermometer: "text-slate-500 dark:text-slate-300",
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
  const deviceCoordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const geolocationAttemptedRef = useRef(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadDeviceWeather(options: { allowPrompt?: boolean } = {}) {
      const allowPrompt = options.allowPrompt ?? true;
      const cachedCoords = deviceCoordsRef.current;

      if (cachedCoords) {
        try {
          const deviceData = await fetchWeather(cachedCoords.latitude, cachedCoords.longitude);
          if (!cancelled) setWeather(deviceData);
          return true;
        } catch {
          deviceCoordsRef.current = null;
          return false;
        }
      }

      if (
        !allowPrompt ||
        typeof navigator === "undefined" ||
        !navigator.geolocation ||
        geolocationAttemptedRef.current
      ) {
        return false;
      }

      geolocationAttemptedRef.current = true;

      return new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            deviceCoordsRef.current = coords;

            try {
              const deviceData = await fetchWeather(coords.latitude, coords.longitude);
              if (!cancelled) setWeather(deviceData);
              resolve(true);
            } catch {
              resolve(false);
            }
          },
          () => resolve(false),
          { maximumAge: 900_000, timeout: 5000 },
        );
      });
    }

    async function loadWeather() {
      try {
        if (await loadDeviceWeather({ allowPrompt: false })) return;

        const data = await fetchWeather();
        if (!cancelled) setWeather(data);

        void loadDeviceWeather({ allowPrompt: true });
      } catch {
        if (!cancelled) {
          setWeather({
            temperatureC: null,
            emoji: "🌡️",
            iconKey: "thermometer",
            condition: "Clima indisponível",
            source: "fallback",
            locationLabel: null,
            isDay: null,
            observedAt: null,
          });
        }

        void loadDeviceWeather({ allowPrompt: true });
      }
    }

    void loadWeather();
    const intervalId = window.setInterval(() => void loadWeather(), 5 * 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const dateLabel = useMemo(() => formatDateLabel(now), [now]);
  const compactDateLabel = useMemo(() => formatCompactDateLabel(now), [now]);
  const iconKey = weather?.iconKey ?? "thermometer";
  const WeatherIcon = WEATHER_ICON_BY_KEY[iconKey];
  const weatherIconClass = WEATHER_ICON_CLASS_BY_KEY[iconKey];
  const weatherTemperature =
    weather?.temperatureC !== null && weather?.temperatureC !== undefined
      ? `${weather.temperatureC}ºC`
      : null;
  const weatherLabel = weatherTemperature
    ? `${weatherTemperature} ${weather?.condition ?? "Tempo atual"}`
    : weather?.condition ?? "Clima";
  const fullTitle = weather?.locationLabel
    ? `${dateLabel} — ${weatherLabel} • ${weather.locationLabel}`
    : `${dateLabel} — ${weatherLabel}`;

  return (
    <div
      className="flex max-w-[380px] items-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm sm:px-3 sm:py-2 sm:text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      title={fullTitle}
    >
      <span className="hidden truncate sm:inline 2xl:hidden">{compactDateLabel}</span>
      <span className="hidden truncate 2xl:inline">{dateLabel}</span>
      <span className="hidden mx-2 shrink-0 text-slate-300 sm:inline dark:text-slate-600">—</span>
      <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        {weatherTemperature ? <span>{weatherTemperature}</span> : null}
        <WeatherIcon
          aria-label={weather?.condition ?? "Clima"}
          className={`h-4 w-4 ${weatherIconClass}`}
        />
        <span className="hidden max-w-28 truncate md:inline">
          {weather?.condition ?? "Clima"}
        </span>
      </span>
    </div>
  );
}
