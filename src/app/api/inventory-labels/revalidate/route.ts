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
  return NextResponse.json(
    { error: message, ...(extra ?? {}) },
    { status }
  );
}

export async function PATCH(req: Request) {
  try {
    // ✅ Garantia de JSON válido
    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Body inválido (JSON).");
    }

    // ✅ Validação defensiva do labelId
    const labelIdRaw = body?.labelId;
    const labelId =
      typeof labelIdRaw === "string" ? labelIdRaw.trim() : "";

    if (!labelId) {
      return jsonError(400, "labelId não informado.");
    }

    // ✅ newNotes pode ser objeto | string | null
    const newNotes = body?.newNotes ?? null;

    // ✅ Chamada da server action (fonte de verdade)
    const updated = await revalidateInventoryLabel({
      labelId,
      newNotes,
    });

    // ⚠️ Segurança extra (normalmente não cai aqui)
    if (!updated) {
      return jsonError(404, "Etiqueta não encontrada para revalidar.");
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (e: any) {
    const msg = String(e?.message ?? "").toLowerCase();

    // ✅ Mapeamento correto de erros conhecidos
    if (msg.includes("não encontrada")) {
      return jsonError(404, e.message);
    }

    if (
      msg.includes("não pertence") ||
      msg.includes("estabelecimento") ||
      msg.includes("permission") ||
      msg.includes("rls")
    ) {
      return jsonError(
        403,
        e.message || "Sem permissão para revalidar esta etiqueta."
      );
    }

    // ❌ fallback seguro
    return jsonError(
      500,
      e?.message ?? "Erro ao revalidar etiqueta."
    );
  }
}
