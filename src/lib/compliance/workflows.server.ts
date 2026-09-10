import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

const PRIVACY_REQUEST_STATUSES = new Set([
  "received",
  "identity_verification",
  "in_review",
  "waiting_controller",
  "processing",
  "completed",
  "rejected_with_basis",
  "canceled",
]);

const INCIDENT_STATUSES = new Set([
  "open",
  "triage",
  "contained",
  "investigating",
  "remediated",
  "closed",
]);

const INCIDENT_SEVERITIES = new Set([
  "under_review",
  "low",
  "medium",
  "high",
  "critical",
]);

const OFFBOARDING_TRANSITIONS: Record<string, string[]> = {
  requested: ["read_only", "canceled"],
  read_only: ["export_window", "canceled"],
  export_window: ["retention", "canceled"],
  retention: ["deletion_scheduled", "canceled"],
  deletion_scheduled: ["completed", "canceled"],
  completed: [],
  canceled: [],
};

export async function updateDataSubjectRequest(params: {
  establishmentId: string;
  requestId: string;
  status: string;
  resolutionNotes?: string | null;
}) {
  if (!PRIVACY_REQUEST_STATUSES.has(params.status)) {
    throw new Error("Status de solicitação LGPD inválido.");
  }

  const supabase = getSupabaseAdminClient();
  const patch: Record<string, unknown> = {
    status: params.status,
    resolution_notes: params.resolutionNotes ?? null,
    updated_at: new Date().toISOString(),
  };

  if (params.status === "completed") patch.completed_at = new Date().toISOString();
  if (params.status === "identity_verification") {
    patch.identity_verified_at = null;
  }

  const { data, error } = await supabase
    .from("data_subject_requests")
    .update(patch)
    .eq("id", params.requestId)
    .eq("establishment_id", params.establishmentId)
    .select("id,status")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solicitação LGPD não encontrada para a empresa ativa.");
  return data;
}

export async function verifyDataSubjectIdentity(params: {
  establishmentId: string;
  requestId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("data_subject_requests")
    .update({
      identity_verified_at: new Date().toISOString(),
      status: "in_review",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.requestId)
    .eq("establishment_id", params.establishmentId)
    .select("id,status,identity_verified_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Solicitação LGPD não encontrada para a empresa ativa.");
  return data;
}

export async function updateSecurityIncident(params: {
  establishmentId: string;
  incidentId: string;
  status?: string | null;
  severity?: string | null;
  rootCause?: string | null;
  correctiveActions?: string | null;
  anpdNotificationRequired?: boolean | null;
}) {
  if (params.status && !INCIDENT_STATUSES.has(params.status)) {
    throw new Error("Status de incidente inválido.");
  }
  if (params.severity && !INCIDENT_SEVERITIES.has(params.severity)) {
    throw new Error("Severidade de incidente inválida.");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (params.status) patch.status = params.status;
  if (params.severity) patch.severity = params.severity;
  if (params.rootCause !== undefined) patch.root_cause = params.rootCause;
  if (params.correctiveActions !== undefined) {
    patch.corrective_actions = params.correctiveActions;
  }
  if (params.anpdNotificationRequired !== undefined) {
    patch.anpd_notification_required = params.anpdNotificationRequired;
  }
  if (params.status === "contained") patch.contained_at = now;
  if (params.status === "closed") patch.closed_at = now;
  if (params.status === "triage" || params.status === "investigating") {
    patch.confirmed_at = now;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("security_incidents")
    .update(patch)
    .eq("id", params.incidentId)
    .eq("establishment_id", params.establishmentId)
    .select("id,status,severity,updated_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Incidente não encontrado para a empresa ativa.");
  return data;
}

export async function markIncidentControllerNotified(params: {
  establishmentId: string;
  incidentId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("security_incidents")
    .update({
      controller_notified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.incidentId)
    .eq("establishment_id", params.establishmentId)
    .select("id,controller_notified_at")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Incidente não encontrado para a empresa ativa.");
  return data;
}

export async function transitionTenantOffboarding(params: {
  establishmentId: string;
  offboardingId: string;
  actorUserId: string;
  nextStatus: string;
  note?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase
    .from("tenant_offboarding")
    .select("id,status,export_deadline_at")
    .eq("id", params.offboardingId)
    .eq("establishment_id", params.establishmentId)
    .maybeSingle();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Workflow de encerramento não encontrado.");

  const allowed = OFFBOARDING_TRANSITIONS[String(current.status)] ?? [];
  if (!allowed.includes(params.nextStatus)) {
    throw new Error(
      `Transição de offboarding inválida: ${current.status} -> ${params.nextStatus}.`
    );
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: params.nextStatus,
    updated_at: now,
  };

  if (params.nextStatus === "read_only") patch.read_only_at = now;
  if (params.nextStatus === "export_window" && !current.export_deadline_at) {
    patch.export_deadline_at = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
  }
  if (params.nextStatus === "retention") patch.retention_started_at = now;
  if (params.nextStatus === "deletion_scheduled") {
    patch.deletion_scheduled_at = now;
  }
  if (params.nextStatus === "completed") patch.completed_at = now;
  if (params.nextStatus === "canceled") patch.canceled_at = now;

  const { data: updated, error: updateError } = await supabase
    .from("tenant_offboarding")
    .update(patch)
    .eq("id", params.offboardingId)
    .eq("establishment_id", params.establishmentId)
    .select("id,status,export_deadline_at")
    .single();

  if (updateError) throw new Error(updateError.message);

  const { error: eventError } = await supabase
    .from("tenant_offboarding_events")
    .insert({
      offboarding_id: params.offboardingId,
      establishment_id: params.establishmentId,
      actor_user_id: params.actorUserId,
      from_status: current.status,
      to_status: params.nextStatus,
      note: params.note ?? null,
    });

  if (eventError) throw new Error(eventError.message);
  return updated;
}
