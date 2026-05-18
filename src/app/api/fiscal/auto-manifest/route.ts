import { NextRequest, NextResponse } from "next/server";
import { isFiscalCronAuthorized } from "@/lib/fiscal/cron-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getAdminSupabase() {
  return getSupabaseAdminClient();
}

function isAuthorized(request: NextRequest) {
  return isFiscalCronAuthorized(request, "/api/fiscal/auto-manifest");
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = getAdminSupabase();
  const establishmentId = request.nextUrl.searchParams.get("establishment_id");

  let query = supabase
    .from("fiscal_nfe_inbox")
    .select("id, establishment_id, chave_acesso, status_manifestacao, imported_entry_id, updated_at")
    .in("status_manifestacao", ["resumo_disponivel", "pendente"])
    .is("imported_entry_id", null)
    .order("updated_at", { ascending: true })
    .limit(20);

  if (establishmentId) {
    query = query.eq("establishment_id", establishmentId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "Fila de manifestação automática preparada. O envio real será conectado na próxima etapa segura.",
    queued: data?.length ?? 0,
    notes: data ?? [],
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
