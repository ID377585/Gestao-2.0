import { NextResponse } from "next/server";
import { z } from "zod";

import { getTenantAdminContext } from "@/lib/compliance/admin-context.server";
import {
  updateDataSubjectRequest,
  verifyDataSubjectIdentity,
} from "@/lib/compliance/workflows.server";

const bodySchema = z.object({
  action: z.enum(["update_status", "verify_identity"]),
  status: z.string().optional(),
  resolutionNotes: z.string().max(4000).nullable().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const admin = await getTenantAdminContext();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
  }

  try {
    const data =
      parsed.data.action === "verify_identity"
        ? await verifyDataSubjectIdentity({
            establishmentId: admin.tenant.establishmentId,
            requestId: id,
          })
        : await updateDataSubjectRequest({
            establishmentId: admin.tenant.establishmentId,
            requestId: id,
            status: parsed.data.status ?? "in_review",
            resolutionNotes: parsed.data.resolutionNotes,
          });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar solicitação." },
      { status: 400 }
    );
  }
}
