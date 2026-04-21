import { NextRequest, NextResponse } from "next/server";
import { processImportJob } from "@/lib/import-technical-sheets";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId } = body ?? {};

    if (!jobId) {
      return NextResponse.json(
        { error: "jobId é obrigatório." },
        { status: 400 }
      );
    }

    const result = await processImportJob(jobId);

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