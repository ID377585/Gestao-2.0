"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { clearCurrentUserInfoCache } from "@/lib/auth/current-user";
import { supabase } from "@/lib/supabase";

const MAX_ORIGINAL_AVATAR_BYTES = 25 * 1024 * 1024;
const MAX_UPLOAD_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_MAX_DIMENSION = 1200;
const AVATAR_ACCEPT = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
  ".heif",
].join(",");

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onAvatarUpdated?: (avatarUrl: string | null) => void;
  user: {
    id?: string;
    name: string;
    email: string;
    avatar?: string | null;
    role?: string | null;
    sector?: string | null;
    establishmentId?: string | null;
    establishmentName?: string | null;
    lastSignInAt?: string | null;
  };
}

type AvatarMutationResponse = {
  avatar?: string | null;
  error?: string;
};

function getRoleLabel(role?: string | null) {
  switch (String(role ?? "").trim()) {
    case "admin":
      return "Administrador";
    case "operacao":
      return "Operação";
    case "producao":
      return "Produção";
    case "estoque":
      return "Estoque";
    case "fiscal":
      return "Fiscal";
    case "entrega":
      return "Entrega";
    case "cliente":
      return "Cliente";
    default:
      return "Usuário";
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getInitials(name?: string | null) {
  const safeName = String(name ?? "").trim();
  if (!safeName) return "U";

  return safeName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");
}

function getFileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function isHeicFile(file: File) {
  const extension = getFileExtension(file);
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    extension === "heic" ||
    extension === "heif"
  );
}

function isSupportedAvatarFile(file: File) {
  const extension = getFileExtension(file);
  const supportedExtensions = ["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"];
  return file.type.startsWith("image/") || supportedExtensions.includes(extension);
}

async function convertHeicToJpeg(file: File) {
  const heic2any = (await import("heic2any")).default as unknown as (options: {
    blob: Blob;
    toType: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;

  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });

  const blob = Array.isArray(converted) ? converted[0] : converted;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
    type: "image/jpeg",
  });
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Não foi possível ler a imagem."));
    };

    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Não foi possível processar a imagem."));
          return;
        }

        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

async function compressAvatarFile(file: File) {
  const image = await loadImage(file);
  const scale = Math.min(
    1,
    AVATAR_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Não foi possível processar a imagem.");

  context.drawImage(image, 0, 0, width, height);

  const qualities = [0.88, 0.82, 0.76, 0.7, 0.64, 0.58];
  let lastBlob: Blob | null = null;

  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, quality);
    lastBlob = blob;

    if (blob.size <= MAX_UPLOAD_AVATAR_BYTES) {
      return new File([blob], "avatar.jpg", { type: "image/jpeg" });
    }
  }

  if (!lastBlob) throw new Error("Não foi possível processar a imagem.");
  return new File([lastBlob], "avatar.jpg", { type: "image/jpeg" });
}

async function prepareAvatarFile(file: File) {
  const readableFile = isHeicFile(file) ? await convertHeicToJpeg(file) : file;
  return compressAvatarFile(readableFile);
}

async function readAvatarResponse(response: Response) {
  const payload = (await response.json().catch(() => ({}))) as AvatarMutationResponse;

  if (!response.ok) {
    throw new Error(payload.error ?? "Não foi possível atualizar a foto.");
  }

  return payload;
}

export function ProfileModal({
  open,
  onClose,
  onAvatarUpdated,
  user,
}: ProfileModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user.avatar ?? null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setAvatarUrl(user.avatar ?? null);
  }, [open, user.avatar]);

  if (!open) return null;

  const publishAvatarChange = async (nextAvatarUrl: string | null) => {
    setAvatarUrl(nextAvatarUrl);
    onAvatarUpdated?.(nextAvatarUrl);
    clearCurrentUserInfoCache();

    const { error } = await supabase.auth.refreshSession();
    if (error) {
      console.warn("Foto atualizada, mas a sessão visual não foi recarregada.");
    }
  };

  const handleAvatarUpload = async (file?: File | null) => {
    if (!file || uploadingAvatar) return;

    if (!isSupportedAvatarFile(file)) {
      setAvatarError("Envie uma imagem válida: HEIC, PNG, JPG, WebP ou GIF.");
      return;
    }

    if (file.size > MAX_ORIGINAL_AVATAR_BYTES) {
      setAvatarError("A imagem precisa ter até 25 MB.");
      return;
    }

    try {
      setUploadingAvatar(true);
      setAvatarError(null);

      const preparedFile = await prepareAvatarFile(file);
      if (preparedFile.size > MAX_UPLOAD_AVATAR_BYTES) {
        throw new Error("Não foi possível reduzir a imagem para até 2 MB.");
      }

      const formData = new FormData();
      formData.set("file", preparedFile, "avatar.jpg");

      const response = await fetch("/api/user/avatar", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        cache: "no-store",
      });

      const payload = await readAvatarResponse(response);
      await publishAvatarChange(payload.avatar ?? null);
    } catch (error: any) {
      console.error("Erro ao atualizar foto de perfil:", error);
      setAvatarError(error?.message ?? "Não foi possível atualizar a foto.");
    } finally {
      setUploadingAvatar(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (uploadingAvatar) return;

    try {
      setUploadingAvatar(true);
      setAvatarError(null);

      const response = await fetch("/api/user/avatar", {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });

      const payload = await readAvatarResponse(response);
      await publishAvatarChange(payload.avatar ?? null);
    } catch (error: any) {
      console.error("Erro ao remover foto de perfil:", error);
      setAvatarError(error?.message ?? "Não foi possível remover a foto.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-lg dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
            Meu perfil
          </h3>
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mb-5 flex items-center gap-4 rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
          <Avatar className="h-16 w-16">
            <AvatarImage src={avatarUrl ?? undefined} alt={user.name || "Usuário"} />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              Foto de perfil
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-slate-400">
              HEIC, PNG, JPG, WebP ou GIF até 25 MB. A imagem é otimizada automaticamente.
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept={AVATAR_ACCEPT}
                className="hidden"
                onChange={(event) => void handleAvatarUpload(event.target.files?.[0])}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Alterar foto
              </Button>

              {avatarUrl ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleRemoveAvatar()}
                  disabled={uploadingAvatar}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </Button>
              ) : null}
            </div>

            {avatarError ? (
              <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                {avatarError}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">Nome</div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {user.name || "Usuário"}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">Email</div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {user.email || "-"}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">
              Perfil de acesso
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {getRoleLabel(user.role)}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">Setor</div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {user.sector || "—"}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">
              Último acesso
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
              {formatDate(user.lastSignInAt)}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-xs text-gray-500 dark:text-slate-400">
              Estabelecimento
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-slate-100 break-words">
              {user.establishmentName || user.establishmentId || "—"}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </div>
    </div>
  );
}
