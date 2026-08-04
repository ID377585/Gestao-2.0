import { NextRequest, NextResponse } from "next/server";

import { rateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

const NUTRITION_FILES_BUCKET = "nutrition-files";

function normalizePath(value: string | null) {
  return (value ?? "").trim().replace(/^\/+/, "");
}

export async function GET(request: NextRequest) {
  const limited = rateLimit(request, {
    key: "nutrition-file",
    limit: 240,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const filePath = normalizePath(request.nextUrl.searchParams.get("path"));
  if (!filePath) {
    return new NextResponse("Arquivo não informado.", { status: 400 });
  }

  let establishmentId = "";
  let userId = "";
  try {
    const { tenant, user } = await getAuthenticatedTenantUserOrThrow();
    establishmentId = tenant.establishmentId;
    userId = user.id;
  } catch (error: any) {
    return new NextResponse(error?.message ?? "Não autenticado.", {
      status: error?.message === "Não autenticado." ? 401 : 403,
    });
  }

  if (!filePath.startsWith(`${establishmentId}/`)) {
    return new NextResponse("Arquivo não autorizado.", { status: 403 });
  }

  const supabaseAdmin = createSupabaseAdminClient();
  const [evidenceResult, signatureResult, reportResult] = await Promise.all([
    supabaseAdmin
      .from("nutrition_evidences")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("file_path", filePath)
      .is("removed_at", null)
      .maybeSingle(),
    supabaseAdmin
      .from("nutrition_signatures")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("signature_path", filePath)
      .maybeSingle(),
    supabaseAdmin
      .from("nutrition_reports")
      .select("id")
      .eq("establishment_id", establishmentId)
      .eq("file_path", filePath)
      .maybeSingle(),
  ]);

  const matchedResource =
    evidenceResult.data
      ? { type: "nutrition_evidence", id: String(evidenceResult.data.id) }
      : signatureResult.data
        ? { type: "nutrition_signature", id: String(signatureResult.data.id) }
        : reportResult.data
          ? { type: "nutrition_report", id: String(reportResult.data.id) }
          : null;

  if (!matchedResource) {
    return new NextResponse("Arquivo não encontrado.", { status: 404 });
  }

  const { data, error } = await supabaseAdmin.storage
    .from(NUTRITION_FILES_BUCKET)
    .createSignedUrl(filePath, 60 * 10);

  if (error || !data?.signedUrl) {
    console.error("[nutrition-file] signed url error:", error);
    return new NextResponse("Arquivo indisponível.", { status: 404 });
  }

  if (matchedResource.type === "nutrition_report") {
    const { error: auditError } = await supabaseAdmin
      .from("nutrition_audit_events")
      .insert({
        establishment_id: establishmentId,
        actor_user_id: userId,
        action: "report.download_requested",
        resource_type: matchedResource.type,
        resource_id: matchedResource.id,
        metadata: {
          file_path: filePath,
          signed_url_ttl_seconds: 60 * 10,
        },
      });

    if (auditError) {
      console.error("[nutrition-file] audit error:", auditError);
    }
  }

  return NextResponse.redirect(data.signedUrl);
}
