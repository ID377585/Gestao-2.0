// src/app/api/losses/route.ts
import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import {
  getIdempotencyKeyFromRequest,
  runIdempotentAction,
} from "@/lib/idempotency/server";
import { rateLimit } from "@/lib/security/rate-limit";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";
import { getTenantModulePermissions } from "@/lib/tenant/module-access";

const LOSS_PHOTO_BUCKET = "loss-photos";
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function numOrNull(v: any) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function sanitizeFileName(value: string) {
  const clean = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);

  return clean || "foto-perda";
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "jpg";
  }
}

function parsePhotoInput(photo: any) {
  const dataUrl = String(photo?.dataUrl ?? "");
  const fileName = sanitizeFileName(String(photo?.fileName ?? "foto-perda"));
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);

  if (!match) {
    throw new Error("Foto inválida.");
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_PHOTO_TYPES.has(mimeType)) {
    throw new Error("Formato da foto não suportado.");
  }

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength <= 0) {
    throw new Error("Foto vazia.");
  }

  if (buffer.byteLength > MAX_PHOTO_BYTES) {
    throw new Error("Foto maior que 5MB.");
  }

  return { buffer, fileName, mimeType };
}

async function getAuthAndEstablishment() {
  const supabase = await createSupabaseServerClient();

  try {
    const { user, tenant } = await getAuthenticatedTenantUserOrThrow();

    return {
      supabase,
      user,
      tenant,
      establishment_id: tenant.establishmentId,
      error: null,
    };
  } catch (error: any) {
    return {
      supabase,
      user: null,
      tenant: null,
      establishment_id: null,
      error: NextResponse.json(
        { error: error?.message ?? "Estabelecimento não encontrado." },
        { status: error?.message === "Não autenticado." ? 401 : 403 }
      ),
    };
  }
}

