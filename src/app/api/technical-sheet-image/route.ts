import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

const TECHNICAL_SHEET_BUCKET = "technical-sheet-images";

export async function GET(request: NextRequest) {
  const imagePath = request.nextUrl.searchParams.get("path");

  if (!imagePath?.trim()) {
    return new NextResponse("Imagem não informada.", { status: 400 });
  }

  let establishmentId = "";
  try {
    const { tenant } = await getAuthenticatedTenantUserOrThrow();
    establishmentId = tenant.establishmentId;
  } catch (error: any) {
    return new NextResponse(
      error?.message ?? "Estabelecimento não encontrado.",
      { status: error?.message === "Não autenticado." ? 401 : 403 }
    );
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
