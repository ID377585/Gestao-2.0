import { NextResponse } from "next/server";

import { privateCacheHeaders } from "@/lib/cache/http";
import { rateLimit } from "@/lib/security/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";

type MusicStationRow = {
  id: string;
  establishment_id?: string | null;
  name: string;
  stream_url: string;
  source_type?: string | null;
  external_url?: string | null;
  youtube_video_id?: string | null;
  youtube_playlist_id?: string | null;
  logo_url: string | null;
  genre: string | null;
  country: string | null;
  is_active: boolean;
};

type MusicSettingsRow = {
  enabled?: boolean;
  autoplay?: boolean | null;
  default_volume?: number | string | null;
  default_station_id?: string | null;
  source_type?: string | null;
  external_url?: string | null;
  youtube_video_id?: string | null;
  youtube_playlist_id?: string | null;
  station_name?: string | null;
  stream_url?: string | null;
  logo_url?: string | null;
  genre?: string | null;
};

type NormalizedMusicStation = {
  id: string;
  name: string;
  streamUrl: string;
  sourceType: "stream" | "youtube";
  externalUrl: string | null;
  youtubeVideoId: string | null;
  youtubePlaylistId: string | null;
  logoUrl: string | null;
  genre: string | null;
  country: string | null;
};

type StationSource = {
  sourceType: "stream" | "youtube";
  streamUrl: string;
  externalUrl: string | null;
  youtubeVideoId: string | null;
  youtubePlaylistId: string | null;
};

function parseYouTubeStartSeconds(value: string | null) {
  if (!value) return null;

  const raw = value.trim().toLowerCase();
  if (/^\d+$/.test(raw)) {
    const seconds = Number(raw);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const match = raw.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (!match || !match[0]) return null;

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * 3600 + minutes * 60 + seconds;

  return total > 0 ? total : null;
}

function emptyResponse() {
  return NextResponse.json({
    enabled: false,
    autoplay: false,
    canManage: false,
    defaultVolume: 0.6,
    defaultStationId: null,
    stations: [],
  });
}

function canManageMusic(role?: string | null) {
  return role === "admin" || role === "operacao";
}

function isSchemaCompatibilityError(error: any) {
  const code = String(error?.code ?? "");
  const message = String(error?.message ?? "").toLowerCase();
  const details = String(error?.details ?? "").toLowerCase();

  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST200" ||
    code === "PGRST204" ||
    code === "PGRST205" ||
    message.includes("schema cache") ||
    message.includes("column") ||
    details.includes("schema cache") ||
    details.includes("column")
  );
}

function serializeSupabaseError(error: any) {
  return {
    code: error?.code ?? null,
    message: error?.message ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
  };
}

function parseYouTubeSource(value: unknown): StationSource | null {
  const url = String(value ?? "").trim();
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const isYouTube =
    host === "youtu.be" ||
    host === "youtube.com" ||
    host === "music.youtube.com" ||
    host.endsWith(".youtube.com");

  if (!isYouTube) return null;

  if (parsed.protocol !== "https:") {
    throw new Error("Informe uma URL HTTPS do YouTube.");
  }

  const parts = parsed.pathname.split("/").filter(Boolean);
  const rawPlaylistId = parsed.searchParams.get("list")?.trim() || null;
  const isGeneratedRadio =
    parsed.searchParams.get("start_radio") === "1" ||
    rawPlaylistId?.toUpperCase().startsWith("RD");
  const playlistId = isGeneratedRadio ? null : rawPlaylistId;
  const startSeconds = parseYouTubeStartSeconds(
    parsed.searchParams.get("start") ?? parsed.searchParams.get("t")
  );
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = parts[0] ?? null;
  } else if (parts[0] === "watch") {
    videoId = parsed.searchParams.get("v")?.trim() || null;
  } else if (["embed", "shorts", "live"].includes(parts[0] ?? "")) {
    videoId = parts[1] ?? null;
  }

  const validVideoId =
    !videoId || /^[a-zA-Z0-9_-]{6,32}$/.test(videoId);
  const validPlaylistId =
    !playlistId || /^[a-zA-Z0-9_-]{6,128}$/.test(playlistId);

  if (!validVideoId || !validPlaylistId || (!videoId && !playlistId)) {
    throw new Error("Informe uma URL válida de vídeo ou playlist do YouTube.");
  }

  const params = new URLSearchParams({
    feature: "oembed",
    playsinline: "1",
    rel: "0",
  });

  if (playlistId) {
    params.set("list", playlistId);
  }
  if (startSeconds) {
    params.set("start", String(startSeconds));
  }

  const embedPath = videoId ? `/embed/${videoId}` : "/embed/videoseries";

  return {
    sourceType: "youtube",
    streamUrl: `https://www.youtube.com${embedPath}?${params.toString()}`,
    externalUrl: parsed.toString(),
    youtubeVideoId: videoId,
    youtubePlaylistId: playlistId,
  };
}

