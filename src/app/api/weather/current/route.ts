import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCurrentUserTenantsForUser } from "@/lib/tenant/get-current-tenant";
import { TENANT_COOKIE_NAME } from "@/lib/tenant/constants";

export const dynamic = "force-dynamic";

type WeatherPayload = {
  temperatureC: number | null;
  emoji: string;
  iconKey:
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
  isDay: boolean | null;
  observedAt: string | null;
};

function normalizeWeatherCode(value: unknown) {
  const code = Number(value);
  return Number.isFinite(code) ? code : null;
}

function parseDateTime(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}

function resolveIsDay(params: {
  currentIsDay: unknown;
  observedAt: unknown;
  sunrise: unknown;
  sunset: unknown;
}) {
  const raw = Number(params.currentIsDay);
  if (Number.isFinite(raw)) return raw === 1;

  const observedAt = parseDateTime(params.observedAt);
  const sunrise = parseDateTime(params.sunrise);
  const sunset = parseDateTime(params.sunset);

  if (observedAt && sunrise && sunset) {
    return observedAt >= sunrise && observedAt < sunset;
  }

  return null;
}

function getWeatherPresentation(params: {
  code: number | null | undefined;
  isDay: boolean | null;
  cloudCover: number | null;
  precipitation: number | null;
}) {
  const code = normalizeWeatherCode(params.code);
  const isDay = params.isDay !== false;
  const precipitation = Number(params.precipitation ?? 0);
  const cloudCover = Number(params.cloudCover ?? 0);

  if (code !== null && [95, 96, 99].includes(code)) {
    return { emoji: "⛈️", iconKey: "storm" as const, condition: "Temporal" };
  }

  if (code !== null && [71, 73, 75, 77, 85, 86].includes(code)) {
    return { emoji: "❄️", iconKey: "snow" as const, condition: "Neve" };
  }

  if (
    (code !== null && [61, 63, 65, 66, 67, 80, 81, 82].includes(code)) ||
    precipitation > 0.2
  ) {
    return { emoji: "🌧️", iconKey: "rain" as const, condition: "Chuva" };
  }

  if (code !== null && [51, 53, 55, 56, 57].includes(code)) {
    return { emoji: "🌦️", iconKey: "drizzle" as const, condition: "Garoa" };
  }

  if (code !== null && [45, 48].includes(code)) {
    return { emoji: "🌫️", iconKey: "fog" as const, condition: "Neblina" };
  }

  if (code === 3 || cloudCover >= 85) {
    return { emoji: "☁️", iconKey: "cloud" as const, condition: "Nublado" };
  }

  if ((code !== null && [1, 2].includes(code)) || cloudCover >= 25) {
    return {
      emoji: isDay ? "🌤️" : "☁️",
      iconKey: isDay ? ("cloud-sun" as const) : ("cloud-moon" as const),
      condition: "Parcialmente nublado",
    };
  }

  if (code === 0) {
    return {
      emoji: isDay ? "☀️" : "🌙",
      iconKey: isDay ? ("sun" as const) : ("moon" as const),
      condition: isDay ? "Céu limpo" : "Noite limpa",
    };
  }

  return {
    emoji: isDay ? "☀️" : "🌙",
    iconKey: isDay ? ("sun" as const) : ("moon" as const),
    condition: "Tempo atual",
  };
}

