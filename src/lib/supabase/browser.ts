import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "./config";

export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabaseKey } = getSupabasePublicEnv();

  return createBrowserClient(supabaseUrl!, supabaseKey!);
}
