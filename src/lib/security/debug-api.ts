import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

function hashSecret(value: string) {
  return createHash("sha256").update(value).digest();
}

function safeSecretEquals(input: string | null, expected: string | null | undefined) {
  const cleanInput = String(input ?? "").trim();
  const cleanExpected = String(expected ?? "").trim();

  if (!cleanInput || !cleanExpected) return false;

  return timingSafeEqual(hashSecret(cleanInput), hashSecret(cleanExpected));
}

async function hasAdminMembership(userId: string) {
  const supabase = await createSupabaseServerClient();

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("[debug-api] memberships admin lookup failed:", {
      code: membershipError.code,
      message: membershipError.message,
    });
    return false;
  }

  if (membership) return true;

  const { data: legacyMembership, error: legacyError } = await supabase
    .from("establishment_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (legacyError) {
    console.error("[debug-api] legacy admin lookup failed:", {
      code: legacyError.code,
      message: legacyError.message,
    });
    return false;
  }

  return Boolean(legacyMembership);
}

export async function requireDebugApiAccess(request: Request) {
  const configuredSecret = process.env.DEBUG_API_SECRET;
  const providedSecret =
    request.headers.get("x-debug-secret") ||
    request.headers.get("x-gestify-debug-secret");

  if (safeSecretEquals(providedSecret, configuredSecret)) {
    return { response: null, supabase: await createSupabaseServerClient() };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      response: NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      ),
      supabase,
    };
  }

  if (!(await hasAdminMembership(user.id))) {
    return {
      response: NextResponse.json({ error: "Sem permissão." }, { status: 403 }),
      supabase,
    };
  }

  return { response: null, supabase };
}
