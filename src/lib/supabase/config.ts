export class SupabaseEnvError extends Error {
  constructor(message: string, public readonly missingVariables: string[]) {
    super(message);
    this.name = "SupabaseEnvError";
  }
}

export function getSupabasePublicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function getMissingSupabasePublicEnv() {
  const { supabaseUrl, supabaseKey } = getSupabasePublicEnv();
  const missingVariables: string[] = [];

  if (!supabaseUrl) {
    missingVariables.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!supabaseKey) {
    missingVariables.push(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return missingVariables;
}

export function getRequiredSupabasePublicEnv() {
  const { supabaseUrl, supabaseKey } = getSupabasePublicEnv();
  const missingVariables = getMissingSupabasePublicEnv();

  if (missingVariables.length > 0) {
    throw new SupabaseEnvError(
      `Configuração do Supabase incompleta: ${missingVariables.join(", ")}.`,
      missingVariables
    );
  }

  return { supabaseUrl: supabaseUrl!, supabaseKey: supabaseKey! };
}
