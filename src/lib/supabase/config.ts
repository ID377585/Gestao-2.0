type SupabasePublicEnv = {
  supabaseUrl?: string;
  supabaseKey?: string;
};

function readPublicSupabaseEnv(): SupabasePublicEnv {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

function getMissingPublicEnvNames(env: SupabasePublicEnv) {
  const missing: string[] = [];

  if (!env.supabaseUrl) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!env.supabaseKey) {
    missing.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY");
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
  const adminKey =
    process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminKey) {
    throw new Error(
      "Configuração Supabase admin incompleta. Defina SUPABASE_SECRET_KEY (preferencial) ou SUPABASE_SERVICE_ROLE_KEY apenas em ambiente server-side seguro."
    );
  }

  return adminKey;
}
