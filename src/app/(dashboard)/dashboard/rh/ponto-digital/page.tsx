import { createSupabaseServerClient } from "@/lib/supabase/server";

import { TimeClockClient } from "./TimeClockClient";
import { getTimeClockSnapshot } from "./actions";

function getDisplayName(user: any) {
  const metadata = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    String(metadata.full_name ?? metadata.name ?? "").trim() ||
    String(user?.email ?? "Usuário").split("@")[0];

  return fullName || "Usuário";
}

export default async function PontoDigitalPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const snapshot = await getTimeClockSnapshot();

  return (
    <TimeClockClient
      initialSnapshot={snapshot}
      userName={getDisplayName(user)}
    />
  );
}
