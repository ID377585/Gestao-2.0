import "server-only";

export function getRequiredSupabaseServiceRoleKey() {
  // Security baseline: only the canonical modern sb_secret_* credential is
  // accepted. Legacy aliases and JWT-based service_role fallbacks are
  // intentionally unsupported after the incident migration.
  const adminKey = process.env.SUPABASE_SECRET_KEY;

  if (!adminKey) {
    throw new Error(
      "Configuração Supabase admin incompleta. Defina uma SUPABASE_SECRET_KEY moderna apenas em ambiente server-side seguro."
    );
  }

  return adminKey;
}
