"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, LocateFixed, MapPin, RefreshCw } from "lucide-react";

import {
  GESTIFY_USER_LOCATION_EVENT,
  GESTIFY_USER_LOCATION_STORAGE_KEY,
  isValidUserLocation,
  type GestifyUserLocation,
} from "@/lib/user-location";

type LocationStatus = "checking" | "prompting" | "granted" | "denied" | "unavailable" | "error";
const LOCATION_MESSAGE =
  "Por motivos de segurança e proteção aos dados do sistema, ativar a sua localização para poder usar o sistema.";
const DEV_FALLBACK_LOCATION: GestifyUserLocation = {
  latitude: -23.5505,
  longitude: -46.6333,
  accuracy: null,
  capturedAt: new Date().toISOString(),
};

function getErrorStatus(error: GeolocationPositionError): LocationStatus {
  if (error.code === error.PERMISSION_DENIED) return "denied";
  if (error.code === error.POSITION_UNAVAILABLE) return "unavailable";
  return "error";
}

function getMessage(status: LocationStatus) {
  switch (status) {
    case "denied":
      return "A permissão de localização está bloqueada neste navegador. Libere a localização do site e tente novamente.";
    case "unavailable":
      return "Não foi possível obter a localização atual do dispositivo. Verifique se o serviço de localização está ativo.";
    default:
      return LOCATION_MESSAGE;
  }
}

function publishLocation(position: GeolocationPosition) {
  const location: GestifyUserLocation = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    capturedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(GESTIFY_USER_LOCATION_STORAGE_KEY, JSON.stringify(location));
  } catch {
    // Storage is optional; the in-memory event still updates the active session.
  }

  window.dispatchEvent(new CustomEvent<GestifyUserLocation>(GESTIFY_USER_LOCATION_EVENT, { detail: location }));
  return location;
}

function publishLocationValue(location: GestifyUserLocation) {
  try {
    window.localStorage.setItem(
      GESTIFY_USER_LOCATION_STORAGE_KEY,
      JSON.stringify(location)
    );
  } catch {
    // Storage is optional; the in-memory event still updates the active session.
  }

  window.dispatchEvent(
    new CustomEvent<GestifyUserLocation>(GESTIFY_USER_LOCATION_EVENT, {
      detail: location,
    })
  );
  return location;
}

function canUseLocalhostFallback() {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1"].includes(window.location.hostname);
}

function readStoredLocation() {
  try {
    const raw = window.localStorage.getItem(GESTIFY_USER_LOCATION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<GestifyUserLocation>;
    if (!isValidUserLocation(parsed)) return null;

    return {
      latitude: Number(parsed.latitude),
      longitude: Number(parsed.longitude),
      accuracy: Number.isFinite(parsed.accuracy) ? Number(parsed.accuracy) : null,
      capturedAt:
        typeof parsed.capturedAt === "string" && parsed.capturedAt
          ? parsed.capturedAt
          : new Date().toISOString(),
    } satisfies GestifyUserLocation;
  } catch {
    return null;
  }
}

export function LocationPermissionGate() {
  const [status, setStatus] = useState<LocationStatus>("checking");
  const [location, setLocation] = useState<GestifyUserLocation | null>(null);
  const [requesting, setRequesting] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const latestLocationRef = useRef<GestifyUserLocation | null>(null);
  const requestIdRef = useRef(0);
  const requestTimeoutRef = useRef<number | null>(null);

  const acceptLocation = useCallback((nextLocation: GestifyUserLocation) => {
    latestLocationRef.current = nextLocation;
    setLocation(nextLocation);
    setStatus("granted");
    setRequesting(false);
  }, []);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const clearRequestTimeout = useCallback(() => {
    if (requestTimeoutRef.current !== null) {
      window.clearTimeout(requestTimeoutRef.current);
      requestTimeoutRef.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation || watchIdRef.current !== null) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        acceptLocation(publishLocation(position));
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          latestLocationRef.current = null;
          setLocation(null);
          setStatus("denied");
          setRequesting(false);
          stopWatching();
          return;
        }

        if (!latestLocationRef.current) {
          setStatus(getErrorStatus(error));
          setRequesting(false);
        }
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 45_000,
      },
    );
  }, [acceptLocation, stopWatching]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    clearRequestTimeout();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setRequesting(true);
    if (!latestLocationRef.current) setStatus("prompting");

    requestTimeoutRef.current = window.setTimeout(() => {
      if (requestId !== requestIdRef.current || latestLocationRef.current) return;
      if (canUseLocalhostFallback()) {
        clearRequestTimeout();
        acceptLocation(
          publishLocationValue({
            ...DEV_FALLBACK_LOCATION,
            capturedAt: new Date().toISOString(),
          })
        );
        return;
      }

      requestIdRef.current += 1;
      setRequesting(false);
      setStatus("prompting");
    }, 10_000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (requestId !== requestIdRef.current) return;
        clearRequestTimeout();
        acceptLocation(publishLocation(position));
        startWatching();
      },
      (error) => {
        if (requestId !== requestIdRef.current) return;
        clearRequestTimeout();
        if (latestLocationRef.current) {
          setStatus("granted");
        } else {
          setStatus(getErrorStatus(error));
        }
        setRequesting(false);
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 30_000,
      },
    );
  }, [acceptLocation, clearRequestTimeout, startWatching]);

  useEffect(() => {
    const storedLocation = readStoredLocation();
    if (storedLocation) acceptLocation(storedLocation);

    let permissionStatus: PermissionStatus | null = null;

    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          permissionStatus = result;
          if (result.state === "granted") {
            startWatching();
            requestLocation();
          } else if (!storedLocation) {
            setStatus(result.state === "denied" ? "denied" : "prompting");
            setRequesting(false);
          }

          result.onchange = () => {
            if (result.state === "denied") {
              latestLocationRef.current = null;
              setLocation(null);
              setStatus("denied");
              setRequesting(false);
              stopWatching();
              return;
            }

            if (result.state === "granted") {
              startWatching();
              requestLocation();
            } else if (!latestLocationRef.current) {
              setStatus("prompting");
              setRequesting(false);
            }
          };
        })
        .catch(() => {
          permissionStatus = null;
          if (!storedLocation) {
            setStatus("prompting");
            setRequesting(false);
          }
        });
    } else if (!storedLocation) {
      setStatus("prompting");
      setRequesting(false);
    }

    return () => {
      clearRequestTimeout();
      stopWatching();
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [acceptLocation, clearRequestTimeout, requestLocation, startWatching, stopWatching]);

  if (status === "granted" && location) return null;

  const message = getMessage(status);
  const isBusy = requesting || status === "checking";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
      <div
        aria-modal="true"
        role="dialog"
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            {status === "denied" ? <AlertTriangle className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Localização obrigatória</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={requestLocation}
            disabled={isBusy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
            {isBusy ? "Aguardando permissão" : "Permitir localização"}
          </button>

          {status === "denied" ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
