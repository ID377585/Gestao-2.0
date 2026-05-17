import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "./config";

export const createClient = () => {
  const { supabaseUrl, supabaseKey } = getSupabasePublicEnv();

  if (!supabaseUrl || !supabaseKey) {
    console.warn(
      "[supabase/client] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createBrowserClient(supabaseUrl!, supabaseKey!);
};

export const supabase = createClient();
