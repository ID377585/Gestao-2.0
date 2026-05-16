import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/get-membership";

const LOSS_REASONS = new Set([
  "Fora do padrão",
  "Vencido",
  "Estragado",
  "Avaria / Quebra",
  "Testes",
  "Enviado para análise",
  "Foto Marketing",
  "Teste Empratamento",
  "Comida de Funcionário",
  "Outro",
]);

function numOrNull(v: any) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeUnit(v: any) {
  return String(v ?? "UN").trim().replace(/\s+/g, "").toUpperCase();
}

function normalizeDateTo(v: string | null) {
  if (!v) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T23:59:59.999Z` : v;
}

async function getAuthAndEstablishment() {
  const supabase = createSupabaseServerClient();
  const { user, membership } = await getActiveMembership();

  if (!user) {
    return {
      supabase,
      user: null,
      establishment_id: null,
      error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }),
    };
  }

  if (!membership?.establishment_id) {
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
  const { supabase, user, error, establishment_id } = await getAuthAndEstablishment();
  if (error || !establishment_id) return error!;
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const url = new URL(req.url);
  const product_id = url.searchParams.get("product_id")?.trim();
  const reason = url.searchParams.get("reason")?.trim();
  const date_from = url.searchParams.get("date_from")?.trim();
  const date_to = normalizeDateTo(url.searchParams.get("date_to"));
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 500);

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
  const { supabase, user, error, establishment_id } = await getAuthAndEstablishment();
  if (error || !establishment_id) return error!;
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const body = await req.json();
  const product_id = String(body.product_id ?? "").trim();
  const qtyNumber = numOrNull(body.qty);
  const reasonTrim = String(body.reason ?? "").trim();
  const reasonDetailTrim = String(body.reason_detail ?? "").trim();
  const lotTrim = String(body.lot ?? "").trim();
  const labelCodeTrim = String(body.qrcode ?? "").trim();

  if (!product_id || qtyNumber == null || !reasonTrim) {
    return NextResponse.json(
      { error: "Informe produto, quantidade e motivo." },
      { status: 400 }
    );
  }

  if (qtyNumber <= 0) {
    return NextResponse.json({ error: "Quantidade deve ser maior que zero." }, { status: 400 });
  }

  if (!LOSS_REASONS.has(reasonTrim)) {
    return NextResponse.json({ error: "Motivo de perda inválido." }, { status: 400 });
  }

  if (reasonTrim === "Outro" && reasonDetailTrim.length < 3) {
    return NextResponse.json(
      { error: "Descreva o motivo quando selecionar Outro." },
      { status: 400 }
    );
  }

  const { data: product, error: productErr } = await supabase
    .from("products")
    .select("id, default_unit_label, is_active")
    .eq("id", product_id)
    .eq("establishment_id", establishment_id)
    .maybeSingle();

  if (productErr) {
    console.error("POST /api/losses product error:", productErr);
    return NextResponse.json({ error: "Erro ao validar produto." }, { status: 500 });
  }

  if (!product || product.is_active === false) {
    return NextResponse.json(
      { error: "Produto não encontrado ou inativo para este estabelecimento." },
      { status: 404 }
    );
  }

  const unit_label = normalizeUnit(product.default_unit_label ?? body.unit_label ?? body.unitLabel ?? "UN");

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
    p_allow_negative: false,
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
      { error: "A perda foi processada, mas a função register_loss não retornou dados." },
      { status: 400 }
    );
  }

  return NextResponse.json({ success: true, result });
}