function normalizeStationSource(value: unknown): StationSource {
  const youtubeSource = parseYouTubeSource(value);
  if (youtubeSource) return youtubeSource;

  const streamUrl = String(value ?? "").trim();

  if (!/^https:\/\/\S+/i.test(streamUrl)) {
    throw new Error("Informe uma URL HTTPS direta de streaming.");
  }

  return {
    sourceType: "stream",
    streamUrl,
    externalUrl: streamUrl,
    youtubeVideoId: null,
    youtubePlaylistId: null,
  };
}

function normalizeStationName(value: unknown) {
  const name = String(value ?? "").trim();

  if (name.length < 2) {
    throw new Error("Informe o nome da rádio.");
  }

  return name.slice(0, 120);
}

function clampDefaultVolume(value: unknown) {
  const volume = Number(value);
  if (!Number.isFinite(volume)) return 0.65;
  return Math.min(1, Math.max(0, volume));
}

function stationFromLegacySettings(
  settings: MusicSettingsRow | null,
  establishmentId: string
): NormalizedMusicStation | null {
  const streamUrl = String(settings?.stream_url ?? "").trim();

  if (!streamUrl) return null;

  return {
    id: `settings-${establishmentId}`,
    name: String(settings?.station_name ?? "Radio do estabelecimento"),
    streamUrl,
    sourceType: settings?.source_type === "youtube" ? "youtube" : "stream",
    externalUrl: settings?.external_url ? String(settings.external_url) : null,
    youtubeVideoId: settings?.youtube_video_id
      ? String(settings.youtube_video_id)
      : null,
    youtubePlaylistId: settings?.youtube_playlist_id
      ? String(settings.youtube_playlist_id)
      : null,
    logoUrl: settings?.logo_url ? String(settings.logo_url) : null,
    genre: settings?.genre ? String(settings.genre) : null,
    country: "BR",
  };
}

