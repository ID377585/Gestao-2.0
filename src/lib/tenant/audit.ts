import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeTenantAuditLog(params: {
  supabaseAdmin: SupabaseClient<any, any, any>;
  establishmentId: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, any> | null;
}) {
  const { error } = await params.supabaseAdmin.from("audit_logs").insert({
    establishment_id: params.establishmentId,
    actor_user_id: params.actorUserId ?? null,
    target_user_id: params.targetUserId ?? null,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId ?? null,
    details: params.details ?? {},
  });

  if (error) {
    const code = String((error as any)?.code ?? "");
    if (code === "42P01" || code === "PGRST205" || code === "PGRST204") {
      console.warn("Tabela audit_logs não disponível; auditoria ignorada.");
      return { skipped: true as const };
    }

    console.error("Erro ao gravar auditoria multiempresa:", error);
    return { skipped: true as const };
  }

  return { skipped: false as const };
}