async function fetchWeatherByCoordinates(
  latitude: number,
  longitude: number,
  source: WeatherPayload["source"],
  locationLabel: string | null,
): Promise<WeatherPayload> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,weather_code,is_day,precipitation,rain,showers,snowfall,cloud_cover",
  );
  url.searchParams.set("daily", "sunrise,sunset");
  url.searchParams.set("timezone", "America/Sao_Paulo");
  url.searchParams.set("forecast_days", "1");

  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Não foi possível consultar a previsão do tempo.");
  }

  const data = (await response.json()) as any;
  const current = data?.current ?? {};
  const daily = data?.daily ?? {};
  const temperature = Number(data?.current?.temperature_2m);
  const code = normalizeWeatherCode(data?.current?.weather_code);
  const precipitationValues = [
    Number(current?.precipitation),
    Number(current?.rain),
    Number(current?.showers),
    Number(current?.snowfall),
  ].filter(Number.isFinite);
  const precipitation =
    precipitationValues.length > 0
      ? precipitationValues.reduce((sum, value) => sum + value, 0)
      : null;
  const cloudCover = Number(current?.cloud_cover);
  const isDay = resolveIsDay({
    currentIsDay: current?.is_day,
    observedAt: current?.time,
    sunrise: daily?.sunrise?.[0],
    sunset: daily?.sunset?.[0],
  });
  const presentation = getWeatherPresentation({
    code,
    isDay,
    cloudCover: Number.isFinite(cloudCover) ? cloudCover : null,
    precipitation,
  });

  return {
    temperatureC: Number.isFinite(temperature) ? Math.round(temperature) : null,
    emoji: presentation.emoji,
    iconKey: presentation.iconKey,
    condition: presentation.condition,
    source,
    locationLabel,
    isDay,
    observedAt: typeof current?.time === "string" ? current.time : null,
  };
}

async function geocodeCompanyLocation(query: string) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return null;

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", cleanQuery);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "pt");
  url.searchParams.set("format", "json");

  const response = await fetch(url, {
    next: { revalidate: 86400 },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as any;
  const result = data?.results?.[0];
  const latitude = Number(result?.latitude);
  const longitude = Number(result?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    latitude,
    longitude,
    label: [result?.name, result?.admin1, result?.country].filter(Boolean).join(" - "),
  };
}

async function getCompanyLocationLabel() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  const tenants = await listCurrentUserTenantsForUser(supabase, user.id);
  const cookieStore = await cookies();
  const selectedEstablishmentId = cookieStore.get(TENANT_COOKIE_NAME)?.value ?? null;
  const membership = selectedEstablishmentId
    ? tenants.find((tenant) => tenant.establishment_id === selectedEstablishmentId) ?? null
    : tenants[0] ?? null;

  if (!membership?.establishment_id) {
    return membership?.display_name ?? membership?.establishment_name ?? null;
  }

  try {
    const { data } = await supabase
      .from("fiscal_company_profiles")
      .select("nome_fantasia,razao_social,cidade,uf,cep,endereco,bairro")
      .eq("establishment_id", membership.establishment_id)
      .maybeSingle();

    const profile = data as any;
    const cityState = [profile?.cidade, profile?.uf].filter(Boolean).join(", ");
    const localizedCityState = cityState ? `${cityState}, Brasil` : "";
    if (localizedCityState.trim()) return localizedCityState;
    if (cityState.trim()) return cityState;

    const address = [profile?.endereco, profile?.bairro, profile?.cidade, profile?.uf, profile?.cep]
      .filter(Boolean)
      .join(", ");
    if (address.trim()) return address;
  } catch (error) {
    console.warn("Não foi possível carregar endereço fiscal para clima:", error);
  }

  return membership.display_name ?? membership.establishment_name ?? null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const latitude = Number(url.searchParams.get("lat"));
    const longitude = Number(url.searchParams.get("lon"));

    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      const weather = await fetchWeatherByCoordinates(latitude, longitude, "device", "Localização atual");
      return NextResponse.json(weather, { status: 200 });
    }

    const companyLocationLabel = await getCompanyLocationLabel();
    const geocoded = companyLocationLabel ? await geocodeCompanyLocation(companyLocationLabel) : null;

    if (geocoded) {
      const weather = await fetchWeatherByCoordinates(
        geocoded.latitude,
        geocoded.longitude,
        "company",
        geocoded.label || companyLocationLabel,
      );
      return NextResponse.json(weather, { status: 200 });
    }

    return NextResponse.json(
      {
        temperatureC: null,
        emoji: "🌡️",
        iconKey: "thermometer",
        condition: "Clima indisponível",
        source: "fallback",
        locationLabel: companyLocationLabel,
        isDay: null,
        observedAt: null,
      } satisfies WeatherPayload,
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Erro ao carregar clima atual:", error);
    return NextResponse.json(
      {
        temperatureC: null,
        emoji: "🌡️",
        iconKey: "thermometer",
        condition: "Clima indisponível",
        source: "fallback",
        locationLabel: null,
        isDay: null,
        observedAt: null,
      } satisfies WeatherPayload,
      { status: 200 },
    );
  }
}
