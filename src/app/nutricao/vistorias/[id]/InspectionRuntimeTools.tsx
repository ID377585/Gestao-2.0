"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Camera,
  Check,
  Clock,
  FileUp,
  LocateFixed,
  PenLine,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import {
  removeNutritionEvidence,
  saveInspectionGeolocation,
  saveNutritionSignature,
  uploadNutritionEvidence,
  type NutritionEvidenceItem,
  type NutritionSignatureItem,
} from "@/app/nutricao/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/app/nutricao/SubmitButton";

type TimerProps = {
  startedAt: string | null;
  expectedDurationMinutes: number | null;
  completedAt: string | null;
};

type GeolocationProps = {
  inspectionId: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  failureReason: string | null;
  disabled: boolean;
};

type EvidenceUploadProps = {
  inspectionId?: string;
  answerId?: string;
  nonconformityId?: string;
  resourceType: "inspection" | "inspection_answer" | "nonconformity";
  disabled?: boolean;
};

type EvidenceListProps = {
  evidences: NutritionEvidenceItem[];
  disabled?: boolean;
};

type SignaturePadProps = {
  inspectionId: string;
  disabled?: boolean;
  signatures: NutritionSignatureItem[];
};

function formatDuration(ms: number) {
  const abs = Math.abs(ms);
  const totalMinutes = Math.floor(abs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;
}

export function InspectionConnectivityStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [draftCount, setDraftCount] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setIsOnline(window.navigator.onLine);
      const count = Number(
        window.localStorage.getItem("nutrition:offline-draft-count") ?? "0"
      );
      setDraftCount(Number.isFinite(count) ? count : 0);
    };

    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    window.addEventListener("storage", refresh);

    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
      {isOnline ? (
        <Wifi className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
      ) : (
        <WifiOff className="h-4 w-4 text-amber-700 dark:text-amber-300" />
      )}
      <span className="font-medium">
        {isOnline ? "Online" : "Sem conexão"}
      </span>
      <span className="text-slate-500 dark:text-slate-400">
        {draftCount > 0
          ? `${draftCount} registro${draftCount === 1 ? "" : "s"} pendente${draftCount === 1 ? "" : "s"}`
          : "Sem pendências locais"}
      </span>
    </div>
  );
}

async function compressImage(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const ratio = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.82)
  );
  bitmap.close();
  if (!blob || blob.size >= file.size) return file;

  const nextName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], nextName, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function InspectionTimer({
  startedAt,
  expectedDurationMinutes,
  completedAt,
}: TimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt || completedAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, [completedAt, startedAt]);

  const state = useMemo(() => {
    if (!startedAt) return { label: "Aguardando início", tone: "slate" };
    const started = new Date(startedAt).getTime();
    const ended = completedAt ? new Date(completedAt).getTime() : now;
    const elapsed = ended - started;
    const expected = (expectedDurationMinutes ?? 0) * 60_000;
    if (!expected) {
      return { label: `Tempo decorrido: ${formatDuration(elapsed)}`, tone: "slate" };
    }
    const remaining = expected - elapsed;
    return remaining >= 0
      ? { label: `Faltam ${formatDuration(remaining)}`, tone: "green" }
      : { label: `Excedeu ${formatDuration(remaining)}`, tone: "red" };
  }, [completedAt, expectedDurationMinutes, now, startedAt]);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
      <Clock className="h-4 w-4" />
      <span className={state.tone === "red" ? "font-semibold text-red-700 dark:text-red-300" : ""}>
        {state.label}
      </span>
    </div>
  );
}

export function InspectionGeolocation({
  inspectionId,
  status,
  latitude,
  longitude,
  accuracyMeters,
  failureReason,
  disabled,
}: GeolocationProps) {
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function capture() {
    if (!navigator.geolocation) {
      const formData = new FormData();
      formData.set("inspection_id", inspectionId);
      formData.set("geolocation_status", "unavailable");
      formData.set("geolocation_failure_reason", "Navegador sem suporte a geolocalização.");
      startTransition(async () => {
        await saveInspectionGeolocation(formData);
        setMessage("Geolocalização indisponível registrada.");
      });
      return;
    }

    setMessage("Solicitando localização...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const formData = new FormData();
        formData.set("inspection_id", inspectionId);
        formData.set("latitude", String(position.coords.latitude));
        formData.set("longitude", String(position.coords.longitude));
        formData.set("accuracy", String(position.coords.accuracy));
        formData.set("geolocation_status", "captured");
        startTransition(async () => {
          await saveInspectionGeolocation(formData);
          setMessage("Localização registrada.");
        });
      },
      (error) => {
        const formData = new FormData();
        formData.set("inspection_id", inspectionId);
        formData.set(
          "geolocation_status",
          error.code === error.PERMISSION_DENIED ? "denied" : "failed"
        );
        formData.set("geolocation_failure_reason", error.message || "Falha ao capturar localização.");
        startTransition(async () => {
          await saveInspectionGeolocation(formData);
          setMessage("Falha/recusa registrada.");
        });
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 }
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold text-slate-950 dark:text-white">Geolocalização</p>
          <p className="text-slate-500 dark:text-slate-400">
            {status === "captured"
              ? `${latitude}, ${longitude} • precisão ${Math.round(accuracyMeters ?? 0)} m`
              : failureReason || "Ainda não registrada."}
          </p>
        </div>
        <Button type="button" size="sm" onClick={capture} disabled={disabled || isPending}>
          <LocateFixed className="mr-2 h-4 w-4" />
          {isPending ? "Registrando..." : "Registrar localização"}
        </Button>
      </div>
      {message ? <p className="text-xs text-slate-500 dark:text-slate-400">{message}</p> : null}
    </div>
  );
}

