import { NextResponse } from "next/server";

import {
  createSupabaseServerClient,
  getSupabaseAdminClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function toStatusCode(result: unknown) {
  if (
    result &&
    typeof result === "object" &&
    "ok" in result &&
    result.ok === true
  ) {
    return 200;
  }

  return 500;
}

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { data: primaryMembership, error: membershipError } = await supabase
      .from("memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (membershipError) {
      console.error("Erro ao validar admin no health check Supabase:", {
        message: membershipError.message,
        code: membershipError.code,
      });
      return NextResponse.json(
        { error: "Erro ao validar permissão." },
        { status: 500 }
      );
    }

    let hasAdminMembership = Boolean(primaryMembership);

    if (!hasAdminMembership) {
      const { data: establishmentMembership, error: establishmentError } =
        await supabase
          .from("establishment_memberships")
          .select("id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();

      if (establishmentError) {
        console.error("Erro ao validar admin no health check Supabase:", {
          message: establishmentError.message,
          code: establishmentError.code,
        });
        return NextResponse.json(
          { error: "Erro ao validar permissão." },
          { status: 500 }
        );
      }

      hasAdminMembership = Boolean(establishmentMembership);
    }

    if (!hasAdminMembership) {
      return NextResponse.json({ error: "Sem permissão." }, { status: 403 });
    }

    const adminSupabase = getSupabaseAdminClient();
    const { data, error } = await adminSupabase.rpc("gestify_contract_check");

    if (error) {
      console.error("Erro ao executar gestify_contract_check:", {
        message: error.message,
        code: error.code,
      });
      return NextResponse.json(
        { ok: false, error: "Falha ao executar contrato Supabase." },
        { status: 500 }
      );
    }

    return NextResponse.json(data, { status: toStatusCode(data) });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro inesperado no contrato Supabase.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
