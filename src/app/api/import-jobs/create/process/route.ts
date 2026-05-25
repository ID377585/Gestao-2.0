import { NextRequest, NextResponse } from "next/server";
import { processImportJob } from "@/lib/import-technical-sheets";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

export async function POST(req: NextRequest) {
  try {
    let tenantContext: Awaited<ReturnType<typeof getAuthenticatedTenantUserOrThrow>>;
    try {
      tenantContext = await getAuthenticatedTenantUserOrThrow();
    } catch (error: any) {
      return NextResponse.json(
        { error: error?.message ?? "Não autenticado." },
        { status: error?.message === "Não autenticado." ? 401 : 403 }
      );
    }

    const { tenant } = tenantContext;
    const body = await req.json();
    const { jobId } = body ?? {};

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId é obrigatório." },
        { status: 400 }
      );
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from("import_jobs")
      .select("id")
      .eq("id", jobId)
      .eq("establishment_id", tenant.establishmentId)
      .maybeSingle();

    if (jobError) {
      console.error("Erro ao validar import job:", jobError);
      return NextResponse.json(
        { error: "Não foi possível validar a importação." },
        { status: 500 }
      );
    }

    if (!job) {
      return NextResponse.json(
        { error: "Importação não encontrada para a empresa ativa." },
        { status: 404 }
      );
    }

    const result = await processImportJob({
      jobId: String(jobId),
      establishmentId: tenant.establishmentId,
    });

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Erro ao processar import job:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao processar importação." },
      { status: 500 }
    );
  }
}