export function EvidenceUploadForm({
  inspectionId,
  answerId,
  nonconformityId,
  resourceType,
  disabled,
}: EvidenceUploadProps) {
  const [status, setStatus] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatus("Selecione um arquivo.");
      return;
    }

    startTransition(async () => {
      try {
        setStatus("Preparando arquivo...");
        const finalFile = await compressImage(file);
        const formData = new FormData(form);
        formData.set("file", finalFile);
        await uploadNutritionEvidence(formData);
        form.reset();
        setStatus("Evidência enviada.");
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Falha ao enviar.");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <input name="resource_type" type="hidden" value={resourceType} />
      <input name="inspection_id" type="hidden" value={inspectionId ?? ""} />
      <input name="answer_id" type="hidden" value={answerId ?? ""} />
      <input name="nonconformity_id" type="hidden" value={nonconformityId ?? ""} />
      <div className="grid gap-2 md:grid-cols-[1fr_0.7fr]">
        <Input
          ref={fileRef}
          name="file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.docx,.xlsx"
          disabled={disabled || isPending}
          required
        />
        <Input name="category" placeholder="Categoria" defaultValue="evidencia" disabled={disabled || isPending} />
      </div>
      <Input name="caption" placeholder="Legenda da evidência" disabled={disabled || isPending} />
      <Button type="submit" variant="outline" disabled={disabled || isPending}>
        <FileUp className="mr-2 h-4 w-4" />
        {isPending ? "Enviando..." : "Anexar evidência"}
      </Button>
      {status ? <p className="text-xs text-slate-500 dark:text-slate-400">{status}</p> : null}
    </form>
  );
}

export function EvidenceList({ evidences, disabled }: EvidenceListProps) {
  if (evidences.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma evidência anexada.</p>;
  }

  return (
    <div className="grid gap-2">
      {evidences.map((evidence) => (
        <div
          key={evidence.id}
          className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <a className="font-semibold text-blue-700 hover:underline dark:text-blue-300" href={evidence.url} target="_blank" rel="noreferrer">
              {evidence.fileName ?? "Arquivo"}
            </a>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {evidence.category ?? "evidência"}{evidence.caption ? ` • ${evidence.caption}` : ""}
            </p>
          </div>
          {!disabled ? (
            <form action={removeNutritionEvidence} className="flex gap-2">
              <input name="evidence_id" type="hidden" value={evidence.id} />
              <Input name="remove_reason" placeholder="Justificativa" className="h-8" required />
              <Button size="sm" variant="ghost" type="submit">
                <Trash2 className="h-4 w-4" />
              </Button>
            </form>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function SignaturePad({ inspectionId, disabled, signatures }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [signatureData, setSignatureData] = useState("");

  function getPosition(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function begin(event: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const position = getPosition(event);
    context.beginPath();
    context.moveTo(position.x, position.y);
    setDrawing(true);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing || disabled) return;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const position = getPosition(event);
    context.lineTo(position.x, position.y);
    context.strokeStyle = "#0f172a";
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.stroke();
    setSignatureData(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    setSignatureData("");
  }

  return (
    <div className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <PenLine className="h-4 w-4 text-emerald-700" />
        <h2 className="font-semibold">Assinaturas</h2>
      </div>
      {signatures.length > 0 ? (
        <div className="grid gap-2">
          {signatures.map((signature) => (
            <div key={signature.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
              <p className="font-semibold">{signature.signerName}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {signature.refusalReason
                  ? `Recusou: ${signature.refusalReason}`
                  : `Hash: ${signature.signatureHash ?? "-"}`}
              </p>
              {signature.signatureUrl ? (
                <a href={signature.signatureUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300">
                  Ver assinatura
                </a>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {!disabled ? (
        <form action={saveNutritionSignature} className="grid gap-3">
          <input name="inspection_id" type="hidden" value={inspectionId} />
          <input name="signature_data" type="hidden" value={signatureData} />
          <div className="grid gap-3 md:grid-cols-2">
            <Input name="signer_name" placeholder="Nome do responsável" required />
            <Input name="signer_role" placeholder="Função" />
          </div>
          <canvas
            ref={canvasRef}
            width={700}
            height={220}
            className="h-44 w-full touch-none rounded-lg border border-dashed border-slate-300 bg-white dark:border-slate-700"
            onPointerDown={begin}
            onPointerMove={draw}
            onPointerUp={() => setDrawing(false)}
            onPointerCancel={() => setDrawing(false)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={clear}>
              Limpar assinatura
            </Button>
            <SubmitButton pendingLabel="Registrando...">
              <Check className="mr-2 h-4 w-4" />
              Registrar assinatura
            </SubmitButton>
          </div>
          <div className="grid gap-2 border-t border-slate-200 pt-3 dark:border-slate-800">
            <Textarea name="refusal_reason" placeholder="Em caso de recusa, informe a justificativa." />
            <Input name="witness_name" placeholder="Testemunha, se houver" />
          </div>
        </form>
      ) : null}
    </div>
  );
}
