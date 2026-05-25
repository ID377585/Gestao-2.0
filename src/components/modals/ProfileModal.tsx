"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  onAvatarUpdated?: (avatarUrl: string | null) => void;
  user: {
    id: string;
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

function getAvatarPath(userId: string, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  return `${userId}/avatar-${Date.now()}.${extension}`;
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

  if (!open) return null;

  const updateAvatar = async (nextAvatarUrl: string | null) => {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ avatar_url: nextAvatarUrl })
      .eq("id", user.id);

    if (profileError) throw profileError;

    const { error: metadataError } = await supabase.auth.updateUser({
      data: { avatar_url: nextAvatarUrl },
    });

    if (metadataError) throw metadataError;

    setAvatarUrl(nextAvatarUrl);
    onAvatarUpdated?.(nextAvatarUrl);
  };

  const handleAvatarUpload = async (file?: File | null) => {
    if (!file || uploadingAvatar) return;

    if (!file.type.startsWith("image/")) {
      setAvatarError("Envie uma imagem válida.");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("A imagem precisa ter até 2 MB.");
      return;
    }

    try {
      setUploadingAvatar(true);
      setAvatarError(null);

      const filePath = getAvatarPath(user.id, file);
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      await updateAvatar(data.publicUrl);
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
      await updateAvatar(null);
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
              JPG, PNG ou WebP até 2 MB.
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
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
