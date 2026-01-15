import { NextResponse } from "next/server";
import { revalidateInventoryLabel } from "@/app/(dashboard)/dashboard/etiquetas/actions";

export async function PATCH(req: Request) {
  const body = await req.json();
  const { labelId, newNotes } = body ?? {};
  const updated = await revalidateInventoryLabel({ labelId, newNotes });
  return NextResponse.json(updated);
}
