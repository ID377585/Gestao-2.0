import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function numOrNull(v: any) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  // Establishment do usuário
  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("establishment_id")
    .eq("user_id", user.id)
    .single();

  if (memErr || !membership?.establishment_id) {
    return NextResponse.json(
      { error: "Estabelecimento não encontrado." },
      { status: 400 }
    );
  }

  const establishment_id = membership.establishment_id;

  // Filtros opcionais via querystring
  const url = new URL(req.url);
  const product_id = url.searchParams.get("product_id");
  const reason = url.searchParams.get("reason");
  const date_from = url.searchParams.get("date_from");
  const date_to = url.searchParams.get("date_to");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 100), 500);

  let q = supabase
    .from("losses")
    .select("*")
    .eq("establishment_id", establishment_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (product_id) q = q.eq("product_id", product_id);
  if (reason) q = q.eq("reason", reason);
  if (date_from) q = q.gte("created_at", date_from);
  if (date_to) q = q.lte("created_at", date_to);

  const { data, error } = await q;

  if (error) {
    // ✅ AJUSTE: devolver a mensagem real do Supabase (ajuda demais em RLS/policy)
    console.error("GET /api/losses error:", error);
    return NextResponse.json(
      { error: error.message ?? "Erro ao carregar histórico de perdas." },
      { status: 500 }
    );
  }

  return NextResponse.json({ losses: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const body = await req.json();

  const { product_id, qty, lot, reason, reason_detail, qrcode } = body;

  if (!product_id || qty == null || !reason) {
    return NextResponse.json(
      { error: "Dados obrigatórios não informados." },
      { status: 400 }
    );
  }

  const qtyNumber = numOrNull(qty);
  if (!qtyNumber || qtyNumber <= 0) {
    return NextResponse.json({ error: "Quantidade inválida." }, { status: 400 });
  }

  const reasonTrim = String(reason).trim();
  const reasonDetailTrim = String(reason_detail ?? "").trim();
  const lotTrim = String(lot ?? "").trim();
  const labelCodeTrim = String(qrcode ?? "").trim();

  if (reasonTrim === "Outro" && reasonDetailTrim.length < 3) {
    return NextResponse.json(
      { error: "Descreva o motivo (Outro)." },
      { status: 400 }
    );
  }

  // ✅ CHAMADA TRANSACIONAL (RPC no Supabase)
  const { data, error } = await supabase.rpc("register_loss", {
    p_product_id: product_id,
    p_qty: qtyNumber,
    p_reason: reasonTrim,
    p_reason_detail: reasonDetailTrim || null,
    p_lot: lotTrim || null,
    // Aqui mandamos o label_code (da inventory_labels) via campo qrcode do front
    p_label_code: labelCodeTrim || null,
  });

  if (error) {
    // Mensagem vem do raise exception do Postgres (RPC)
    console.error("POST /api/losses rpc error:", error);
    return NextResponse.json(
      { error: error.message ?? "Erro ao registrar perda." },
      { status: 400 }
    );
  }

  // Retorno da RPC é TABLE -> vem como array com 1 linha
  const result = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({ success: true, result });
}
