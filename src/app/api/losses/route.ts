// src/app/api/losses/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function numOrNull(v: any) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function getAuthAndEstablishment() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      supabase,
      user: null,
      establishment_id: null,
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }

  const { data: membership, error: memErr } = await supabase
    .from("memberships")
    .select("establishment_id")
    .eq("user_id", user.id)
    .single();

  if (memErr || !membership?.establishment_id) {
    return {
      supabase,
      user,
      establishment_id: null,
      error: NextResponse.json(
        { error: "Estabelecimento não encontrado." },
        { status: 400 }
      ),
    };
  }

  return {
    supabase,
    user,
    establishment_id: membership.establishment_id,
    error: null,
  };
}

export async function GET(req: Request) {
  const { supabase, user, error, establishment_id } =
    await getAuthAndEstablishment();
  if (error || !establishment_id) return error!;
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

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

  const { data, error: qErr } = await q;

  if (qErr) {
    console.error("GET /api/losses error:", qErr);
    return NextResponse.json(
      { error: qErr.message ?? "Erro ao carregar histórico de perdas." },
      { status: 500 }
    );
  }

  return NextResponse.json({ losses: data ?? [] });
}

export async function POST(req: Request) {
  const { supabase, user, error, establishment_id } =
    await getAuthAndEstablishment();
  if (error || !establishment_id) return error!;
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await req.json();

  const { product_id, qty, lot, reason, reason_detail, qrcode } = body;
  const unit_label = String(body.unit_label ?? body.unitLabel ?? "UN").trim();

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

  if (!unit_label) {
    return NextResponse.json({ error: "Unidade inválida." }, { status: 400 });
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

  // ✅ IMPORTANTE: PostgREST exige os nomes EXATOS dos parâmetros da função.
  // E como existem 2 overloads no banco, passamos p_user_id para escolher a assinatura correta.
  const { data, error: rpcErr } = await supabase.rpc("register_loss", {
    p_establishment_id: establishment_id,
    p_product_id: product_id,
    p_qty: qtyNumber,
    p_unit_label: unit_label,
    p_reason: reasonTrim,
    p_reason_detail: reasonDetailTrim || null,
    p_lot: lotTrim || null,
    p_label_code: labelCodeTrim || null,
    p_user_id: user.id,
    p_allow_negative: false
  });

  if (rpcErr) {
    console.error("POST /api/losses rpc error:", rpcErr);
    return NextResponse.json(
      { error: rpcErr.message ?? "Erro ao registrar perda." },
      { status: 400 }
    );
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (result == null) {
    return NextResponse.json(
      {
        error:
          "RPC executou sem retorno. Verifique assinatura/retorno da função register_loss.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, result });
}
