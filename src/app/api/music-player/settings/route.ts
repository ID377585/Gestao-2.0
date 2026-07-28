import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

export const dynamic = "force-dynamic";

const DEFAULT_STATION_NAME = "Rádio do estabelecimento";
const DEFAULT_VOLUME = 0.65;

type MusicPlayerSettingsPayload = {
  enabled: boolean;
  stationName: string;
  streamUrl: string | null;
  logoUrl: string | null;
  genre: string | null;
  defaultVolume: number;
  canManage: boolean;
};

function normalizeText(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

function normalizeHttpsUrl(value: unknown, label: string) {
  const text = normalizeText(value, 2048);
  if (!text) return null;

  let url: URL;

  try {
    url = new URL(text);
  } catch {
    throw new Error(`${label} inválida.`);
  }

  if (url.protocol !== "https:") {
    throw new Error(`${label} deve utilizar HTTPS.`);
  }

  return url.toString();
}

function normalizeVolume(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error("O volume padrão deve estar entre zero e um.");
  }

  return Number(parsed.toFixed(3));
}

function mapSettings(
  row: Record<string, unknown> | null | undefined,
  canManage: boolean
): MusicPlayerSettingsPayload {
  return {
    enabled: Boolean(row?.enabled ?? false),
    stationName:
      normalizeText(row?.station_name, 120) ?? DEFAULT_STATION_NAME,
    streamUrl: normalizeText(row?.stream_url, 2048),
    logoUrl: normalizeText(row?.logo_url, 2048),
    genre: normalizeText(row?.genre, 80),
    defaultVolume: Number(row?.default_volume ?? DEFAULT_VOLUME),
    canManage,
  };
}

async function loadCurrentSettings() {
  const tenant = await getCurrentTenant();

  if (!tenant?.establishmentId) {
    return {
      response: NextResponse.json(
        { error: "Empresa ativa não encontrada." },
        { status: 403 }
      ),
      tenant: null,
      supabase: null,
      settings: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("music_player_settings")
    .select(
      "enabled, station_name, stream_url, logo_url, genre, default_volume"
    )
    .eq("establishment_id", tenant.establishmentId)
    .maybeSingle();

  if (error) {
    console.error("[music-player] erro ao carregar configurações:", error);

    return {
      response: NextResponse.json(
        { error: "Não foi possível carregar o player de música." },
        { status: 500 }
      ),
      tenant,
      supabase,
      settings: null,
    };
  }

  return {
    response: null,
    tenant,
    supabase,
    settings: mapSettings(data as Record<string, unknown> | null, tenant.role === "admin"),
  };
}

export async function GET() {
  try {
    const result = await loadCurrentSettings();

    if (result.response) return result.response;

    return NextResponse.json(result.settings, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error: any) {
    console.error("[GET /api/music-player/settings] erro inesperado:", error);

    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const result = await loadCurrentSettings();

    if (result.response) return result.response;
    if (!result.tenant || !result.supabase) {
      return NextResponse.json(
        { error: "Empresa ativa não encontrada." },
        { status: 403 }
      );
    }

    if (result.tenant.role !== "admin") {
      return NextResponse.json(
        { error: "Apenas administradores podem configurar a rádio." },
        { status: 403 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await result.supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const body = (await request.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const enabled = body.enabled === true;
    const stationName =
      normalizeText(body.stationName, 120) ?? DEFAULT_STATION_NAME;
    const streamUrl = normalizeHttpsUrl(body.streamUrl, "URL da transmissão");
    const logoUrl = normalizeHttpsUrl(body.logoUrl, "URL do logotipo");
    const genre = normalizeText(body.genre, 80);
    const defaultVolume = normalizeVolume(
      body.defaultVolume ?? DEFAULT_VOLUME
    );

    if (enabled && !streamUrl) {
      return NextResponse.json(
        { error: "Informe uma URL HTTPS da rádio antes de ativar o player." },
        { status: 400 }
      );
    }

    const { data, error } = await result.supabase
      .from("music_player_settings")
      .upsert(
        {
          establishment_id: result.tenant.establishmentId,
          enabled,
          station_name: stationName,
          stream_url: streamUrl,
          logo_url: logoUrl,
          genre,
          default_volume: defaultVolume,
          created_by: user.id,
          updated_by: user.id,
        },
        { onConflict: "establishment_id" }
      )
      .select(
        "enabled, station_name, stream_url, logo_url, genre, default_volume"
      )
      .single();

    if (error) {
      console.error("[music-player] erro ao salvar configurações:", error);

      return NextResponse.json(
        { error: "Não foi possível salvar a configuração da rádio." },
        { status: 500 }
      );
    }

    return NextResponse.json(mapSettings(data, true), { status: 200 });
  } catch (error: any) {
    console.error("[PUT /api/music-player/settings] erro inesperado:", error);

    return NextResponse.json(
      { error: error?.message ?? "Erro inesperado." },
      { status: 400 }
    );
  }
}
