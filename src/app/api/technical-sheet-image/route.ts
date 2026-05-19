import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

const TECHNICAL_SHEET_BUCKET = "technical-sheet-images";

export async function GET(request: NextRequest) {
  const imagePath = request.nextUrl.searchParams.get("path");

  if (!imagePath?.trim()) {
    return new NextResponse("Imagem não informada.", { status: 400 });
  }

  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = String((membership as any)?.establishment_id || "");

  if (!establishmentId) {
    return new NextResponse("Estabelecimento não encontrado.", { status: 403 });
  }

  const normalizedPath = imagePath.trim();

  if (!normalizedPath.startsWith(`${establishmentId}/`)) {
    return new NextResponse("Imagem não autorizada.", { status: 403 });
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.storage
    .from(TECHNICAL_SHEET_BUCKET)
    .createSignedUrl(normalizedPath, 60 * 10);

  if (error || !data?.signedUrl) {
    console.error("Erro ao gerar URL assinada da imagem da ficha técnica:", error);
    return new NextResponse("Imagem não encontrada.", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
