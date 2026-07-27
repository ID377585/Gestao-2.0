import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

const LOSS_PHOTO_BUCKET = "loss-photos";

export async function GET(request: NextRequest) {
  const photoPath = request.nextUrl.searchParams.get("path")?.trim();

  if (!photoPath) {
    return new NextResponse("Foto não informada.", { status: 400 });
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

  if (!photoPath.startsWith(`${establishmentId}/`)) {
    return new NextResponse("Foto não autorizada.", { status: 403 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: loss, error: lossError } = await supabase
    .from("losses")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("photo_path", photoPath)
    .maybeSingle();

  if (lossError || !loss) {
    return new NextResponse("Foto não encontrada.", { status: 404 });
  }

  const { data, error } = await supabase.storage
    .from(LOSS_PHOTO_BUCKET)
    .createSignedUrl(photoPath, 60 * 10);

  if (error || !data?.signedUrl) {
    console.error("Erro ao gerar URL assinada da foto da perda:", error);
    return new NextResponse("Foto não encontrada.", { status: 404 });
  }

  return NextResponse.redirect(data.signedUrl);
}
