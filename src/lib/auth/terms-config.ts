export const CURRENT_TERMS_DOCUMENT_SLUG = "/termos-de-uso";
export const CURRENT_TERMS_DOCUMENT_TITLE = "Termos do Serviço";
export const CURRENT_TERMS_DOCUMENT_VERSION = "v1.3";
export const CURRENT_TERMS_UPDATED_AT = "23/04/2026";
export const CURRENT_TERMS_VERSION_ID = "saas-v1.3-2026-04-23";
export const TERMS_REQUIRED_QUERY_VALUE = "required";
export const TERMS_COMPLIANCE_METADATA_KEY = "gestify_compliance";

export type TermsComplianceState = {
  current_terms_slug?: string | null;
  current_terms_title?: string | null;
  current_terms_version?: string | null;
  current_terms_accepted_at?: string | null;
  first_access_at?: string | null;
  last_access_at?: string | null;
  first_login_at?: string | null;
  last_login_at?: string | null;
  last_access_path?: string | null;
  last_compliance_event_at?: string | null;
};

export function hasAcceptedCurrentTerms(
  state: TermsComplianceState | null | undefined
) {
  if (!state) return false;

  return Boolean(
    state.current_terms_accepted_at &&
      state.current_terms_version === CURRENT_TERMS_VERSION_ID
  );
}

export function readTermsComplianceFromMetadata(
  appMetadata: Record<string, unknown> | null | undefined
): TermsComplianceState | null {
  const rawValue = appMetadata?.[TERMS_COMPLIANCE_METADATA_KEY];

  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    return null;
  }

  const compliance = rawValue as Record<string, unknown>;

  return {
    current_terms_slug:
      typeof compliance.current_terms_slug === "string"
        ? compliance.current_terms_slug
        : null,
    current_terms_title:
      typeof compliance.current_terms_title === "string"
        ? compliance.current_terms_title
        : null,
    current_terms_version:
      typeof compliance.current_terms_version === "string"
        ? compliance.current_terms_version
        : null,
    current_terms_accepted_at:
      typeof compliance.current_terms_accepted_at === "string"
        ? compliance.current_terms_accepted_at
        : null,
    first_access_at:
      typeof compliance.first_access_at === "string"
        ? compliance.first_access_at
        : null,
    last_access_at:
      typeof compliance.last_access_at === "string"
        ? compliance.last_access_at
        : null,
    first_login_at:
      typeof compliance.first_login_at === "string"
        ? compliance.first_login_at
        : null,
    last_login_at:
      typeof compliance.last_login_at === "string"
        ? compliance.last_login_at
        : null,
    last_access_path:
      typeof compliance.last_access_path === "string"
        ? compliance.last_access_path
        : null,
    last_compliance_event_at:
      typeof compliance.last_compliance_event_at === "string"
        ? compliance.last_compliance_event_at
        : null,
  };
}
