import "server-only";

import { headers } from "next/headers";

import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const DPA_VERSION_ID = "dpa-v2.0-2026-09-09";

function normalizeIp(raw: string | null) {
  const value = raw?.split(",")[0]?.trim() || null;
  return value === "::1" ? "127.0.0.1" : value;
}

export async function listLegalDocuments() {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("legal_document_versions")
    .select(
      "document_type,version_id,version_label,title,slug,status,effective_at,published_at,requires_acceptance,requires_reacceptance,metadata"
    )
    .eq("status", "published")
    .order("document_type")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listLegalAcceptances(params: {
  userId: string;
  establishmentId: string;
}) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("legal_acceptances")
    .select(
      "document_type,document_version_id,accepted_at,accepted_source,representative_authority"
    )
    .eq("user_id", params.userId)
    .eq("establishment_id", params.establishmentId)
    .order("accepted_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function acceptLegalDocument(params: {
  userId: string;
  establishmentId: string;
  versionId: string;
  source: string;
  path?: string | null;
  representativeAuthority?: boolean;
}) {
  const supabase = getSupabaseAdminClient();
  const { data: document, error: documentError } = await supabase
    .from("legal_document_versions")
    .select("document_type,version_id,status,requires_acceptance")
    .eq("version_id", params.versionId)
    .maybeSingle();

  if (documentError) throw new Error(documentError.message);
  if (!document || document.status !== "published") {
    throw new Error("Documento jurídico não está publicado para aceite.");
  }

  const headerStore = await headers();
  const { error } = await supabase.from("legal_acceptances").insert({
    user_id: params.userId,
    establishment_id: params.establishmentId,
    document_type: document.document_type,
    document_version_id: document.version_id,
    accepted_source: params.source,
    accepted_from_path: params.path ?? null,
    ip_address: normalizeIp(
      headerStore.get("x-forwarded-for") || headerStore.get("x-real-ip")
    ),
    user_agent: headerStore.get("user-agent"),
    representative_authority: Boolean(params.representativeAuthority),
  });

  if (error && error.code !== "23505") throw new Error(error.message);
}

export async function getEstablishmentEntitlement(establishmentId: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("establishment_entitlements")
    .select("*")
    .eq("establishment_id", establishmentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

export async function assertAutomaticBillingAllowed(establishmentId: string) {
  const entitlement = await getEstablishmentEntitlement(establishmentId);
  if (entitlement && entitlement.automatic_billing_allowed === false) {
    throw new Error(
      "Cobrança automática bloqueada por condição contratual deste estabelecimento."
    );
  }
  return entitlement;
}

export async function listPrivacyOperations(establishmentId: string) {
  const supabase = getSupabaseAdminClient();
  const [requests, incidents, offboarding, subprocessors, retention] = await Promise.all([
    supabase
      .from("data_subject_requests")
      .select("id,request_type,status,subject_name,created_at,due_at,completed_at")
      .eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("security_incidents")
      .select("id,title,severity,status,detected_at,contained_at,closed_at")
      .eq("establishment_id", establishmentId)
      .order("detected_at", { ascending: false })
      .limit(20),
    supabase
      .from("tenant_offboarding")
      .select("id,status,requested_at,export_deadline_at,completed_at,canceled_at")
      .eq("establishment_id", establishmentId)
      .order("requested_at", { ascending: false })
      .limit(10),
    supabase
      .from("subprocessors")
      .select("provider,service_category,purpose,status,international_transfer,dpa_status")
      .order("provider"),
    supabase
      .from("data_retention_policies")
      .select("category,rule_text,retention_days,terminal_action,automation_enabled")
      .order("category"),
  ]);

  for (const result of [requests, incidents, offboarding, subprocessors, retention]) {
    if (result.error) throw new Error(result.error.message);
  }

  return {
    requests: requests.data ?? [],
    incidents: incidents.data ?? [],
    offboarding: offboarding.data ?? [],
    subprocessors: subprocessors.data ?? [],
    retention: retention.data ?? [],
  };
}

export async function createDataSubjectRequest(params: {
  establishmentId: string;
  userId: string;
  requestType: string;
  subjectName?: string | null;
  subjectContact?: string | null;
  description?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("data_subject_requests").insert({
    establishment_id: params.establishmentId,
    requested_by_user_id: params.userId,
    request_type: params.requestType,
    subject_name: params.subjectName ?? null,
    subject_contact: params.subjectContact ?? null,
    description: params.description ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function createSecurityIncident(params: {
  establishmentId: string;
  userId: string;
  title: string;
  description?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("security_incidents").insert({
    establishment_id: params.establishmentId,
    reported_by_user_id: params.userId,
    title: params.title,
    description: params.description ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function requestTenantOffboarding(params: {
  establishmentId: string;
  userId: string;
  reason?: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  const exportDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("tenant_offboarding")
    .insert({
      establishment_id: params.establishmentId,
      requested_by_user_id: params.userId,
      status: "requested",
      reason: params.reason ?? null,
      export_deadline_at: exportDeadline,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  const { error: eventError } = await supabase.from("tenant_offboarding_events").insert({
    offboarding_id: data.id,
    establishment_id: params.establishmentId,
    actor_user_id: params.userId,
    from_status: null,
    to_status: "requested",
    note: params.reason ?? "Solicitação de encerramento registrada.",
  });
  if (eventError) throw new Error(eventError.message);
}
