"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Coffee,
  Clock3,
  Fingerprint,
  History,
  LogIn,
  LogOut,
  Menu,
  RefreshCw,
  ScanFace,
  Search,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  recordTimeClockEvent,
  saveEmployeeFaceProfile,
  type EmployeeFacePhotoInput,
  type FaceDetectionStatus,
  type TimeClockEmployee,
  type TimeClockEvent,
  type TimeClockEventType,
  type TimeClockRecentRecord,
  type TimeClockSelfieInput,
  type TimeClockSnapshot,
} from "./actions";

type TimeClockClientProps = {
  initialSnapshot: TimeClockSnapshot;
  userName: string;
};

const EVENT_LABELS: Record<TimeClockEventType, string> = {
  entrada: "Entrada",
  saida_refeicao: "Saída refeição",
  retorno_refeicao: "Retorno refeição",
  saida: "Saída",
};

const EVENT_ICONS: Record<TimeClockEventType, typeof LogIn> = {
  entrada: LogIn,
  saida_refeicao: Coffee,
  retorno_refeicao: Coffee,
  saida: LogOut,
};

type CapturedSelfie = TimeClockSelfieInput & {
  previewUrl: string;
};

const SIGNATURE_SIZE = 16;
const FACE_MATCH_THRESHOLD = 0.62;
const FACE_MATCH_MARGIN = 0.025;

function formatTime(value?: string | null) {
  if (!value) return "--:--";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatClockTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .format(value)
    .replace(/\.$/, "");
}

function getInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return (parts[0]?.[0] ?? "G") + (parts[1]?.[0] ?? "");
}

