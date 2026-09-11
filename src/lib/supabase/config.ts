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

  if (!env.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!env.supabaseKey) missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

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
