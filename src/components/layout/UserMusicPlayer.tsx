"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import {
  Loader2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Save,
  Settings2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type MusicPlayerSettings = {
  enabled: boolean;
  stationName: string;
  streamUrl: string | null;
  logoUrl: string | null;
  genre: string | null;
  defaultVolume: number;
  canManage: boolean;
};

type MusicPlayerDraft = Omit<MusicPlayerSettings, "canManage">;

type PlayerStatus =
  | "idle"
  | "loading"
  | "ready"
  | "connecting"
  | "playing"
  | "paused"
  | "buffering"
  | "disabled"
  | "error";

type MusicPlayerContextValue = {
  settings: MusicPlayerSettings;
  loading: boolean;
  saving: boolean;
  status: PlayerStatus;
  error: string | null;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  togglePlayback: () => Promise<void>;
  reconnect: () => Promise<void>;
  changeVolume: (value: number) => void;
  toggleMuted: () => void;
  saveSettings: (draft: MusicPlayerDraft) => Promise<void>;
};

const DEFAULT_SETTINGS: MusicPlayerSettings = {
  enabled: false,
  stationName: "Rádio do estabelecimento",
  streamUrl: null,
  logoUrl: null,
  genre: null,
  defaultVolume: 0.65,
  canManage: false,
};

const RECONNECT_DELAYS_MS = [2_000, 4_000, 8_000, 15_000, 30_000];
const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

function storageKey(establishmentId: string, key: "volume" | "muted") {
  return `gestify:music-player:${key}:${establishmentId}`;
}

function readStoredVolume(establishmentId: string, fallback: number) {
  if (typeof window === "undefined") return fallback;

  const parsed = Number(
    window.localStorage.getItem(storageKey(establishmentId, "volume"))
  );

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? parsed
    : fallback;
}

function readStoredMuted(establishmentId: string) {
  if (typeof window === "undefined") return false;
  return (
    window.localStorage.getItem(storageKey(establishmentId, "muted")) ===
    "true"
  );
}

function statusLabel(status: PlayerStatus) {
  switch (status) {
    case "loading":
      return "Carregando rádio";
    case "connecting":
      return "Conectando";
    case "playing":
      return "Ao vivo";
    case "paused":
      return "Pausada";
    case "buffering":
      return "Reconectando";
    case "disabled":
      return "Desativada";
    case "error":
      return "Falha na transmissão";
    default:
      return "Pronta";
  }
}

function normalizePlayerSettings(value: Partial<MusicPlayerSettings>) {
  const volume = Number(value.defaultVolume);

  return {
    enabled: value.enabled === true,
    stationName:
      String(value.stationName ?? "").trim() || DEFAULT_SETTINGS.stationName,
    streamUrl: value.streamUrl ? String(value.streamUrl) : null,
    logoUrl: value.logoUrl ? String(value.logoUrl) : null,
    genre: value.genre ? String(value.genre) : null,
    defaultVolume:
      Number.isFinite(volume) && volume >= 0 && volume <= 1
        ? volume
        : DEFAULT_SETTINGS.defaultVolume,
    canManage: value.canManage === true,
  } satisfies MusicPlayerSettings;
}

