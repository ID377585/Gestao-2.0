import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getAuthenticatedTenantUserOrThrow } from "@/lib/tenant/guards";

const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40 MB

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

    const { user, tenant } = tenantContext;
    const body = await req.json();

    const {
      fileName,
      fileUrl,
      filePath,
      fileSize,
      mimeType,
      category,
      establishmentId,
    } = body ?? {};

    if (!fileName || !fileUrl || !filePath || !fileSize || !mimeType) {
      return NextResponse.json(
        { error: "Dados obrigatórios do arquivo não informados." },
        { status: 400 }
      );
    }

    const requestedEstablishmentId = String(establishmentId ?? "").trim();
    const activeEstablishmentId = tenant.establishmentId;

    if (requestedEstablishmentId && requestedEstablishmentId !== activeEstablishmentId) {
      return NextResponse.json(
        { error: "Estabelecimento inválido para a empresa ativa." },
        { status: 403 }
      );
    }

    if (mimeType !== "application/pdf") {
      return NextResponse.json(
        { error: "Apenas arquivos PDF são permitidos." },
        { status: 400 }
      );
    }

    if (Number(fileSize) > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "O arquivo excede o limite de 40 MB." },
        { status: 400 }
      );
    }

    const normalizedFilePath = String(filePath ?? "").trim();
    if (!normalizedFilePath.startsWith(`${activeEstablishmentId}/`)) {
      return NextResponse.json(
        { error: "Caminho do arquivo inválido para a empresa ativa." },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("import_jobs")
      .insert({
        file_name: fileName,
        file_url: fileUrl,
        file_path: normalizedFilePath,
        file_size: Number(fileSize),
        mime_type: mimeType,
        category: category || "Importado PDF",
        uploaded_by: user.id,
        created_by: user.id,
        establishment_id: activeEstablishmentId,
        status: "uploaded",
        total_pages: 0,
        detected_recipes: 0,
        created_recipes: 0,
        errors: [],
      })
      .select("id, status, created_at")
      .single();

    if (error) {
      console.error("Erro ao criar import_job:", error);
      return NextResponse.json(
        { error: error.message || "Erro ao criar job de importação." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      jobId: data.id,
      status: data.status,
      createdAt: data.created_at,
      message: "Job de importação criado com sucesso.",
    });
  } catch (error: any) {
    console.error("Erro interno ao criar import_job:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao criar job de importação." },
      { status: 500 }
    );
  }
}
