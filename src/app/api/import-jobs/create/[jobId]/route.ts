import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

type RouteContext = {
  params: Promise<{
    jobId: string;
  }>;
};

export async function GET(_req: NextRequest, context: RouteContext) {
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
    const { jobId } = await context.params;

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId é obrigatório." },
        { status: 400 }
      );
    }

    const { data: job, error: jobError } = await supabaseAdmin
      .from("import_jobs")
      .select("*")
      .eq("id", jobId)
      .eq("establishment_id", tenant.establishmentId)
      .single();

    if (jobError || !job) {
      return NextResponse.json(
        { error: jobError?.message || "Job não encontrado." },
        { status: 404 }
      );
    }

    const { data: pages, error: pagesError } = await supabaseAdmin
      .from("import_job_pages")
      .select("*")
      .eq("job_id", jobId)
      .order("page_number", { ascending: true });

    if (pagesError) {
      return NextResponse.json(
        { error: pagesError.message || "Erro ao carregar páginas do job." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      job,
      pages: pages || [],
    });
  } catch (error: any) {
    console.error("Erro ao consultar import job:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao consultar importação." },
      { status: 500 }
    );
  }
}
