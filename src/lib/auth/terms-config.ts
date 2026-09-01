export const CURRENT_TERMS_DOCUMENT_SLUG = "/termos-de-uso";
export const CURRENT_TERMS_DOCUMENT_TITLE = "Termos do Serviço";
export const CURRENT_TERMS_DOCUMENT_VERSION = "v1.3";
export const CURRENT_TERMS_UPDATED_AT = "23/04/2026";
export const CURRENT_TERMS_VERSION_ID = "saas-v1.3-2026-04-23";
export const TERMS_REQUIRED_QUERY_VALUE = "required";

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

/**
 * Compatibilidade temporária para consumidores antigos.
 *
 * Compliance não é mais lido de Supabase Auth metadata. A fonte autoritativa é
 * o ledger append-only consultado por `/api/auth/compliance` e pelos guards
 * server-side. Retornar `null` força esses consumidores a consultar o ledger.
 */
export function readTermsComplianceFromMetadata(
  _appMetadata: Record<string, unknown> | null | undefined
): TermsComplianceState | null {
  return null;
}
