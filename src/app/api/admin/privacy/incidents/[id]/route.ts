import { NextResponse } from "next/server";
import { z } from "zod";

import { getTenantAdminContext } from "@/lib/compliance/admin-context.server";
import {
  markIncidentControllerNotified,
  updateSecurityIncident,
} from "@/lib/compliance/workflows.server";

const bodySchema = z.object({
  action: z.enum(["update", "mark_controller_notified"]),
  status: z.string().optional(),
  severity: z.string().optional(),
  rootCause: z.string().max(6000).nullable().optional(),
  correctiveActions: z.string().max(6000).nullable().optional(),
  anpdNotificationRequired: z.boolean().nullable().optional(),
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
      parsed.data.action === "mark_controller_notified"
        ? await markIncidentControllerNotified({
            establishmentId: admin.tenant.establishmentId,
            incidentId: id,
          })
        : await updateSecurityIncident({
            establishmentId: admin.tenant.establishmentId,
            incidentId: id,
            status: parsed.data.status,
            severity: parsed.data.severity,
            rootCause: parsed.data.rootCause,
            correctiveActions: parsed.data.correctiveActions,
            anpdNotificationRequired: parsed.data.anpdNotificationRequired,
          });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar incidente." },
      { status: 400 }
    );
  }
}