function formatDateKey(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function formatDuration(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatSignedDuration(totalMinutes: number) {
  const sign = totalMinutes >= 0 ? "+" : "-";
  return `${sign}${formatDuration(Math.abs(totalMinutes))}`;
}

function getEvent(events: TimeClockEvent[], eventType: TimeClockEventType) {
  return events.find((event) => event.eventType === eventType) ?? null;
}

function diffMinutes(start?: string | null, end?: Date | string | null) {
  if (!start || !end) return 0;

  const startMs = new Date(start).getTime();
  const endMs = end instanceof Date ? end.getTime() : new Date(end).getTime();
  const diff = (endMs - startMs) / 60000;

  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}

function calculateWorkedMinutes(events: TimeClockEvent[], now: Date) {
  const entrada = getEvent(events, "entrada");
  const saidaRefeicao = getEvent(events, "saida_refeicao");
  const retornoRefeicao = getEvent(events, "retorno_refeicao");
  const saida = getEvent(events, "saida");

  if (!entrada) return 0;

  const firstEnd = saidaRefeicao?.occurredAt ?? saida?.occurredAt ?? now;
  const firstBlock = diffMinutes(entrada.occurredAt, firstEnd);

  if (!retornoRefeicao) return firstBlock;

  const secondEnd = saida?.occurredAt ?? now;
  return firstBlock + diffMinutes(retornoRefeicao.occurredAt, secondEnd);
}

function getStatusLabel(snapshot: TimeClockSnapshot) {
  switch (snapshot.status) {
    case "working":
      return "Trabalhando";
    case "on_break":
      return "Em refeição";
    case "finished":
      return "Jornada encerrada";
    default:
      return "Aguardando entrada";
  }
}

function getNextActionLabel(eventType: TimeClockEventType | null) {
  if (!eventType) return "Jornada encerrada";
  return `Registrar ${EVENT_LABELS[eventType].toLowerCase()}`;
}

function isInterruptedMediaError(error: any) {
  const name = String(error?.name ?? "");
  const message = String(error?.message ?? error ?? "").toLowerCase();

  return (
    name === "AbortError" ||
    message.includes("interrupted by a new load request") ||
    message.includes("interrupted by a call to pause")
  );
}

function getSelfieStatusLabel(status?: FaceDetectionStatus | null) {
  switch (status) {
    case "verified":
      return "Rosto verificado";
    case "not_detected":
      return "Rosto não detectado";
    case "multiple_faces":
      return "Mais de um rosto";
    case "unsupported":
      return "Selfie anexada";
    default:
      return "Selfie pendente";
  }
}

function getRecordHourKey(record: TimeClockRecentRecord) {
  const date = new Date(record.occurredAt);
  const minutes = date.getMinutes();
  const roundedMinutes = minutes < 30 ? "00" : "30";

  return `${String(date.getHours()).padStart(2, "0")}:${roundedMinutes}`;
}

async function detectFaceFromBlob(blob: Blob): Promise<{
  status: FaceDetectionStatus;
  method: "browser-face-detector" | "unsupported";
  faceCount: number | null;
}> {
  const FaceDetectorCtor = (window as any).FaceDetector;

  if (!FaceDetectorCtor) {
    return {
      status: "unsupported",
      method: "unsupported",
      faceCount: null,
    };
  }

  try {
    const detector = new FaceDetectorCtor({
      fastMode: true,
      maxDetectedFaces: 2,
    });
    const imageBitmap = await createImageBitmap(blob);

    try {
      const faces = await detector.detect(imageBitmap);
      const faceCount = Array.isArray(faces) ? faces.length : 0;

      return {
        status:
          faceCount === 1
            ? "verified"
            : faceCount === 0
              ? "not_detected"
              : "multiple_faces",
        method: "browser-face-detector",
        faceCount,
      };
    } finally {
      imageBitmap.close();
    }
  } catch {
    return {
      status: "unsupported",
      method: "unsupported",
      faceCount: null,
    };
  }
}

function computeCanvasSignature(sourceCanvas: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = SIGNATURE_SIZE;
  canvas.height = SIGNATURE_SIZE;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(sourceCanvas, 0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);

  const { data } = context.getImageData(0, 0, SIGNATURE_SIZE, SIGNATURE_SIZE);
  const values: number[] = [];

  for (let index = 0; index < data.length; index += 4) {
    const luminance =
      (0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]) /
      255;
    values.push(Number(luminance.toFixed(4)));
  }

  return values;
}

function compareSignatures(source: number[] | null, candidate: number[] | null) {
  if (!source || !candidate || source.length !== candidate.length) return 0;

  let diff = 0;
  for (let index = 0; index < source.length; index += 1) {
    diff += Math.abs(source[index] - candidate[index]);
  }

  return Math.max(0, 1 - diff / source.length);
}

function findEmployeeFaceMatch(
  signature: number[] | null,
  employees: TimeClockEmployee[]
) {
  if (!signature) return null;

  const ranked = employees
    .filter((employee) => employee.faceSignature?.length === signature.length)
    .map((employee) => ({
      employee,
      score: compareSignatures(signature, employee.faceSignature),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < FACE_MATCH_THRESHOLD) return null;

  const secondScore = ranked[1]?.score ?? 0;
  if (best.score - secondScore < FACE_MATCH_MARGIN) return null;

  return best;
}

function waitForVideoReady(video: HTMLVideoElement) {
  if (video.readyState >= 2 && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("A câmera demorou para responder."));
    }, 5000);

    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener("loadedmetadata", handleReady);
      video.removeEventListener("canplay", handleReady);
      video.removeEventListener("error", handleError);
    };
    const handleReady = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Não foi possível preparar a câmera."));
    };

    video.addEventListener("loadedmetadata", handleReady);
    video.addEventListener("canplay", handleReady);
    video.addEventListener("error", handleError);
  });
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function TimeClockClient({
  initialSnapshot,
  userName,
}: TimeClockClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [now, setNow] = useState(() => new Date(initialSnapshot.serverNow));
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<CapturedSelfie | null>(null);
  const [capturingSelfie, setCapturingSelfie] = useState(false);
  const [identifiedEmployee, setIdentifiedEmployee] =
    useState<TimeClockEmployee | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [uploadingEmployeeId, setUploadingEmployeeId] = useState<string | null>(
    null
  );
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const serverStart = new Date(snapshot.serverNow).getTime();
    const browserStart = Date.now();

    const timer = window.setInterval(() => {
      setNow(new Date(serverStart + (Date.now() - browserStart)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [snapshot.serverNow]);

  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isInterruptedMediaError(event.reason)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selfie?.previewUrl) {
        URL.revokeObjectURL(selfie.previewUrl);
      }
    };
  }, [selfie?.previewUrl]);

  const metrics = useMemo(() => {
    const worked = calculateWorkedMinutes(snapshot.events, now);
    const remaining = snapshot.settings.defaultDailyMinutes - worked;
    const saidaRefeicao = getEvent(snapshot.events, "saida_refeicao");
    const retornoRefeicao = getEvent(snapshot.events, "retorno_refeicao");
    const breakElapsed =
      saidaRefeicao && !retornoRefeicao
        ? diffMinutes(saidaRefeicao.occurredAt, now)
        : retornoRefeicao && saidaRefeicao
          ? diffMinutes(saidaRefeicao.occurredAt, retornoRefeicao.occurredAt)
          : 0;
    const breakRemaining =
      snapshot.status === "on_break"
        ? Math.max(0, snapshot.settings.defaultBreakMinutes - breakElapsed)
        : snapshot.status === "not_started" || !saidaRefeicao
          ? snapshot.settings.defaultBreakMinutes
          : 0;

    return {
      worked,
      remaining,
      balance:
        snapshot.status === "finished"
          ? worked - snapshot.settings.defaultDailyMinutes
          : Math.max(0, worked - snapshot.settings.defaultDailyMinutes),
      breakRemaining,
      breakElapsed,
    };
  }, [now, snapshot]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 960 },
          height: { ideal: 1280 },
        },
      });

      stopStream(streamRef.current);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((error) => {
          if (isInterruptedMediaError(error)) {
            return;
          }

          throw error;
        });
        await waitForVideoReady(videoRef.current);
      }

      return stream;
    } catch (err: any) {
      if (isInterruptedMediaError(err)) {
        return null;
      }

      console.error("[time-clock] camera error:", err);
      setCameraError("Não foi possível acessar a câmera.");
      return null;
    }
  };

  const captureSelfieFromVideo = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      throw new Error("Câmera indisponível.");
    }

    const targetWidth = 720;
    const targetHeight = 960;
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Câmera indisponível.");
    }

    const videoWidth = video.videoWidth || targetWidth;
    const videoHeight = video.videoHeight || targetHeight;
    const scale = Math.max(targetWidth / videoWidth, targetHeight / videoHeight);
    const sourceWidth = targetWidth / scale;
    const sourceHeight = targetHeight / scale;
    const sourceX = (videoWidth - sourceWidth) / 2;
    const sourceY = (videoHeight - sourceHeight) / 2;

    context.drawImage(
      video,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      targetWidth,
      targetHeight
    );

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) resolve(value);
          else reject(new Error("Não foi possível capturar a selfie."));
        },
        "image/jpeg",
        0.86
      );
    });

    const detection = await detectFaceFromBlob(blob);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.86);
    const previewUrl = URL.createObjectURL(blob);
    const faceSignature = computeCanvasSignature(canvas);

    return {
      dataUrl,
      mimeType: "image/jpeg",
      faceDetectionStatus: detection.status,
      faceDetectionMethod: detection.method,
      faceCount: detection.faceCount,
      faceSignature,
      capturedAt: new Date().toISOString(),
      previewUrl,
    } satisfies CapturedSelfie;
  };

  const captureFileFacePhoto = async (file: File) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      throw new Error("Captura indisponível.");
    }

    const bitmap = await createImageBitmap(file);

    try {
      const targetWidth = 720;
      const targetHeight = 960;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Captura indisponível.");
      }

      const scale = Math.max(
        targetWidth / bitmap.width,
        targetHeight / bitmap.height
      );
      const sourceWidth = targetWidth / scale;
      const sourceHeight = targetHeight / scale;
      const sourceX = (bitmap.width - sourceWidth) / 2;
      const sourceY = (bitmap.height - sourceHeight) / 2;

      context.drawImage(
        bitmap,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        targetWidth,
        targetHeight
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => {
            if (value) resolve(value);
            else reject(new Error("Não foi possível processar a foto."));
          },
          "image/jpeg",
          0.88
        );
      });
      const detection = await detectFaceFromBlob(blob);
      const faceSignature = computeCanvasSignature(canvas);

      if (!faceSignature) {
        throw new Error("Não foi possível gerar a assinatura facial.");
      }

      return {
        dataUrl: canvas.toDataURL("image/jpeg", 0.88),
        mimeType: "image/jpeg",
        faceDetectionStatus: detection.status,
        faceDetectionMethod: detection.method,
        faceCount: detection.faceCount,
        faceSignature,
        capturedAt: new Date().toISOString(),
      } satisfies Omit<EmployeeFacePhotoInput, "employeeUserId">;
    } finally {
      bitmap.close();
    }
  };

  const handleEmployeePhotoUpload = (
    employee: TimeClockEmployee,
    file: File | null
  ) => {
    if (!file) return;

    setError(null);
    setUploadingEmployeeId(employee.userId);
    startTransition(async () => {
      try {
        const photo = await captureFileFacePhoto(file);
        const nextSnapshot = await saveEmployeeFaceProfile({
          ...photo,
          employeeUserId: employee.userId,
        });
        setSnapshot(nextSnapshot);
        setNow(new Date(nextSnapshot.serverNow));
      } catch (err: any) {
        setError(err?.message ?? "Não foi possível salvar a biometria.");
      } finally {
        setUploadingEmployeeId(null);
      }
    });
  };

  const captureSelfieAndRegister = () => {
    setError(null);
    setCameraError(null);
    setIdentifiedEmployee(null);
    setMatchScore(null);
    setCapturingSelfie(true);

    startTransition(async () => {
      let captured: CapturedSelfie | null = null;

      try {
        const stream = await startCamera();
        if (!stream) return;

        await new Promise((resolve) => window.setTimeout(resolve, 450));
        captured = await captureSelfieFromVideo();
        stopStream(stream);
        streamRef.current = null;

        setSelfie((current) => {
          if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
          return captured;
        });

        if (
          snapshot.settings.requireFaceDetection &&
          captured.faceDetectionStatus !== "verified" &&
          captured.faceDetectionStatus !== "unsupported"
        ) {
          throw new Error("Centralize apenas um rosto para registrar o ponto.");
        }

        const match = findEmployeeFaceMatch(
          captured.faceSignature ?? null,
          snapshot.employees
        );

        if (!match) {
          throw new Error(
            "Não foi possível identificar o colaborador. Cadastre ou atualize a foto de biometria."
          );
        }

        setIdentifiedEmployee(match.employee);
        setMatchScore(match.score);

        const nextSnapshot = await recordTimeClockEvent(
          {
            dataUrl: captured.dataUrl,
            mimeType: captured.mimeType,
            faceDetectionStatus: captured.faceDetectionStatus,
            faceDetectionMethod: captured.faceDetectionMethod,
            faceCount: captured.faceCount,
            faceSignature: captured.faceSignature,
            matchedUserId: match.employee.userId,
            matchScore: match.score,
            capturedAt: captured.capturedAt,
          },
          match.employee.userId
        );
        setSnapshot(nextSnapshot);
        setNow(new Date(nextSnapshot.serverNow));
      } catch (err: any) {
        console.error("[time-clock] selfie capture/register error:", err);
        setError(err?.message ?? "Não foi possível registrar o ponto.");
      } finally {
        setCapturingSelfie(false);
        stopStream(streamRef.current);
        streamRef.current = null;
      }
    });
  };

  const handleTerminalTap = () => {
    if (isPending || capturingSelfie) return;

    if (registeredFacesCount === 0) {
      setError(
        "Cadastre ao menos uma foto de biometria para liberar o registro por reconhecimento facial."
      );
      return;
    }

    captureSelfieAndRegister();
  };

  const recentRecords = snapshot.recentRecords ?? [];
  const registeredFacesCount = snapshot.employees.filter(
    (employee) => employee.faceRegistered
  ).length;
  const timelineHours = useMemo(() => {
    const baseHours = [
      "06:00",
      "06:30",
      "07:00",
      "07:30",
      "08:00",
      "08:30",
      "09:00",
      "09:30",
      "10:00",
      "10:30",
      "11:00",
      "11:30",
      "12:00",
      "12:30",
    ];
    const recordHours = recentRecords.map(getRecordHourKey);

    return Array.from(new Set([...baseHours, ...recordHours])).sort();
  }, [recentRecords]);
  const filteredRecords = selectedHour
    ? recentRecords.filter(
        (record) => getRecordHourKey(record) === selectedHour
      )
    : recentRecords;
  const latestRecords = filteredRecords.slice(0, 3);
  const syncedTodayCount = snapshot.syncedTodayCount;
  const primaryEmployeeName = identifiedEmployee?.name ?? "Terminal Gestify";
  const terminalSubtitle = identifiedEmployee
    ? `${identifiedEmployee.name} · ${getNextActionLabel(snapshot.nextEventType)}`
    : registeredFacesCount === 0
      ? "Cadastre uma foto na lista de colaboradores abaixo"
      : "Ao identificar o rosto, o sistema registra a próxima batida do colaborador";
  const terminalInstruction =
    registeredFacesCount === 0
      ? "Cadastre uma biometria para liberar o ponto"
      : capturingSelfie
        ? "Centralize o rosto para registrar o ponto"
        : "Escolha um gesto para desbloquear a tela";

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <section className="overflow-hidden rounded-md border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-800">
        <header className="flex items-center justify-between gap-4 bg-white px-4 py-4 text-slate-950 dark:bg-slate-950 dark:text-white sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              aria-label="Menu do ponto"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-transparent text-slate-700 transition hover:border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:hover:border-slate-800 dark:hover:bg-slate-900"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-50 text-cyan-600 dark:bg-cyan-950/60 dark:text-cyan-300">
                <Fingerprint className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-2xl font-semibold tracking-normal sm:text-3xl">
                  Gestify <span className="text-cyan-500">Ponto</span>
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {formatShortDate(now)} · {formatDateKey(snapshot.workDate)}
                </p>
              </div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <p className="text-xs font-semibold uppercase tracking-normal text-slate-500 dark:text-slate-400">
              Horário
            </p>
            <p className="font-mono text-lg font-semibold text-cyan-500 sm:text-xl">
              {formatClockTime(now)}
            </p>
          </div>
        </header>

      {error ? (
        <div className="m-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200 sm:m-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

        <div className="relative min-h-[660px] overflow-hidden bg-[radial-gradient(circle_at_18%_18%,rgba(148,163,184,0.22),transparent_28%),linear-gradient(135deg,#111827_0%,#071013_54%,#020617_100%)] px-4 pb-5 pt-10 text-white sm:px-7 lg:min-h-[720px]">
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:52px_52px] opacity-20" />

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
            <Badge className="mb-5 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/10">
              {getStatusLabel(snapshot)}
            </Badge>
            <h1 className="max-w-xl text-balance text-2xl font-semibold leading-tight text-white sm:text-3xl">
              {terminalInstruction}
            </h1>
            <p className="mt-2 max-w-lg text-sm text-slate-300">
              {terminalSubtitle}
              {matchScore ? ` · biometria ${Math.round(matchScore * 100)}%` : ""}
            </p>

            <button
              type="button"
              className="group relative mt-14 flex w-full max-w-[360px] flex-col items-center justify-center overflow-hidden rounded-[28px] border-[8px] border-white bg-black/55 p-5 text-white shadow-[0_22px_65px_rgba(0,0,0,0.50)] transition hover:scale-[1.01] focus:outline-none focus:ring-4 focus:ring-cyan-300/50 disabled:cursor-not-allowed disabled:opacity-60 sm:max-w-[420px] sm:p-7"
              disabled={isPending || capturingSelfie}
              onClick={handleTerminalTap}
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-white/70 bg-slate-950">
                <video
                  ref={videoRef}
                  className={
                    capturingSelfie && !selfie
                      ? "absolute inset-0 h-full w-full object-cover opacity-100"
                      : "absolute inset-0 h-full w-full object-cover opacity-0"
                  }
                  muted
                  playsInline
                />
                {selfie ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selfie.previewUrl}
                    alt="Selfie do ponto"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="relative flex h-[74%] w-[58%] items-center justify-center rounded-md border border-white/80">
                    <span className="absolute left-5 top-5 h-7 w-7 border-l-4 border-t-4 border-white" />
                    <span className="absolute right-5 top-5 h-7 w-7 border-r-4 border-t-4 border-white" />
                    <span className="absolute bottom-5 left-5 h-7 w-7 border-b-4 border-l-4 border-white" />
                    <span className="absolute bottom-5 right-5 h-7 w-7 border-b-4 border-r-4 border-white" />
                    {isPending || capturingSelfie ? (
                      <RefreshCw className="h-16 w-16 animate-spin text-white" />
                    ) : (
                      <ScanFace className="h-20 w-20 text-white/85" />
                    )}
                  </div>
                </div>
              </div>
              <span className="mt-6 flex items-center gap-3 text-2xl font-black uppercase tracking-normal sm:text-3xl">
                <Camera className="h-8 w-8" />
                Toque na tela
              </span>
              <span className="mt-2 text-xs font-medium uppercase tracking-normal text-cyan-200">
                {primaryEmployeeName}
              </span>
            </button>
            <canvas ref={canvasRef} className="hidden" />

            {cameraError ? (
              <div className="mt-5 flex max-w-xl items-start gap-2 rounded-md border border-amber-300/40 bg-amber-400/10 px-3 py-2 text-left text-sm text-amber-100">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            ) : null}
          </div>

          <div className="relative z-10 mt-8 grid gap-3 rounded-md border border-white/10 bg-slate-950/70 p-3 backdrop-blur md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold uppercase text-white">
                <History className="h-4 w-4 text-cyan-300" />
                Últimos registros
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {latestRecords.length === 0 ? (
                  <div className="rounded-md border border-white/10 bg-white/5 px-3 py-3 text-sm text-slate-300 sm:col-span-3">
                    {selectedHour
                      ? `Nenhuma marcação em ${selectedHour}`
                      : "Nenhuma marcação registrada hoje"}
                  </div>
                ) : null}
                {latestRecords.map((record) => {
                  const Icon = EVENT_ICONS[record.eventType];

                  return (
                    <div
                      key={record.id}
                      className="flex min-w-0 items-center gap-3 rounded-md border border-white/10 bg-white/5 px-3 py-2"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-900">
                        {getInitials(record.employeeName)}
                      </div>
                      <div className="min-w-0 text-left">
                        <p className="truncate text-xs font-bold uppercase text-white">
                          {record.employeeName}
                        </p>
                        <p className="truncate text-[11px] uppercase text-slate-300">
                          {EVENT_LABELS[record.eventType]}
                          {record.employeeSector || record.employeeRole
                            ? ` · ${record.employeeSector ?? record.employeeRole}`
                            : ""}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {formatDateKey(record.workDate)} · {formatTime(record.occurredAt)}
                        </p>
                      </div>
                      <Icon className="ml-auto h-4 w-4 shrink-0 text-cyan-300" />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="min-w-0">
              <div className="mb-2 flex items-center justify-center gap-2 text-xs font-bold uppercase text-white">
                <Search className="h-4 w-4 text-cyan-300" />
                Busca de registros por horário
              </div>
              <div className="flex min-h-[72px] items-center overflow-x-auto rounded-md border border-white/10 bg-black/25 px-3">
                <div className="flex min-w-max items-center gap-3">
                  <button
                    type="button"
                    className={
                      selectedHour === null
                        ? "rounded-md bg-white px-2 py-1 text-sm font-bold text-slate-950"
                        : "rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:text-white"
                    }
                    onClick={() => setSelectedHour(null)}
                  >
                    Todos
                  </button>
                  {timelineHours.map((hour) => (
                    <button
                      type="button"
                      key={hour}
                      className={
                        selectedHour === hour
                          ? "rounded-md bg-white px-2 py-1 text-sm font-bold text-slate-950"
                          : recentRecords.some(
                                (record) => getRecordHourKey(record) === hour
                              )
                            ? "rounded-md px-2 py-1 text-sm font-bold text-white transition hover:bg-white/10"
                            : "rounded-md px-2 py-1 text-xs font-medium text-slate-500 transition hover:text-white"
                      }
                      onClick={() => setSelectedHour(hour)}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-4 grid gap-3 sm:grid-cols-2">
            <div className="grid grid-cols-[minmax(0,1fr)_82px] overflow-hidden rounded-md bg-cyan-300 text-slate-900">
              <div className="px-4 py-3 text-center text-sm font-semibold">
                Sincronizadas hoje
              </div>
              <div className="border-l border-cyan-500/50 px-4 py-3 text-center text-2xl font-black">
                {syncedTodayCount}
              </div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_82px] overflow-hidden rounded-md bg-cyan-300 text-slate-900">
              <div className="px-4 py-3 text-center text-sm font-semibold">
                Pendente
              </div>
              <div className="border-l border-cyan-500/50 px-4 py-3 text-center text-2xl font-black">
                {snapshot.pendingSyncCount}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Clock3 className="h-4 w-4" />
            Tempo trabalhado
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {formatDuration(metrics.worked)}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <Coffee className="h-4 w-4" />
            Intervalo restante
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {formatDuration(metrics.breakRemaining)}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <LogOut className="h-4 w-4" />
            {metrics.remaining > 0 ? "Faltam" : "Excedente"}
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {formatDuration(Math.abs(metrics.remaining))}
          </p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Saldo do dia
          </p>
          <p
            className={
              metrics.balance >= 0
                ? "mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300"
                : "mt-2 text-2xl font-semibold text-red-700 dark:text-red-300"
            }
          >
            {formatSignedDuration(metrics.balance)}
          </p>
        </div>
      </section>

      <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
              <Users className="h-4 w-4 text-slate-500" />
              Colaboradores e biometria
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {registeredFacesCount} de {snapshot.employees.length} colaborador(es)
              com biometria cadastrada
            </p>
          </div>
          <Badge variant="secondary" className="w-fit rounded-md">
            <ShieldCheck className="mr-1 h-3 w-3" />
            {userName}
          </Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.employees.length === 0 ? (
            <div className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-slate-700 dark:text-slate-400">
              Nenhum colaborador ativo
            </div>
          ) : null}
          {snapshot.employees.map((employee) => (
            <div
              key={employee.userId}
              className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 dark:border-slate-700"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-slate-100">
                  {employee.name}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-slate-400">
                  {employee.sector ?? employee.role}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <Badge
                  variant={employee.faceRegistered ? "secondary" : "outline"}
                  className="rounded-md"
                >
                  {employee.faceRegistered ? (
                    <UserCheck className="mr-1 h-3 w-3" />
                  ) : null}
                  {employee.faceRegistered ? "Bio" : "Sem bio"}
                </Badge>

                {snapshot.canManageBiometrics ? (
                  <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-gray-200 text-gray-700 transition hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                    {uploadingEmployeeId === employee.userId ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={Boolean(uploadingEmployeeId) || isPending}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        event.currentTarget.value = "";
                        handleEmployeePhotoUpload(employee, file);
                      }}
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
