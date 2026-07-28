"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  ExternalLink,
  Heart,
  Loader2,
  Minimize2,
  Pause,
  Play,
  Radio,
  RefreshCw,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MusicStation = {
  id: string;
  name: string;
  streamUrl: string;
  sourceType?: "stream" | "youtube";
  externalUrl?: string | null;
  youtubeVideoId?: string | null;
  youtubePlaylistId?: string | null;
  logoUrl?: string | null;
  genre?: string | null;
  country?: string | null;
};

type MusicSettings = {
  enabled: boolean;
  autoplay: boolean;
  canManage: boolean;
  defaultVolume: number;
  defaultStationId: string | null;
  stations: MusicStation[];
};

type PlaybackStatus = "idle" | "loading" | "playing" | "paused" | "error";

type UserMusicPlayerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const STORAGE_VOLUME_KEY = "gestify.musicPlayer.volume";
const STORAGE_MUTED_KEY = "gestify.musicPlayer.muted";
const STORAGE_STATION_KEY = "gestify.musicPlayer.stationId";
const STORAGE_FAVORITES_KEY = "gestify.musicPlayer.favoriteStationIds";

function clampVolume(value: number) {
  if (!Number.isFinite(value)) return 0.6;
  return Math.min(1, Math.max(0, value));
}

function readStoredNumber(key: string, fallback: number) {
  if (typeof window === "undefined") return fallback;

  const value = Number(window.localStorage.getItem(key));
  return Number.isFinite(value) ? value : fallback;
}

function readStoredBoolean(key: string, fallback: boolean) {
  if (typeof window === "undefined") return fallback;

  const value = window.localStorage.getItem(key);
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function readStoredFavorites() {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_FAVORITES_KEY) ?? "[]"
    );

    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function isInterruptedPlayError(error: any) {
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? "").toLowerCase();

  return (
    name === "AbortError" ||
    message.includes("interrupted by a new load request") ||
    message.includes("interrupted by a call to pause")
  );
}

function getYouTubeEmbedSrc(station: MusicStation | null) {
  if (!station || station.sourceType !== "youtube") return null;
  return station.streamUrl;
}