export function MusicPlayerProvider({
  establishmentId,
  children,
}: {
  establishmentId?: string | null;
  children: ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const requestedPlayingRef = useRef(false);
  const settingsRef = useRef<MusicPlayerSettings>(DEFAULT_SETTINGS);
  const volumeRef = useRef(DEFAULT_SETTINGS.defaultVolume);
  const mutedRef = useRef(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_SETTINGS.defaultVolume);
  const [muted, setMuted] = useState(false);

  const updateSettingsState = useCallback((next: MusicPlayerSettings) => {
    settingsRef.current = next;
    setSettings(next);
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (!reconnectTimerRef.current) return;
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const stopPlayback = useCallback(
    (nextStatus?: PlayerStatus) => {
      requestedPlayingRef.current = false;
      reconnectAttemptRef.current = 0;
      clearReconnectTimer();

      const audio = audioRef.current;
      if (audio && !audio.paused) audio.pause();

      setIsPlaying(false);
      setStatus(
        nextStatus ??
          (settingsRef.current.enabled && settingsRef.current.streamUrl
            ? "paused"
            : "disabled")
      );
    },
    [clearReconnectTimer]
  );

  const playCurrentStream = useCallback(async () => {
    const audio = audioRef.current;
    const currentSettings = settingsRef.current;

    if (!audio || !currentSettings.enabled || !currentSettings.streamUrl) {
      setError("A rádio ainda não foi configurada para esta empresa.");
      setStatus(currentSettings.enabled ? "error" : "disabled");
      return;
    }

    clearReconnectTimer();
    requestedPlayingRef.current = true;
    setError(null);
    setStatus("connecting");

    if (audio.getAttribute("src") !== currentSettings.streamUrl) {
      audio.src = currentSettings.streamUrl;
    }

    audio.volume = volumeRef.current;
    audio.muted = mutedRef.current;

    try {
      await audio.play();
      reconnectAttemptRef.current = 0;
    } catch (playError) {
      const errorName =
        playError instanceof DOMException ? playError.name : "UnknownError";

      requestedPlayingRef.current = false;
      setIsPlaying(false);
      setStatus("error");
      setError(
        errorName === "NotAllowedError"
          ? "Toque novamente em reproduzir para liberar o áudio neste navegador."
          : "Não foi possível iniciar a transmissão. Verifique a URL da rádio."
      );
    }
  }, [clearReconnectTimer]);

  const scheduleReconnect = useCallback(() => {
    const currentSettings = settingsRef.current;

    if (
      !requestedPlayingRef.current ||
      !currentSettings.enabled ||
      !currentSettings.streamUrl
    ) {
      return;
    }

    clearReconnectTimer();
    reconnectAttemptRef.current = Math.min(
      reconnectAttemptRef.current + 1,
      RECONNECT_DELAYS_MS.length
    );

    const delay =
      RECONNECT_DELAYS_MS[reconnectAttemptRef.current - 1] ??
      RECONNECT_DELAYS_MS.at(-1) ??
      30_000;

    setIsPlaying(false);
    setStatus("buffering");
    setError("A conexão caiu. Tentando reconectar automaticamente.");

    reconnectTimerRef.current = setTimeout(() => {
      if (!requestedPlayingRef.current) return;
      const audio = audioRef.current;
      if (!audio) return;

      audio.load();
      void audio.play().catch(() => scheduleReconnect());
    }, delay);
  }, [clearReconnectTimer]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      stopPlayback("idle");

      if (!establishmentId) {
        updateSettingsState(DEFAULT_SETTINGS);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setStatus("loading");
        setError(null);

        const response = await fetch("/api/music-player/settings", {
          method: "GET",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
        });

        const payload = (await response.json().catch(() => ({}))) as
          | Partial<MusicPlayerSettings>
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Não foi possível carregar a rádio."
          );
        }

        if (cancelled) return;

        const nextSettings = normalizePlayerSettings(payload);
        const nextVolume = readStoredVolume(
          establishmentId,
          nextSettings.defaultVolume
        );
        const nextMuted = readStoredMuted(establishmentId);

        updateSettingsState(nextSettings);
        volumeRef.current = nextVolume;
        mutedRef.current = nextMuted;
        setVolume(nextVolume);
        setMuted(nextMuted);
        setStatus(
          nextSettings.enabled && nextSettings.streamUrl ? "ready" : "disabled"
        );

        const audio = audioRef.current;
        if (audio) {
          audio.removeAttribute("src");
          audio.load();
          audio.volume = nextVolume;
          audio.muted = nextMuted;
        }
      } catch (loadError) {
        if (cancelled) return;

        const message =
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar a rádio.";

        console.error("Erro ao carregar o player de música:", loadError);
        updateSettingsState(DEFAULT_SETTINGS);
        setStatus("error");
        setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [establishmentId, stopPlayback, updateSettingsState]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlaying = () => {
      reconnectAttemptRef.current = 0;
      setError(null);
      setIsPlaying(true);
      setStatus("playing");
    };
    const onPause = () => {
      setIsPlaying(false);
      if (!requestedPlayingRef.current) {
        setStatus(
          settingsRef.current.enabled && settingsRef.current.streamUrl
            ? "paused"
            : "disabled"
        );
      }
    };
    const onWaiting = () => {
      if (requestedPlayingRef.current) setStatus("buffering");
    };

    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("stalled", onWaiting);
    audio.addEventListener("error", scheduleReconnect);
    audio.addEventListener("ended", scheduleReconnect);

    return () => {
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("stalled", onWaiting);
      audio.removeEventListener("error", scheduleReconnect);
      audio.removeEventListener("ended", scheduleReconnect);
    };
  }, [scheduleReconnect]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: settings.stationName,
        artist: settings.genre ?? "Rádio online",
        album: "Gestify",
        artwork: settings.logoUrl
          ? [{ src: settings.logoUrl, sizes: "512x512" }]
          : undefined,
      });
      navigator.mediaSession.setActionHandler("play", () => {
        void playCurrentStream();
      });
      navigator.mediaSession.setActionHandler("pause", () => stopPlayback());
    } catch {
      // Alguns navegadores expõem Media Session apenas parcialmente.
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
      } catch {
        // Sem ação necessária.
      }
    };
  }, [playCurrentStream, settings, stopPlayback]);

  useEffect(() => {
    return () => {
      requestedPlayingRef.current = false;
      clearReconnectTimer();
      audioRef.current?.pause();
    };
  }, [clearReconnectTimer]);

  const togglePlayback = useCallback(async () => {
    if (isPlaying || requestedPlayingRef.current) {
      stopPlayback();
      return;
    }

    await playCurrentStream();
  }, [isPlaying, playCurrentStream, stopPlayback]);

  const reconnect = useCallback(async () => {
    const audio = audioRef.current;

    requestedPlayingRef.current = false;
    reconnectAttemptRef.current = 0;
    clearReconnectTimer();

    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    await playCurrentStream();
  }, [clearReconnectTimer, playCurrentStream]);

  const changeVolume = useCallback(
    (nextValue: number) => {
      const normalized = Math.min(Math.max(nextValue, 0), 1);
      volumeRef.current = normalized;
      setVolume(normalized);

      if (audioRef.current) audioRef.current.volume = normalized;

      if (establishmentId && typeof window !== "undefined") {
        window.localStorage.setItem(
          storageKey(establishmentId, "volume"),
          String(normalized)
        );
      }
    },
    [establishmentId]
  );

  const toggleMuted = useCallback(() => {
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setMuted(nextMuted);

    if (audioRef.current) audioRef.current.muted = nextMuted;

    if (establishmentId && typeof window !== "undefined") {
      window.localStorage.setItem(
        storageKey(establishmentId, "muted"),
        String(nextMuted)
      );
    }
  }, [establishmentId]);

  const saveSettings = useCallback(
    async (draft: MusicPlayerDraft) => {
      try {
        setSaving(true);
        setError(null);

        const response = await fetch("/api/music-player/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });

        const payload = (await response.json().catch(() => ({}))) as
          | Partial<MusicPlayerSettings>
          | { error?: string };

        if (!response.ok) {
          throw new Error(
            "error" in payload && payload.error
              ? payload.error
              : "Não foi possível salvar a rádio."
          );
        }

        stopPlayback();
        const nextSettings = normalizePlayerSettings(payload);
        updateSettingsState(nextSettings);
        setStatus(
          nextSettings.enabled && nextSettings.streamUrl ? "ready" : "disabled"
        );

        if (establishmentId && typeof window !== "undefined") {
          const nextVolume = readStoredVolume(
            establishmentId,
            nextSettings.defaultVolume
          );
          volumeRef.current = nextVolume;
          setVolume(nextVolume);
        }
      } catch (saveError) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "Não foi possível salvar a rádio.";

        console.error("Erro ao salvar a rádio:", saveError);
        setError(message);
        throw saveError;
      } finally {
        setSaving(false);
      }
    },
    [establishmentId, stopPlayback, updateSettingsState]
  );

  const contextValue = useMemo<MusicPlayerContextValue>(
    () => ({
      settings,
      loading,
      saving,
      status,
      error,
      isPlaying,
      volume,
      muted,
      togglePlayback,
      reconnect,
      changeVolume,
      toggleMuted,
      saveSettings,
    }),
    [
      changeVolume,
      error,
      isPlaying,
      loading,
      muted,
      reconnect,
      saveSettings,
      saving,
      settings,
      status,
      toggleMuted,
      togglePlayback,
      volume,
    ]
  );

  return (
    <MusicPlayerContext.Provider value={contextValue}>
      {children}
      <audio ref={audioRef} preload="none" className="hidden" />
    </MusicPlayerContext.Provider>
  );
}

