// src/app/api/inventory-labels/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type InventoryLabelRow = {
  id: string;
  label_code: string;
  qty: number;
  unit_label: string;
  notes: string | null;
  created_at: string;
};

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

function normalizeLabelType(value: any): "MANIPULACAO" | "FABRICANTE" | null {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const cleaned = raw
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
  if (cleaned === "MANIPULACAO" || cleaned === "MANIPULACAO_PADRAO") {
    return "MANIPULACAO";
  }
  if (cleaned === "FABRICANTE" || cleaned === "REVALIDAR") {
    return "FABRICANTE";
  }
  return null;
}

function isMissingTypeColumnError(err: any): boolean {
  const code = String(err?.code ?? "").toUpperCase();
  const msg = String(err?.message ?? "").toLowerCase();
  const details = String(err?.details ?? "").toLowerCase();
  const hint = String(err?.hint ?? "").toLowerCase();
  if (code === "PGRST204" || code === "42703") return true;
  const blob = `${msg} ${details} ${hint}`;
  if (blob.includes("schema cache") && blob.includes("'type'")) return true;
  if (blob.includes("could not find the 'type' column")) return true;
  if (
    blob.includes("column") &&
    blob.includes("type") &&
    blob.includes("does not exist")
  ) return true;
  return false;
}

async function resolveEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ establishmentId: string | null; debug: string[] }> {
  const debug: string[] = [];
  try {
    const helperRes = await getActiveMembershipOrRedirect();
    const membership = (helperRes as any)?.membership ?? helperRes;
    const estId = normalizeId((membership as any)?.establishment_id);
    const orgId = normalizeId((membership as any)?.organization_id);
    const picked = estId ?? orgId ?? null;
    debug.push(
      `membership-helper: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`
    );
    return { establishmentId: picked, debug };
  } catch (e: any) {
    debug.push(`membership-helper: falhou (${e?.message ?? "sem mensagem"})`);
  }
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (userErr) debug.push(`auth.getUser: erro (${userErr.message})`);
  if (!userId) {
    debug.push("auth.getUser: sem userId");
    return { establishmentId: null, debug };
  }
  debug.push(`auth.getUser: ok (user=${userId})`);
  const { data: m, error: mErr } = await supabase
    .from("memberships")
    .select("establishment_id, organization_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (mErr) debug.push(`fallback memberships: erro (${mErr.message})`);
  const estId = normalizeId((m as any)?.establishment_id);
  const orgId = normalizeId((m as any)?.organization_id);
  if (estId ?? orgId) {
    debug.push(
      `fallback memberships: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`
    );
    return { establishmentId: estId ?? orgId ?? null, debug };
  }
  const { data: p, error: pErr } = await supabase
    .from("profiles")
    .select("establishment_id, organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (pErr) debug.push(`fallback profiles: erro (${pErr.message})`);
  const estId2 = normalizeId((p as any)?.establishment_id);
  const orgId2 = normalizeId((p as any)?.organization_id);
  debug.push(
    `fallback profiles: ok (est=${estId2 ?? "null"} org=${orgId2 ?? "null"})`
  );
  return { establishmentId: estId2 ?? orgId2 ?? null, debug };
}

export async function POST(req: Request) {
  return NextResponse.json({ status: "ok", message: "POST ativo na rota" });
}
