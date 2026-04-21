import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 40 * 1024 * 1024; // 40 MB

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      fileName,
      fileUrl,
      filePath,
      fileSize,
      mimeType,
      category,
      uploadedBy,
      establishmentId,
    } = body ?? {};

    if (!fileName || !fileUrl || !filePath || !fileSize || !mimeType) {
      return NextResponse.json(
        { error: "Dados obrigatórios do arquivo não informados." },
        { status: 400 }
      );
    }

    if (!establishmentId) {
      return NextResponse.json(
        { error: "establishmentId é obrigatório." },
        { status: 400 }
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

    const { data, error } = await supabaseAdmin
      .from("import_jobs")
      .insert({
        file_name: fileName,
        file_url: fileUrl,
        file_path: filePath,
        file_size: Number(fileSize),
        mime_type: mimeType,
        category: category || "Importado PDF",
        uploaded_by: uploadedBy || null,
        created_by: uploadedBy || null,
        establishment_id: establishmentId,
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