function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);

  if (!context) {
    throw new Error("UserMusicPlayer deve estar dentro de MusicPlayerProvider.");
  }

  return context;
}

function createDraft(settings: MusicPlayerSettings): MusicPlayerDraft {
  return {
    enabled: settings.enabled,
    stationName: settings.stationName,
    streamUrl: settings.streamUrl,
    logoUrl: settings.logoUrl,
    genre: settings.genre,
    defaultVolume: settings.defaultVolume,
  };
}

export function UserMusicPlayerMenu() {
  const player = useMusicPlayer();
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState<MusicPlayerDraft>(() =>
    createDraft(player.settings)
  );

  useEffect(() => {
    setDraft(createDraft(player.settings));
  }, [player.settings]);

  const preventMenuClose = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const saveConfiguration = async () => {
    setSavedMessage(null);

    try {
      await player.saveSettings(draft);
      setSavedMessage("Configuração salva.");
      setShowConfiguration(false);
    } catch {
      // O erro já é exibido no painel.
    }
  };

  const statusColor =
    player.status === "playing"
      ? "bg-emerald-500"
      : player.status === "error"
        ? "bg-red-500"
        : player.status === "buffering" || player.status === "connecting"
          ? "bg-amber-500"
          : "bg-gray-400";

  return (
    <div
      className="px-2 py-2"
      onClick={preventMenuClose}
      onPointerDown={preventMenuClose}
      onKeyDown={preventMenuClose}
    >
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-slate-700 dark:bg-slate-800/70">
        <div className="flex items-start gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white bg-cover bg-center shadow-sm dark:bg-slate-900"
            style={
              player.settings.logoUrl
                ? { backgroundImage: `url(${player.settings.logoUrl})` }
                : undefined
            }
            role={player.settings.logoUrl ? "img" : undefined}
            aria-label={
              player.settings.logoUrl
                ? `Logotipo da ${player.settings.stationName}`
                : undefined
            }
          >
            {!player.settings.logoUrl ? (
              <Music2 className="h-5 w-5 text-blue-600 dark:text-blue-300" />
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", statusColor)} />
              <span className="truncate text-xs text-gray-500 dark:text-slate-400">
                {player.loading ? "Carregando" : statusLabel(player.status)}
              </span>
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
              {player.settings.stationName}
            </div>
            {player.settings.genre ? (
              <div className="truncate text-xs text-gray-500 dark:text-slate-400">
                {player.settings.genre}
              </div>
            ) : null}
          </div>

          {player.settings.canManage ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Configurar rádio"
              onClick={() => {
                setSavedMessage(null);
                setShowConfiguration((current) => !current);
              }}
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-full"
            disabled={
              player.loading ||
              !player.settings.enabled ||
              !player.settings.streamUrl
            }
            aria-label={player.isPlaying ? "Pausar rádio" : "Reproduzir rádio"}
            onClick={() => void player.togglePlayback()}
          >
            {player.loading || player.status === "connecting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : player.isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" />
            )}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={!player.settings.enabled || !player.settings.streamUrl}
            aria-label="Reconectar rádio"
            onClick={() => void player.reconnect()}
          >
            <RefreshCw
              className={cn(
                "h-4 w-4",
                player.status === "buffering" && "animate-spin"
              )}
            />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={player.muted ? "Ativar som" : "Silenciar"}
            onClick={player.toggleMuted}
          >
            {player.muted || player.volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>

          <Slider
            value={[Math.round(player.volume * 100)]}
            min={0}
            max={100}
            step={1}
            aria-label="Volume da rádio"
            onValueChange={(values) =>
              player.changeVolume((values[0] ?? 0) / 100)
            }
          />
        </div>

        {!player.settings.enabled || !player.settings.streamUrl ? (
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
            Rádio não configurada para esta empresa.
          </p>
        ) : null}

        {player.error ? (
          <p className="mt-2 rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
            {player.error}
          </p>
        ) : null}

        {savedMessage ? (
          <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
            {savedMessage}
          </p>
        ) : null}

        {showConfiguration && player.settings.canManage ? (
          <div className="mt-3 space-y-3 border-t border-gray-200 pt-3 dark:border-slate-700">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-medium text-gray-900 dark:text-slate-100">
                  Ativar player
                </div>
                <div className="text-[11px] text-gray-500 dark:text-slate-400">
                  Disponibiliza a rádio para todos desta empresa.
                </div>
              </div>
              <Switch
                checked={draft.enabled}
                onCheckedChange={(enabled) =>
                  setDraft((current) => ({ ...current, enabled }))
                }
              />
            </div>

            <label className="block">
              <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                Nome da rádio
              </span>
              <input
                type="text"
                value={draft.stationName}
                maxLength={120}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    stationName: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                URL HTTPS da transmissão MP3/AAC
              </span>
              <input
                type="url"
                value={draft.streamUrl ?? ""}
                placeholder="https://radio.exemplo.com/stream"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    streamUrl: event.target.value || null,
                  }))
                }
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                  Gênero
                </span>
                <input
                  type="text"
                  value={draft.genre ?? ""}
                  maxLength={80}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      genre: event.target.value || null,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                />
              </label>

              <label className="block">
                <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                  Volume padrão
                </span>
                <div className="mt-3 px-1">
                  <Slider
                    value={[Math.round(draft.defaultVolume * 100)]}
                    min={0}
                    max={100}
                    step={1}
                    onValueChange={(values) =>
                      setDraft((current) => ({
                        ...current,
                        defaultVolume: (values[0] ?? 65) / 100,
                      }))
                    }
                  />
                </div>
              </label>
            </div>

            <label className="block">
              <span className="text-xs font-medium text-gray-700 dark:text-slate-300">
                URL HTTPS do logotipo (opcional)
              </span>
              <input
                type="url"
                value={draft.logoUrl ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    logoUrl: event.target.value || null,
                  }))
                }
                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>

            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={player.saving}
              onClick={() => void saveConfiguration()}
            >
              {player.saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {player.saving ? "Salvando..." : "Salvar rádio"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