export async function GET(req: Request) {
  const { supabase, user, tenant, error, establishment_id } =
    await getAuthAndEstablishment();
  if (error || !establishment_id || !tenant) return error!;
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const modulePermissions = await getTenantModulePermissions(tenant);
  if (!modulePermissions.estoque) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar o módulo de estoque." },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const product_id = url.searchParams.get("product_id");
  const reason = url.searchParams.get("reason");
  const date_from = url.searchParams.get("date_from");
  const date_to = url.searchParams.get("date_to");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  let q = supabase
    .from("losses")
    .select("*")
    .eq("establishment_id", establishment_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (product_id) q = q.eq("product_id", product_id);
  if (reason) q = q.eq("reason", reason);
  if (date_from) q = q.gte("created_at", date_from);
  if (date_to) q = q.lte("created_at", date_to);

  const { data, error: qErr } = await q;

  if (qErr) {
    console.error("GET /api/losses error:", qErr);
    return NextResponse.json(
      { error: qErr.message ?? "Erro ao carregar histórico de perdas." },
      { status: 500 }
    );
  }

  return NextResponse.json({ losses: data ?? [] });
}

export async function POST(req: Request) {
  const limited = rateLimit(req, {
    key: "losses-create",
    limit: 60,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const { user, tenant, error, establishment_id } =
    await getAuthAndEstablishment();
  if (error || !establishment_id || !tenant) return error!;
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const modulePermissions = await getTenantModulePermissions(tenant);
  if (!modulePermissions.estoque) {
    return NextResponse.json(
      { error: "Você não tem permissão para acessar o módulo de estoque." },
      { status: 403 }
    );
  }

  const body = await req.json();

  const { product_id, qty, lot, reason, reason_detail, qrcode, photo } = body;
  const unit_label = String(body.unit_label ?? body.unitLabel ?? "UN")
    .trim()
    .replace(/\s+/g, "")
    .toUpperCase();

  if (!product_id || qty == null || !reason) {
    return NextResponse.json(
      { error: "Dados obrigatórios não informados." },
      { status: 400 }
    );
  }

  const qtyNumber = numOrNull(qty);
  if (!qtyNumber || qtyNumber <= 0) {
    return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 });
  }

  if (!unit_label) {
    return NextResponse.json({ error: "Unidade inválida." }, { status: 400 });
  }

  const reasonTrim = String(reason).trim();
  const reasonDetailTrim = String(reason_detail ?? "").trim();
  const lotTrim = String(lot ?? "").trim();
  const labelCodeTrim = String(qrcode ?? "").trim();

  if (reasonTrim === "Outro" && reasonDetailTrim.length < 3) {
    return NextResponse.json(
      { error: "Descreva o motivo (Outro)." },
      { status: 400 }
    );
  }

  const supabaseAdmin = createSupabaseAdminClient();
  let result: any = null;
  let replayed = false;

  try {
    const action = await runIdempotentAction({
      key: getIdempotencyKeyFromRequest(req, body),
      operation: "losses.register",
      userId: user.id,
      establishmentId: establishment_id,
      payload: {
        product_id,
        qty: qtyNumber,
        unit_label,
        reason: reasonTrim,
        reason_detail: reasonDetailTrim || null,
        lot: lotTrim || null,
        qrcode: labelCodeTrim || null,
      },
      execute: async () => {
        const { data, error: rpcErr } = await supabaseAdmin.rpc(
          "register_loss",
          {
            p_establishment_id: establishment_id,
            p_product_id: product_id,
            p_qty: qtyNumber,
            p_unit_label: unit_label,
            p_reason: reasonTrim,
            p_reason_detail: reasonDetailTrim || null,
            p_lot: lotTrim || null,
            p_label_code: labelCodeTrim || null,
            p_user_id: user.id,
            p_allow_negative: false,
          }
        );

        if (rpcErr) {
          console.error("POST /api/losses rpc error:", rpcErr);
          throw new Error(rpcErr.message ?? "Erro ao registrar perda.");
        }

        return Array.isArray(data) ? data[0] : data;
      },
    });

    result = action.value;
    replayed = action.replayed;
  } catch (rpcError: any) {
    return NextResponse.json(
      { error: rpcError?.message ?? "Erro ao registrar perda." },
      { status: 400 }
    );
  }

  if (result == null) {
    return NextResponse.json(
      {
        error:
          "RPC executou sem retorno. Verifique assinatura/retorno da função register_loss.",
      },
      { status: 400 }
    );
  }

  let photoError: string | null = null;

  if (!replayed && photo?.dataUrl) {
    try {
      const parsedPhoto = parsePhotoInput(photo);
      const lossId = String(result.loss_id ?? "");

      if (!lossId) {
        throw new Error("Perda registrada sem identificador para anexar foto.");
      }

      const extension = extensionForMimeType(parsedPhoto.mimeType);
      const photoPath = `${establishment_id}/${lossId}/${Date.now()}-${parsedPhoto.fileName}.${extension}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(LOSS_PHOTO_BUCKET)
        .upload(photoPath, parsedPhoto.buffer, {
          contentType: parsedPhoto.mimeType,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { error: updateError } = await supabaseAdmin
        .from("losses")
        .update({
          photo_path: photoPath,
          photo_file_name: parsedPhoto.fileName,
          photo_mime_type: parsedPhoto.mimeType,
        })
        .eq("id", lossId)
        .eq("establishment_id", establishment_id);

      if (updateError) {
        await supabaseAdmin.storage
          .from(LOSS_PHOTO_BUCKET)
          .remove([photoPath])
          .catch(() => {});

        throw updateError;
      }
    } catch (err: any) {
      console.error("POST /api/losses photo error:", err);
      photoError = err?.message ?? "Perda registrada, mas a foto não foi salva.";
    }
  }

  return NextResponse.json(
    { success: true, result, photoError },
    {
      headers: replayed ? { "Idempotency-Replayed": "true" } : undefined,
    }
  );
}
