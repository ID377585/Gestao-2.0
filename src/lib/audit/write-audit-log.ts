import "server-only";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export type AuditLogInput = {
  establishmentId: string;
  actorUserId: string | null;
  targetUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown> | null;
};

export async function writeAuditLog(input: AuditLogInput) {
  try {
    const supabaseAdmin = getSupabaseAdminClient();

    const { error } = await supabaseAdmin.from("audit_logs").insert({
      establishment_id: input.establishmentId,
      actor_user_id: input.actorUserId,
      target_user_id: input.targetUserId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      details: input.details ?? {},
    });

    if (error) {
      const code = String((error as any)?.code ?? "");
      if (code === "42P01" || code === "PGRST205" || code === "PGRST204") {
        console.warn("[writeAuditLog] tabela audit_logs ainda não existe.");
        return;
      }

      console.error("[writeAuditLog] erro ao gravar auditoria:", error);
    }
  } catch (error) {
    console.error("[writeAuditLog] falha inesperada:", error);
  }
}
