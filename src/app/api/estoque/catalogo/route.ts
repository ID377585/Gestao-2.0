import { createHash, randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getIdempotencyKeyFromRequest,
  runIdempotentAction,
} from "@/lib/idempotency/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";
import { getTenantModulePermissions } from "@/lib/tenant/module-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATALOG_PHOTO_BUCKET = "inventory-catalog-photos";
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const CATEGORIES = [
  "Utensílios",
  "Louças",
  "Talheres",
  "Equipamentos",
  "Eletrodomésticos",
  "Mobiliário",
  "Enxoval",
  "Outros",
] as const;

const ITEM_CONDITIONS = [
  "Novo",
  "Ótimo",
  "Bom",
  "Regular",
  "Danificado",
  "Em manutenção",
] as const;

const compactText = (maxLength: number) =>
  z.preprocess(
    (value) => String(value ?? "").trim().replace(/\s+/g, " "),
    z.string().min(1).max(maxLength)
  );

const optionalCompactText = (maxLength: number) =>
  z.preprocess((value) => {
    const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
    return normalized || null;
  }, z.string().max(maxLength).nullable());

const optionalLongText = (maxLength: number) =>
  z.preprocess((value) => {
    const normalized = String(value ?? "").replace(/\r\n/g, "\n").trim();
    return normalized || null;
  }, z.string().max(maxLength).nullable());

const catalogItemSchema = z.object({
  name: compactText(180),
  brand: optionalCompactText(120),
  model: optionalCompactText(120),
  category: z.enum(CATEGORIES),
  quantity: z.preprocess(
    (value) =>
      value === null || value === undefined || String(value).trim() === ""
        ? undefined
        : value,
    z.coerce.number().int().min(0).max(1_000_000)
  ),
  unit_label: compactText(30),
  item_condition: z.enum(ITEM_CONDITIONS),
  location: optionalCompactText(160),
  description: optionalLongText(2000),
});

class CatalogHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "CatalogHttpError";
    this.status = status;
  }
}

type CatalogContext = Awaited<ReturnType<typeof getCatalogContext>>;
type CatalogPhoto = Awaited<ReturnType<typeof parsePhoto>>;

