import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export type Membership = {
  establishment_id: string;
  role: string;
};

export async function getActiveMembershipOrRedirect(): Promise<Membership> {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) redirect("/login");

  const { data: membership, error } = await supabase
    .from("establishment_memberships")
    .select("establishment_id, role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (error || !membership) redirect("/sem-acesso");

  return membership;
}