export function UserMusicPlayer({ open, onOpenChange }: UserMusicPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeAfterStationChangeRef = useRef(false);
  const playRequestIdRef = useRef(0);
  const selectedStationRef = useRef<MusicStation | null>(null);

  const [settings, setSettings] = useState<MusicSettings | null>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.6);
  const [muted, setMuted] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [newStationUrl, setNewStationUrl] = useState("");
  const [newStationGenre, setNewStationGenre] = useState("");
  const [youtubeFrameVersion, setYoutubeFrameVersion] = useState(0);
  const [favoriteStationIds, setFavoriteStationIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    setVolume(clampVolume(readStoredNumber(STORAGE_VOLUME_KEY, 0.6)));
    setMuted(readStoredBoolean(STORAGE_MUTED_KEY, false));
    setSelectedStationId(window.localStorage.getItem(STORAGE_STATION_KEY));
    setFavoriteStationIds(readStoredFavorites());
  }, []);

  const loadSettings = useCallback(async (options?: { preserveVolume?: boolean }) => {
    try {
      setLoadingSettings(true);
      const response = await fetch("/api/music-player/settings", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Não foi possível carregar a rádio.");
      }

      const data = (await response.json()) as MusicSettings;

      setSettings(data);
      if (!options?.preserveVolume) {
        setVolume(
          clampVolume(readStoredNumber(STORAGE_VOLUME_KEY, data.defaultVolume))
        );
      }

      setSelectedStationId((current) => {
        const stored = current || window.localStorage.getItem(STORAGE_STATION_KEY);
        const hasStored = data.stations.some((station) => station.id === stored);
        return hasStored ? stored : data.defaultStationId;
      });
    } catch (error: any) {
      console.error("[music-player] load error:", error);
      setMessage(error?.message ?? "Não foi possível carregar a rádio.");
    } finally {
      setLoadingSettings(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const stations = settings?.stations ?? [];

  const selectedStation = useMemo(
    () =>
      stations.find((station) => station.id === selectedStationId) ??
      stations[0] ??
      null,
    [selectedStationId, stations]
  );

  useEffect(() => {
    selectedStationRef.current = selectedStation;
  }, [selectedStation]);

  const selectedSourceType = selectedStation?.sourceType ?? "stream";
  const selectedIsYouTube = selectedSourceType === "youtube";
  const youtubeEmbedSrc = useMemo(
    () => getYouTubeEmbedSrc(selectedStation),
    [selectedStation]
  );

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isInterruptedPlayError(event.reason)) {
        event.preventDefault();
      }
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (isInterruptedPlayError(event.error) || isInterruptedPlayError(event.message)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = volume;
    audio.muted = muted;

    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_VOLUME_KEY, String(volume));
      window.localStorage.setItem(STORAGE_MUTED_KEY, String(muted));
    }
  }, [volume, muted]);

  const play = useCallback(async () => {
    const audio = audioRef.current;
    const station = selectedStationRef.current;
    if (!audio || !station || !settings?.enabled) return;

    if (station.sourceType === "youtube") {
      audio.pause();
      setStatus("paused");
      setMessage(null);
      onOpenChange(true);
      return;
    }

    try {
      setMessage(null);
      setStatus("loading");
      const requestId = ++playRequestIdRef.current;

      if (audio.src !== station.streamUrl) {
        audio.pause();
        audio.src = station.streamUrl;
      }

      await audio.play();
      if (playRequestIdRef.current === requestId) {
        setStatus("playing");
      }
    } catch (error: any) {
      if (isInterruptedPlayError(error)) {
        return;
      }

      setStatus("error");
      setMessage(
        error?.name === "NotAllowedError"
          ? "Toque em play para liberar o áudio neste navegador."
          : "Não foi possível iniciar a transmissão."
      );
    }
  }, [onOpenChange, settings?.enabled]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !selectedStation) return;

    if (selectedStation.sourceType === "youtube") {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      setStatus("paused");
      window.localStorage.setItem(STORAGE_STATION_KEY, selectedStation.id);
      return;
    }

    if (
      audio.src !== selectedStation.streamUrl &&
      audio.paused &&
      status !== "loading"
    ) {
      audio.src = selectedStation.streamUrl;
    }

    window.localStorage.setItem(STORAGE_STATION_KEY, selectedStation.id);

    if (resumeAfterStationChangeRef.current && settings?.enabled) {
      resumeAfterStationChangeRef.current = false;
      window.setTimeout(() => {
        void play();
      }, 0);
    }
  }, [play, selectedStation, settings?.enabled, status]);

  useEffect(() => {
    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    playRequestIdRef.current += 1;
    audio.pause();
    setStatus("paused");
  }, []);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
    }

    reconnectTimerRef.current = setTimeout(() => {
      if (status === "playing" || status === "loading") {
        void play();
      }
    }, 3000);
  }, [play, status]);

  const selectStation = (stationId: string) => {
    const nextStation = stations.find((station) => station.id === stationId);
    playRequestIdRef.current += 1;
    resumeAfterStationChangeRef.current =
      nextStation?.sourceType !== "youtube" &&
      (status === "playing" || status === "loading");
    setSelectedStationId(stationId);
    setStatus((current) => {
      if (nextStation?.sourceType === "youtube") return "paused";
      return current === "playing" ? "loading" : current;
    });
  };

  const toggleFavorite = () => {
    if (!selectedStation) return;

    setFavoriteStationIds((current) => {
      const next = new Set(current);
      if (next.has(selectedStation.id)) {
        next.delete(selectedStation.id);
      } else {
        next.add(selectedStation.id);
      }

      window.localStorage.setItem(
        STORAGE_FAVORITES_KEY,
        JSON.stringify(Array.from(next))
      );

      return next;
    });
  };

  const openSelectedYouTube = () => {
    if (!selectedStation || selectedStation.sourceType !== "youtube") return;

    window.open(
      selectedStation.externalUrl ?? selectedStation.streamUrl,
      "gestify-youtube-player",
      "popup,width=520,height=740"
    );
  };

  const selectNextStation = () => {
    if (stations.length <= 1 || !selectedStation) return;

    const currentIndex = stations.findIndex(
      (station) => station.id === selectedStation.id
    );
    const next = stations[(currentIndex + 1) % stations.length];
    if (next) selectStation(next.id);
  };

  const saveDefaultStation = async () => {
    if (!selectedStation) return;

    try {
      setSavingSettings(true);
      setMessage(null);

      const response = await fetch("/api/music-player/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set-default",
          stationId: selectedStation.id,
          defaultVolume: volume,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "Não foi possível salvar a rádio padrão.");
      }

      setMessage("Rádio padrão salva para o estabelecimento.");
      await loadSettings({ preserveVolume: true });
    } catch (error: any) {
      setMessage(error?.message ?? "Não foi possível salvar a rádio padrão.");
    } finally {
      setSavingSettings(false);
    }
  };

  const addStation = async () => {
    try {
      setSavingSettings(true);
      setMessage(null);

      const response = await fetch("/api/music-player/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add-station",
          name: newStationName,
          streamUrl: newStationUrl,
          genre: newStationGenre,
          defaultVolume: volume,
          setDefault: true,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error ?? "Não foi possível cadastrar a rádio.");
      }

      setNewStationName("");
      setNewStationUrl("");
      setNewStationGenre("");
      setMessage("Rádio cadastrada e definida como padrão.");
      await loadSettings({ preserveVolume: true });
    } catch (error: any) {
      setMessage(error?.message ?? "Não foi possível cadastrar a rádio.");
    } finally {
      setSavingSettings(false);
    }
  };

  const isPlaying =
    !selectedIsYouTube && (status === "playing" || status === "loading");
  const isFavorite = selectedStation
    ? favoriteStationIds.has(selectedStation.id)
    : false;

  return (
    <>
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setStatus("playing")}
        onPause={() => setStatus((current) => (current === "error" ? current : "paused"))}
        onWaiting={() => setStatus("loading")}
        onStalled={() => {
          setStatus("loading");
          scheduleReconnect();
        }}
        onError={() => {
          setStatus("error");
          setMessage("Conexão da rádio interrompida. Tentando reconectar.");
          scheduleReconnect();
        }}
      />

      {!open ? (
        <button
          type="button"
          className="fixed bottom-4 right-3 z-[70] flex max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-left shadow-xl transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 dark:focus:ring-slate-700 sm:right-4"
          aria-label="Expandir player de música"
          onClick={() => onOpenChange(true)}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-slate-100">
            {status === "loading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPlaying ? (
              <Radio className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </span>
          <span className="min-w-0">
            <span className="block max-w-44 truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
              {selectedStation?.name ?? "Música"}
            </span>
            <span className="block truncate text-xs text-gray-500 dark:text-slate-400">
              {selectedIsYouTube
                ? "YouTube"
                : isPlaying
                  ? "Tocando agora"
                  : "Player minimizado"}
            </span>
          </span>
        </button>
      ) : (
        <div className="fixed right-3 top-20 z-[70] max-h-[calc(100vh-6rem)] w-[calc(100vw-1.5rem)] max-w-sm overflow-y-auto rounded-md border border-gray-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900 sm:right-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-700 dark:bg-slate-800 dark:text-slate-100">
                <Radio className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {selectedStation?.name ?? "Música"}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                  {loadingSettings
                    ? "Carregando rádios"
                    : settings?.enabled
                      ? selectedStation?.genre ?? "Rádio online"
                      : "Rádio não configurada"}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Minimizar player"
              onClick={() => onOpenChange(false)}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            {!selectedIsYouTube ? (
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 shrink-0"
                aria-label={isPlaying ? "Pausar rádio" : "Tocar rádio"}
                disabled={!settings?.enabled || !selectedStation || loadingSettings}
                onClick={() => {
                  if (isPlaying) {
                    pause();
                  } else {
                    void play();
                  }
                }}
              >
                {status === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                className="h-10 w-10 shrink-0"
                aria-label="Abrir no YouTube"
                disabled={!selectedStation}
                onClick={openSelectedYouTube}
              >
                <Play className="h-4 w-4" />
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              aria-label="Próxima rádio"
              disabled={stations.length <= 1}
              onClick={selectNextStation}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn("h-10 w-10 shrink-0", isFavorite && "text-red-600")}
              aria-label="Favoritar rádio"
              disabled={!selectedStation}
              onClick={toggleFavorite}
            >
              <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
            </Button>

            {!selectedIsYouTube ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                aria-label="Reconectar rádio"
                disabled={!settings?.enabled || !selectedStation}
                onClick={() => void play()}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                aria-label="Recarregar YouTube"
                disabled={!selectedStation}
                onClick={() => setYoutubeFrameVersion((current) => current + 1)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {selectedIsYouTube && youtubeEmbedSrc ? (
            <div className="mt-3 overflow-hidden rounded-md border border-gray-200 bg-black dark:border-slate-700">
              <iframe
                key={`${selectedStation?.id}-${youtubeFrameVersion}`}
                title={selectedStation?.name ?? "YouTube"}
                src={youtubeEmbedSrc}
                className="h-[210px] w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div className="flex items-center justify-between gap-2 bg-white p-2 dark:bg-slate-900">
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  Player oficial do YouTube
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={openSelectedYouTube}
                >
                  <ExternalLink className="mr-1 h-3.5 w-3.5" />
                  Abrir no YouTube
                </Button>
              </div>
            </div>
          ) : null}

          {!selectedIsYouTube ? (
            <div className="mt-4 rounded-md border border-gray-200 p-3 dark:border-slate-700">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  Volume
                </span>
                <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold tabular-nums text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  aria-label={muted ? "Ativar som" : "Silenciar"}
                  onClick={() => setMuted((current) => !current)}
                >
                  {muted || volume === 0 ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
                <input
                  type="range"
                  aria-label="Volume da rádio"
                  className="h-8 min-w-0 flex-1 accent-blue-600"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(volume * 100)}
                  onChange={(event) =>
                    setVolume(clampVolume(Number(event.currentTarget.value) / 100))
                  }
                />
              </div>
            </div>
          ) : null}

          <div className="mt-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                Fontes
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                {stations.length}
              </span>
            </div>
            <div className="grid max-h-36 gap-2 overflow-y-auto pr-1">
              {stations.map((station) => {
                const active = station.id === selectedStation?.id;

                return (
                  <button
                    type="button"
                    key={station.id}
                    className={cn(
                      "flex min-h-10 items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition",
                      active
                        ? "border-blue-500 bg-blue-50 text-blue-900 dark:border-blue-400 dark:bg-blue-950/40 dark:text-blue-100"
                        : "border-gray-200 hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    )}
                    onClick={() => selectStation(station.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {station.name}
                      </span>
                      <span className="block truncate text-xs text-gray-500 dark:text-slate-400">
                        {station.sourceType === "youtube"
                          ? "YouTube"
                          : station.genre ?? station.country ?? "Rádio online"}
                      </span>
                    </span>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {settings?.canManage ? (
            <div className="mt-3 rounded-md border border-gray-200 p-3 dark:border-slate-700">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
                  Configuração
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={!selectedStation || savingSettings}
                  onClick={() => {
                    if (showSettings) {
                      void saveDefaultStation();
                    } else {
                      setShowSettings(true);
                    }
                  }}
                >
                  {savingSettings ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {showSettings ? "Salvar padrão" : "Configurar"}
                </Button>
              </div>

              {showSettings ? (
                <div className="mt-3 grid gap-2">
                  <Input
                    value={newStationName}
                    onChange={(event) => setNewStationName(event.target.value)}
                    placeholder="Nome da rádio"
                    className="h-9"
                  />
                  <Input
                    value={newStationUrl}
                    onChange={(event) => setNewStationUrl(event.target.value)}
                    placeholder="https://.../stream.mp3 ou YouTube"
                    className="h-9"
                  />
                  <Input
                    value={newStationGenre}
                    onChange={(event) => setNewStationGenre(event.target.value)}
                    placeholder="Ambiente, salão, cozinha..."
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-9"
                    disabled={savingSettings || !newStationName || !newStationUrl}
                    onClick={() => void addStation()}
                  >
                    Cadastrar e usar
                  </Button>
                  <p className="text-xs leading-5 text-gray-500 dark:text-slate-400">
                    YouTube será exibido no player oficial visível. Para som
                    ambiente, mantenha o licenciamento de execução pública.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {message ? (
            <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{message}</span>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
