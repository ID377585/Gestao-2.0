import { NextResponse } from "next/server";
import { revalidateInventoryLabel } from "@/app/(dashboard)/dashboard/etiquetas/actions";

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { labelId, newNotes } = body ?? {};

    if (!labelId || typeof labelId !== "string" || !labelId.trim()) {
      return NextResponse.json(
        { error: "labelId não informado." },
        { status: 400 }
      );
    }

    const updated = await revalidateInventoryLabel({
      labelId: labelId.trim(),
      newNotes: newNotes ?? null,
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Erro ao revalidar etiqueta." },
      { status: 500 }
    );
  }
}
