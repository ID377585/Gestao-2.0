"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, LocateFixed, MapPin, RefreshCw, ShieldCheck } from "lucide-react";

import {
  GESTIFY_USER_LOCATION_EVENT,
  GESTIFY_USER_LOCATION_STORAGE_KEY,
  type GestifyUserLocation,
} from "@/lib/user-location";

type LocationStatus = "checking" | "prompting" | "granted" | "denied" | "unavailable" | "error";

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
    case "error":
      return "A localização demorou para responder. Tente novamente para continuar.";
    case "prompting":
      return "Confirme a permissão de localização na janela do navegador para continuar.";
    default:
      return "Precisamos da sua localização atual para liberar o acesso ao Gestify.";
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

export function LocationPermissionGate() {
  const [status, setStatus] = useState<LocationStatus>("checking");
  const [location, setLocation] = useState<GestifyUserLocation | null>(null);
  const [requesting, setRequesting] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation || watchIdRef.current !== null) {
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocation(publishLocation(position));
        setStatus("granted");
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocation(null);
          setStatus("denied");
          stopWatching();
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 20_000,
      },
    );
  }, [stopWatching]);

  const requestLocation = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return;
    }

    setRequesting(true);
    setStatus("prompting");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(publishLocation(position));
        setStatus("granted");
        setRequesting(false);
        startWatching();
      },
      (error) => {
        setStatus(getErrorStatus(error));
        setRequesting(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 12_000,
      },
    );
  }, [startWatching]);

  useEffect(() => {
    requestLocation();

    let permissionStatus: PermissionStatus | null = null;

    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      void navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((result) => {
          permissionStatus = result;
          result.onchange = () => {
            if (result.state === "denied") {
              setLocation(null);
              setStatus("denied");
              stopWatching();
              return;
            }

            requestLocation();
          };
        })
        .catch(() => {
          permissionStatus = null;
        });
    }

    return () => {
      stopWatching();
      if (permissionStatus) permissionStatus.onchange = null;
    };
  }, [requestLocation, stopWatching]);

  if (status === "granted" && location) return null;

  const message = getMessage(status);
  const isBusy = requesting || status === "checking" || status === "prompting";

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

        <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
            <span>A previsão no topo usa somente a localização atual autorizada neste dispositivo.</span>
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
