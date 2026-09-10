import { NextResponse } from "next/server";
import { z } from "zod";

import { getTenantAdminContext } from "@/lib/compliance/admin-context.server";
import { transitionTenantOffboarding } from "@/lib/compliance/workflows.server";

const bodySchema = z.object({
  nextStatus: z.enum([
    "read_only",
    "export_window",
    "retention",
    "deletion_scheduled",
    "completed",
    "canceled",
  ]),
  note: z.string().max(4000).nullable().optional(),
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
    const data = await transitionTenantOffboarding({
      establishmentId: admin.tenant.establishmentId,
      offboardingId: id,
      actorUserId: admin.user.id,
      nextStatus: parsed.data.nextStatus,
      note: parsed.data.note,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao atualizar o encerramento.",
      },
      { status: 400 }
    );
  }
}
