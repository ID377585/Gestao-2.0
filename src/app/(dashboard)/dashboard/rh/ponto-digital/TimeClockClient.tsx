"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Coffee,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserCheck,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  recordTimeClockEvent,
  saveEmployeeFaceProfile,
  type EmployeeFacePhotoInput,
  type FaceDetectionStatus,
  type TimeClockEmployee,
  type TimeClockEvent,
  type TimeClockEventType,
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

  const registeredFacesCount = snapshot.employees.filter(
    (employee) => employee.faceRegistered
  ).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            {formatDateKey(snapshot.workDate)}
          </p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-slate-100">
            Ponto Digital
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
            Acesso de {userName}
          </p>
        </div>

        <Badge
          variant="secondary"
          className="w-fit rounded-md px-3 py-1.5 text-sm"
        >
          {getStatusLabel(snapshot)}
        </Badge>
      </div>

      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Card className="rounded-md">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-gray-500 dark:text-slate-400">
              Colaborador identificado
            </p>
            <p className="truncate text-lg font-semibold text-gray-900 dark:text-slate-100">
              {identifiedEmployee?.name ?? snapshot.subjectName}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
              {getNextActionLabel(snapshot.nextEventType)}
              {matchScore ? ` · ${Math.round(matchScore * 100)}%` : ""}
            </p>
          </div>
          <Button
            type="button"
            className="h-11 w-full gap-2 sm:w-auto"
            disabled={
              !snapshot.nextEventType ||
              isPending ||
              capturingSelfie ||
              registeredFacesCount === 0
            }
            onClick={captureSelfieAndRegister}
          >
            {isPending || capturingSelfie ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            Capturar selfie e registrar
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium">Selfie do ponto</CardTitle>
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative overflow-hidden rounded-md border border-gray-200 bg-gray-100 dark:border-slate-700 dark:bg-slate-900">
            {selfie ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selfie.previewUrl}
                alt="Selfie do ponto"
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <video
                ref={videoRef}
                className="aspect-[4/3] w-full object-cover"
                muted
                playsInline
              />
            )}
            {!selfie ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-[68%] w-[46%] rounded-[50%] border-2 border-white/90 shadow-[0_0_0_999px_rgba(15,23,42,0.30)]" />
              </div>
            ) : null}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          <div className="flex flex-col gap-3">
            <div className="rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-slate-700">
              <p className="font-medium text-gray-900 dark:text-slate-100">
                {getSelfieStatusLabel(selfie?.faceDetectionStatus)}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {selfie?.faceCount !== null && selfie?.faceCount !== undefined
                  ? `${selfie.faceCount} rosto(s)`
                  : `${registeredFacesCount} biometria(s) cadastrada(s)`}
              </p>
            </div>

            <div className="rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-slate-700">
              <p className="font-medium text-gray-900 dark:text-slate-100">
                {identifiedEmployee?.name ?? "Aguardando identificação"}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                {identifiedEmployee?.sector ?? "Reconhecimento facial interno"}
              </p>
            </div>

            {cameraError ? (
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            ) : null}

            <Button
              type="button"
              className="gap-2"
              disabled={
                !snapshot.nextEventType ||
                isPending ||
                capturingSelfie ||
                registeredFacesCount === 0
              }
              onClick={captureSelfieAndRegister}
            >
              {isPending || capturingSelfie ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              Capturar selfie
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-md">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium">Colaboradores</CardTitle>
          <Users className="h-4 w-4 text-gray-500 dark:text-slate-400" />
        </CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
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
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(["entrada", "saida_refeicao", "retorno_refeicao", "saida"] as const).map(
          (eventType) => {
            const event = getEvent(snapshot.events, eventType);
            const Icon = EVENT_ICONS[eventType];

            return (
              <Card key={eventType} className="rounded-md">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {EVENT_LABELS[eventType]}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-gray-500 dark:text-slate-400" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    {formatTime(event?.occurredAt)}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                    {event ? "Registrado pelo sistema" : "Pendente"}
                  </p>
                </CardContent>
              </Card>
            );
          }
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tempo trabalhado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatDuration(metrics.worked)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Intervalo restante</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatDuration(metrics.breakRemaining)}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {metrics.remaining > 0 ? "Faltam" : "Excedente"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {formatDuration(Math.abs(metrics.remaining))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo do dia</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div
              className={
                metrics.balance >= 0
                  ? "text-2xl font-semibold text-emerald-700 dark:text-emerald-300"
                  : "text-2xl font-semibold text-red-700 dark:text-red-300"
              }
            >
              {formatSignedDuration(metrics.balance)}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