function dedupeStations(stations: Array<NormalizedMusicStation | null>) {
  const seen = new Set<string>();
  const result: NormalizedMusicStation[] = [];

  for (const station of stations) {
    if (!station) continue;

    const key = `${station.sourceType}:${station.streamUrl.toLowerCase()}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(station);
  }

  return result;
}

export async function GET() {
  const tenant = await getCurrentTenant();

  if (!tenant?.establishmentId) {
    return emptyResponse();
  }

  const supabaseAdmin = getSupabaseAdminClient();

  const modernSettingsResult = await supabaseAdmin
    .from("music_player_settings")
    .select(
      "enabled, autoplay, default_volume, default_station_id, source_type, external_url, youtube_video_id, youtube_playlist_id"
    )
    .eq("establishment_id", tenant.establishmentId)
    .maybeSingle();

  let settings = modernSettingsResult.data as MusicSettingsRow | null;
  let legacySettings: MusicSettingsRow | null = null;

  if (modernSettingsResult.error) {
    if (!isSchemaCompatibilityError(modernSettingsResult.error)) {
      console.error("[music-player] settings error:", modernSettingsResult.error);
    } else {
      const legacySettingsResult = await supabaseAdmin
        .from("music_player_settings")
        .select(
          "enabled, station_name, stream_url, logo_url, genre, default_volume, source_type, external_url, youtube_video_id, youtube_playlist_id"
        )
        .eq("establishment_id", tenant.establishmentId)
        .maybeSingle();

      if (!legacySettingsResult.error) {
        legacySettings = legacySettingsResult.data as MusicSettingsRow | null;
        settings = legacySettings;
      } else if (!isSchemaCompatibilityError(legacySettingsResult.error)) {
        console.error(
          "[music-player] legacy settings error:",
          legacySettingsResult.error
        );
      }
    }
  } else {
    const legacySettingsResult = await supabaseAdmin
      .from("music_player_settings")
      .select(
        "enabled, station_name, stream_url, logo_url, genre, default_volume, source_type, external_url, youtube_video_id, youtube_playlist_id"
      )
      .eq("establishment_id", tenant.establishmentId)
      .maybeSingle();

    if (!legacySettingsResult.error) {
      legacySettings = legacySettingsResult.data as MusicSettingsRow | null;
      settings = {
        ...legacySettings,
        ...settings,
      };
    } else if (!isSchemaCompatibilityError(legacySettingsResult.error)) {
      console.error(
        "[music-player] legacy settings error:",
        legacySettingsResult.error
      );
    }
  }

  let stations: MusicStationRow[] = [];
  const stationsResult = await supabaseAdmin
    .from("music_radio_stations")
    .select(
      "id, name, stream_url, source_type, external_url, youtube_video_id, youtube_playlist_id, logo_url, genre, country, is_active"
    )
    .eq("is_active", true)
    .or(`establishment_id.is.null,establishment_id.eq.${tenant.establishmentId}`)
    .order("name", { ascending: true });

  if (stationsResult.error) {
    if (isSchemaCompatibilityError(stationsResult.error)) {
      const legacyStationsResult = await supabaseAdmin
        .from("music_radio_stations")
        .select("id, name, stream_url, logo_url, genre, country, is_active")
        .eq("is_active", true)
        .or(`establishment_id.is.null,establishment_id.eq.${tenant.establishmentId}`)
        .order("name", { ascending: true });

      if (!legacyStationsResult.error) {
        stations = (legacyStationsResult.data ?? []) as MusicStationRow[];
      } else if (!isSchemaCompatibilityError(legacyStationsResult.error)) {
        console.error("[music-player] stations error:", legacyStationsResult.error);
      }
    } else {
      console.error("[music-player] stations error:", stationsResult.error);
    }
  } else {
    stations = (stationsResult.data ?? []) as MusicStationRow[];
  }

  const safeStations: NormalizedMusicStation[] = stations.map((station) => ({
    id: station.id,
    name: station.name,
    streamUrl: station.stream_url,
    sourceType: station.source_type === "youtube" ? "youtube" : "stream",
    externalUrl: station.external_url ?? null,
    youtubeVideoId: station.youtube_video_id ?? null,
    youtubePlaylistId: station.youtube_playlist_id ?? null,
    logoUrl: station.logo_url,
    genre: station.genre,
    country: station.country,
  }));
  const legacyStation = stationFromLegacySettings(
    legacySettings ?? settings,
    tenant.establishmentId
  );
  const allStations = dedupeStations([...safeStations, legacyStation]);
  const configuredDefaultStationId = String(
    (settings as any)?.default_station_id ?? ""
  ).trim();
  const defaultStationId =
    allStations.some((station) => station.id === configuredDefaultStationId)
      ? configuredDefaultStationId
      : allStations.some((station) => station.id === legacyStation?.id)
        ? legacyStation?.id ?? null
        : allStations[0]?.id ?? null;

  return NextResponse.json(
    {
      enabled: Boolean(settings?.enabled) && allStations.length > 0,
      autoplay: false,
      canManage: canManageMusic(tenant.role),
      defaultVolume: Number(settings?.default_volume ?? 0.6),
      defaultStationId,
      stations: allStations,
    },
    {
      headers: privateCacheHeaders(20),
    }
  );
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "music-player-settings",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const tenant = await getCurrentTenant();

  if (!tenant?.establishmentId) {
    return NextResponse.json({ error: "Empresa ativa não encontrada." }, { status: 401 });
  }

  if (!canManageMusic(tenant.role)) {
    return NextResponse.json({ error: "Sem permissão para configurar a rádio." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "");
  const supabaseAdmin = getSupabaseAdminClient();

  try {
    if (action === "add-station") {
      const name = normalizeStationName(body?.name);
      const source = normalizeStationSource(body?.streamUrl);
      const genre = String(body?.genre ?? "").trim().slice(0, 80) || null;

      const { data: station, error } = await supabaseAdmin
        .from("music_radio_stations")
        .insert({
          establishment_id: tenant.establishmentId,
          name,
          stream_url: source.streamUrl,
          source_type: source.sourceType,
          external_url: source.externalUrl,
          youtube_video_id: source.youtubeVideoId,
          youtube_playlist_id: source.youtubePlaylistId,
          genre,
          country: "BR",
          is_active: true,
        })
        .select(
          "id, name, stream_url, source_type, external_url, youtube_video_id, youtube_playlist_id, logo_url, genre, country"
        )
        .single();

      if (error) {
        console.error("[music-player] add station error:", serializeSupabaseError(error));
        throw new Error("Não foi possível cadastrar a rádio.");
      }

      if (body?.setDefault !== false) {
        const { error: settingsError } = await supabaseAdmin.from("music_player_settings").upsert(
          {
            establishment_id: tenant.establishmentId,
            enabled: true,
            default_station_id: station.id,
            station_name: station.name,
            stream_url: station.stream_url,
            source_type: station.source_type,
            external_url: station.external_url,
            youtube_video_id: station.youtube_video_id,
            youtube_playlist_id: station.youtube_playlist_id,
            genre: station.genre,
            default_volume: clampDefaultVolume(body?.defaultVolume),
            updated_by: tenant.userId,
          },
          { onConflict: "establishment_id" }
        );

        if (settingsError) throw settingsError;
      }

      return NextResponse.json({ ok: true });
    }

    if (action === "set-default") {
      const stationId = String(body?.stationId ?? "").trim();
      const defaultVolume = clampDefaultVolume(body?.defaultVolume);

      if (!stationId) {
        throw new Error("Selecione uma rádio.");
      }

      if (stationId.startsWith("settings-")) {
        const { error } = await supabaseAdmin.from("music_player_settings").upsert(
          {
            establishment_id: tenant.establishmentId,
            enabled: true,
            default_volume: defaultVolume,
            updated_by: tenant.userId,
          },
          { onConflict: "establishment_id" }
        );

        if (error) throw error;

        return NextResponse.json({ ok: true });
      }

      const { data: station, error: stationError } = await supabaseAdmin
        .from("music_radio_stations")
        .select(
          "id, establishment_id, name, stream_url, source_type, external_url, youtube_video_id, youtube_playlist_id, genre"
        )
        .eq("id", stationId)
        .eq("is_active", true)
        .maybeSingle();

      if (stationError) throw stationError;
      if (
        !station ||
        (station.establishment_id && station.establishment_id !== tenant.establishmentId)
      ) {
        throw new Error("Rádio inválida para este estabelecimento.");
      }

      const { error } = await supabaseAdmin.from("music_player_settings").upsert(
        {
          establishment_id: tenant.establishmentId,
          enabled: true,
          default_station_id: station.id,
          station_name: station.name,
          stream_url: station.stream_url,
          source_type: station.source_type,
          external_url: station.external_url,
          youtube_video_id: station.youtube_video_id,
          youtube_playlist_id: station.youtube_playlist_id,
          genre: station.genre,
          default_volume: defaultVolume,
          updated_by: tenant.userId,
        },
        { onConflict: "establishment_id" }
      );

      if (error) throw error;

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (error: any) {
    console.error("[music-player] settings save error:", serializeSupabaseError(error));
    return NextResponse.json(
      { error: error?.message ?? "Não foi possível salvar a configuração." },
      { status: 400 }
    );
  }
}
