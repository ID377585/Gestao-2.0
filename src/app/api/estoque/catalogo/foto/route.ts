import { NextRequest, NextResponse } from "next/server";

import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";
import { getTenantModulePermissions } from "@/lib/tenant/module-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATALOG_PHOTO_BUCKET = "inventory-catalog-photos";

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, {
    key: "inventory-catalog-photo",
    limit: 240,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const photoPath = request.nextUrl.searchParams.get("path")?.trim();

  if (!photoPath) {
    return new NextResponse("Foto não informada.", { status: 400 });
  }

  let establishmentId = "";

  try {
    const { tenant } = await getAuthenticatedTenantUserOrThrow();
    const permissions = await getTenantModulePermissions(tenant);

    if (!permissions.estoque) {
      return new NextResponse("Foto não autorizada.", { status: 403 });
    }

    establishmentId = tenant.establishmentId;
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Não foi possível validar a empresa ativa.";

    return new NextResponse(message, {
      status: message === "Não autenticado." ? 401 : 403,
    });
  }

  if (!photoPath.startsWith(`${establishmentId}/`)) {
    return new NextResponse("Foto não autorizada.", { status: 403 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const { data: item, error: itemError } = await supabaseAdmin
    .from("inventory_catalog_items")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("photo_path", photoPath)
    .maybeSingle();

  if (itemError) {
    console.error("[inventory-catalog] photo lookup failed:", itemError);
  }

  if (itemError || !item) {
    return new NextResponse("Foto não encontrada.", { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(CATALOG_PHOTO_BUCKET)
    .createSignedUrl(photoPath, 60 * 10);

  if (error || !data?.signedUrl) {
    console.error("[inventory-catalog] signed URL failed:", error);
    return new NextResponse("Foto não encontrada.", { status: 404 });
  }

  const response = NextResponse.redirect(data.signedUrl, 307);
  response.headers.set("Cache-Control", "private, max-age=300");
  return response;
}
