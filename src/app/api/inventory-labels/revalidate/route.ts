// src/app/api/inventory-labels/revalidate/route.ts
import { NextResponse } from "next/server";
import { revalidateInventoryLabel } from "@/app/(dashboard)/dashboard/etiquetas/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonError(
  status: number,
  message: string,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: message, ...(extra ?? {}) }, { status });
}

export async function PATCH(req: Request) {
  try {
    // ✅ Garantia de JSON válido
    let body: any = null;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Body inválido (JSON).");
    }

    const labelIdRaw = body?.labelId;
    const labelId = typeof labelIdRaw === "string" ? labelIdRaw.trim() : "";

    if (!labelId) {
      return jsonError(400, "labelId não informado.");
    }

    // ✅ Mantém comportamento atual: newNotes pode ser objeto/string/null
    const newNotes = body?.newNotes ?? null;

    // ✅ Executa a action
    const updated = await revalidateInventoryLabel({
      labelId,
      newNotes,
    });

    // ✅ Se a action retornar algo falsy, responde 404 (evita 500 genérico)
    if (!updated) {
      return jsonError(404, "Etiqueta não encontrada para revalidar.");
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message ?? "");

    // ✅ Erros comuns tratados com status adequado
    if (msg.toLowerCase().includes("não encontrada")) {
      return jsonError(404, msg);
    }

    if (
      msg.toLowerCase().includes("não pertence") ||
      msg.toLowerCase().includes("estabelecimento") ||
      msg.toLowerCase().includes("permission") ||
      msg.toLowerCase().includes("rls")
    ) {
      return jsonError(403, msg || "Sem permissão para revalidar esta etiqueta.");
    }

    return jsonError(500, msg || "Erro ao revalidar etiqueta.");
  }
}
