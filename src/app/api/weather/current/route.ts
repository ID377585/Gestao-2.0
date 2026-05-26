import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listCurrentUserTenantsForUser } from "@/lib/tenant/get-current-tenant";
import { TENANT_COOKIE_NAME } from "@/lib/tenant/constants";

export const dynamic = "force-dynamic";

type WeatherPayload = {
  temperatureC: number | null;
  emoji: string;
  condition: string;
  source: "company" | "device" | "fallback";
  locationLabel: string | null;
};

function getWeatherEmoji(code: number | null | undefined) {
  if (code === 0) return "☀️";
  if ([1, 2].includes(Number(code))) return "🌤️";
  if (code === 3) return "☁️";
  if ([45, 48].includes(Number(code))) return "🌫️";
  if ([51, 53, 55, 56, 57].includes(Number(code))) return "🌦️";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(Number(code))) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(Number(code))) return "❄️";
  if ([95, 96, 99].includes(Number(code))) return "⛈️";
  return "🌡️";
}

function getWeatherCondition(code: number | null | undefined) {
  if (code === 0) return "Céu limpo";
  if ([1, 2].includes(Number(code))) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if ([45, 48].includes(Number(code))) return "Neblina";
  if ([51, 53, 55, 56, 57].includes(Number(code))) return "Garoa";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(Number(code))) return "Chuva";
  if ([71, 73, 75, 77, 85, 86].includes(Number(code))) return "Neve";
  if ([95, 96, 99].includes(Number(code))) return "Temporal";
  return "Tempo atual";
}

async function fetchWeatherByCoordinates(latitude: number, longitude: number, source: WeatherPayload["source"], locationLabel: string | null): Promise<WeatherPayload> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("timezone", "America/Sao_Paulo");

  const response = await fetch(url, {
    next: { revalidate: 900 },
  });

  if (!response.ok) {
    throw new Error("Não foi possível consultar a previsão do tempo.");
  }

  const data = (await response.json()) as any;
  const temperature = Number(data?.current?.temperature_2m);
  const code = Number(data?.current?.weather_code);

  return {
    temperatureC: Number.isFinite(temperature) ? Math.round(temperature) : null,
    emoji: getWeatherEmoji(Number.isFinite(code) ? code : null),
    condition: getWeatherCondition(Number.isFinite(code) ? code : null),
    source,
    locationLabel,
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
  const cookieStore = await import("next/headers").then((mod) => mod.cookies());
  const selectedEstablishmentId = cookieStore.get(TENANT_COOKIE_NAME)?.value ?? null;
  const membership = selectedEstablishmentId
    ? tenants.find((tenant) => tenant.establishment_id === selectedEstablishmentId) ?? null
    : tenants[0] ?? null;

  if (!membership?.establishment_id) return membership?.display_name ?? membership?.establishment_name ?? null;

  try {
    const { data } = await supabase
      .from("fiscal_company_profiles")
      .select("nome_fantasia,razao_social,municipio,uf,cep,endereco,logradouro,bairro")
      .eq("establishment_id", membership.establishment_id)
      .maybeSingle();

    const profile = data as any;
    const cityState = [profile?.municipio, profile?.uf].filter(Boolean).join(", ");
    if (cityState.trim()) return cityState;

    const address = [profile?.endereco ?? profile?.logradouro, profile?.bairro, profile?.cep]
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
        condition: "Clima indisponível",
        source: "fallback",
        locationLabel: companyLocationLabel,
      } satisfies WeatherPayload,
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Erro ao carregar clima atual:", error);
    return NextResponse.json(
      {
        temperatureC: null,
        emoji: "🌡️",
        condition: "Clima indisponível",
        source: "fallback",
        locationLabel: null,
      } satisfies WeatherPayload,
      { status: 200 },
    );
  }
}
