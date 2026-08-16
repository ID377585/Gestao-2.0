type SupabasePublicEnv = {
  supabaseUrl?: string;
  supabaseKey?: string;
};

function readPublicSupabaseEnv(): SupabasePublicEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    // Security baseline: Gestify must use the independently rotatable modern
    // publishable key. Do not fall back to the legacy JWT-based anon key.
    supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

function getMissingPublicEnvNames(env: SupabasePublicEnv) {
  const missing: string[] = [];

  if (!env.supabaseUrl) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!env.supabaseKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return missing;
}

export function getSupabasePublicEnv() {
  return readPublicSupabaseEnv();
}

export function getRequiredSupabasePublicEnv() {
  const env = readPublicSupabaseEnv();
  const missing = getMissingPublicEnvNames(env);

  if (missing.length > 0) {
    throw new Error(
      `Configuração Supabase pública incompleta. Defina: ${missing.join(", ")}.`
    );
  }

  return {
    supabaseUrl: env.supabaseUrl as string,
    supabaseKey: env.supabaseKey as string,
  };
}

export function getRequiredSupabaseServiceRoleKey() {
  // Security baseline: only modern sb_secret_* credentials are accepted.
  // SUPABASE_SERVICE_ROLE_KEY is a legacy JWT-based credential and must never
  // be used as a runtime fallback after the incident migration.
  const adminKey =
    process.env.SUPABASE_SECRET_KEY_PREVIEW ??
    process.env.SUPABASE_SECRET_KEY_NEW ??
    process.env.SUPABASE_SECRET_KEY;

  if (!adminKey) {
    throw new Error(
      "Configuração Supabase admin incompleta. Defina uma SUPABASE_SECRET_KEY moderna apenas em ambiente server-side seguro."
    );
  }

  return adminKey;
}