function sanitizeFileName(value: string) {
  const withoutExtension = String(value ?? "foto-catalogo")
    .replace(/\.[^.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70);

  return withoutExtension || "foto-catalogo";
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

function parseCatalogInput(formData: FormData) {
  const parsed = catalogItemSchema.safeParse({
    name: formData.get("name"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    category: formData.get("category"),
    quantity: formData.get("quantity"),
    unit_label: formData.get("unit_label"),
    item_condition: formData.get("item_condition"),
    location: formData.get("location"),
    description: formData.get("description"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path?.[0] ? String(issue.path[0]) : "cadastro";
    throw new CatalogHttpError(
      400,
      `Revise o campo ${field}: ${issue?.message ?? "valor inválido"}.`
    );
  }

  return parsed.data;
}

async function parsePhoto(formData: FormData, required: boolean) {
  const candidate = formData.get("photo");

  if (!(candidate instanceof File) || candidate.size <= 0) {
    if (required) {
      throw new CatalogHttpError(400, "Selecione uma foto para o item.");
    }

    return null;
  }

  const mimeType = String(candidate.type ?? "").toLowerCase();

  if (!ALLOWED_PHOTO_TYPES.has(mimeType)) {
    throw new CatalogHttpError(
      400,
      "Formato de foto não suportado. Use JPG, PNG ou WebP."
    );
  }

  if (candidate.size > MAX_PHOTO_BYTES) {
    throw new CatalogHttpError(
      400,
      "A foto ficou maior que 3 MB. Escolha outra imagem ou reduza o tamanho."
    );
  }

  const buffer = Buffer.from(await candidate.arrayBuffer());

  if (buffer.byteLength <= 0) {
    throw new CatalogHttpError(400, "A foto enviada está vazia.");
  }

  return {
    buffer,
    mimeType,
    fileName: sanitizeFileName(candidate.name),
    sizeBytes: buffer.byteLength,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function getCatalogContext() {
  let authContext: Awaited<ReturnType<typeof getAuthenticatedTenantUserOrThrow>>;

  try {
    authContext = await getAuthenticatedTenantUserOrThrow();
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível validar a empresa ativa.";
    const status = message === "Não autenticado." ? 401 : 403;
    throw new CatalogHttpError(status, message);
  }

  const permissions = await getTenantModulePermissions(authContext.tenant);

  if (!permissions.estoque) {
    throw new CatalogHttpError(
      403,
      "Você não tem permissão para acessar o Catálogo do Estoque."
    );
  }

  return {
    ...authContext,
    supabaseAdmin: createSupabaseAdminClient(),
  };
}

async function uploadPhoto(params: {
  context: CatalogContext;
  itemId: string;
  photo: NonNullable<CatalogPhoto>;
}) {
  const extension = extensionForMimeType(params.photo.mimeType);
  const photoPath = `${params.context.tenant.establishmentId}/${params.itemId}/${Date.now()}-${params.photo.fileName}.${extension}`;

  const { error } = await params.context.supabaseAdmin.storage
    .from(CATALOG_PHOTO_BUCKET)
    .upload(photoPath, params.photo.buffer, {
      contentType: params.photo.mimeType,
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    console.error("[inventory-catalog] photo upload failed:", error);
    throw new CatalogHttpError(
      500,
      "Não foi possível salvar a foto do item. Tente novamente."
    );
  }

  return photoPath;
}

async function removePhotoBestEffort(
  context: CatalogContext,
  photoPath: string | null | undefined
) {
  if (!photoPath) return;

  const { error } = await context.supabaseAdmin.storage
    .from(CATALOG_PHOTO_BUCKET)
    .remove([photoPath]);

  if (error) {
    console.error("[inventory-catalog] photo cleanup failed:", {
      photoPath,
      error,
    });
  }
}

async function loadItemOrThrow(context: CatalogContext, itemId: string) {
  const { data, error } = await context.supabaseAdmin
    .from("inventory_catalog_items")
    .select("*")
    .eq("id", itemId)
    .eq("establishment_id", context.tenant.establishmentId)
    .maybeSingle();

  if (error) {
    console.error("[inventory-catalog] item lookup failed:", error);
    throw new CatalogHttpError(
      500,
      "Não foi possível localizar o item do catálogo."
    );
  }

  if (!data) {
    throw new CatalogHttpError(404, "Item do catálogo não encontrado.");
  }

  return data as Record<string, unknown> & {
    id: string;
    photo_path: string | null;
  };
}

function idFromValue(value: unknown) {
  const parsed = z.string().uuid().safeParse(String(value ?? "").trim());

  if (!parsed.success) {
    throw new CatalogHttpError(400, "Identificador do item inválido.");
  }

  return parsed.data;
}

function toErrorResponse(error: unknown) {
  if (error instanceof CatalogHttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("[inventory-catalog] unexpected error:", error);
  return NextResponse.json(
    { error: "Ocorreu um erro inesperado no Catálogo. Tente novamente." },
    { status: 500 }
  );
}

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-catalog-create",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const context = await getCatalogContext();
    const formData = await request.formData();
    const input = parseCatalogInput(formData);
    const photo = await parsePhoto(formData, true);

    const action = await runIdempotentAction({
      key: getIdempotencyKeyFromRequest(request),
      operation: "inventory_catalog.create",
      userId: context.user.id,
      establishmentId: context.tenant.establishmentId,
      payload: {
        ...input,
        photo_sha256: photo!.sha256,
        photo_size_bytes: photo!.sizeBytes,
      },
      execute: async () => {
        const itemId = randomUUID();
        const photoPath = await uploadPhoto({
          context,
          itemId,
          photo: photo!,
        });

        const { data, error } = await context.supabaseAdmin
          .from("inventory_catalog_items")
          .insert({
            id: itemId,
            establishment_id: context.tenant.establishmentId,
            ...input,
            photo_path: photoPath,
            photo_file_name: photo!.fileName,
            photo_mime_type: photo!.mimeType,
            photo_size_bytes: photo!.sizeBytes,
            created_by: context.user.id,
            updated_by: context.user.id,
          })
          .select("*")
          .single();

        if (error || !data) {
          await removePhotoBestEffort(context, photoPath);
          console.error("[inventory-catalog] insert failed:", error);
          throw new CatalogHttpError(
            500,
            "Não foi possível cadastrar o item no catálogo."
          );
        }

        return data;
      },
    });

    return NextResponse.json(
      { item: action.value },
      {
        status: action.replayed ? 200 : 201,
        headers: action.replayed
          ? { "Idempotency-Replayed": "true" }
          : undefined,
      }
    );
  } catch (error: unknown) {
    return toErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-catalog-update",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const context = await getCatalogContext();
    const formData = await request.formData();
    const itemId = idFromValue(formData.get("id"));
    const input = parseCatalogInput(formData);
    const photo = await parsePhoto(formData, false);
    const removePhoto = String(formData.get("remove_photo") ?? "") === "true";
    const existing = await loadItemOrThrow(context, itemId);

    const action = await runIdempotentAction({
      key: getIdempotencyKeyFromRequest(request),
      operation: "inventory_catalog.update",
      userId: context.user.id,
      establishmentId: context.tenant.establishmentId,
      payload: {
        id: itemId,
        ...input,
        remove_photo: removePhoto,
        photo_sha256: photo?.sha256 ?? null,
        photo_size_bytes: photo?.sizeBytes ?? null,
      },
      execute: async () => {
        let newPhotoPath: string | null = null;

        if (photo) {
          newPhotoPath = await uploadPhoto({ context, itemId, photo });
        }

        const photoFields = photo
          ? {
              photo_path: newPhotoPath,
              photo_file_name: photo.fileName,
              photo_mime_type: photo.mimeType,
              photo_size_bytes: photo.sizeBytes,
            }
          : removePhoto
            ? {
                photo_path: null,
                photo_file_name: null,
                photo_mime_type: null,
                photo_size_bytes: null,
              }
            : {};

        const { data, error } = await context.supabaseAdmin
          .from("inventory_catalog_items")
          .update({
            ...input,
            ...photoFields,
            updated_by: context.user.id,
          })
          .eq("id", itemId)
          .eq("establishment_id", context.tenant.establishmentId)
          .select("*")
          .single();

        if (error || !data) {
          await removePhotoBestEffort(context, newPhotoPath);
          console.error("[inventory-catalog] update failed:", error);
          throw new CatalogHttpError(
            500,
            "Não foi possível atualizar o item do catálogo."
          );
        }

        if ((photo || removePhoto) && existing.photo_path !== newPhotoPath) {
          await removePhotoBestEffort(context, existing.photo_path);
        }

        return data;
      },
    });

    return NextResponse.json(
      { item: action.value },
      {
        headers: action.replayed
          ? { "Idempotency-Replayed": "true" }
          : undefined,
      }
    );
  } catch (error: unknown) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, {
    key: "inventory-catalog-delete",
    limit: 30,
    windowMs: 60_000,
  });
  if (limited) return limited;

  try {
    const context = await getCatalogContext();
    const body = (await request.json()) as Record<string, unknown>;
    const itemId = idFromValue(body.id);

    const action = await runIdempotentAction({
      key: getIdempotencyKeyFromRequest(request, body),
      operation: "inventory_catalog.delete",
      userId: context.user.id,
      establishmentId: context.tenant.establishmentId,
      payload: { id: itemId },
      execute: async () => {
        const existing = await loadItemOrThrow(context, itemId);
        const { data, error } = await context.supabaseAdmin
          .from("inventory_catalog_items")
          .delete()
          .eq("id", itemId)
          .eq("establishment_id", context.tenant.establishmentId)
          .select("id")
          .single();

        if (error || !data) {
          console.error("[inventory-catalog] delete failed:", error);
          throw new CatalogHttpError(
            500,
            "Não foi possível excluir o item do catálogo."
          );
        }

        await removePhotoBestEffort(context, existing.photo_path);
        return { id: itemId };
      },
    });

    return NextResponse.json(
      { deleted: true, id: action.value.id },
      {
        headers: action.replayed
          ? { "Idempotency-Replayed": "true" }
          : undefined,
      }
    );
  } catch (error: unknown) {
    return toErrorResponse(error);
  }
}
