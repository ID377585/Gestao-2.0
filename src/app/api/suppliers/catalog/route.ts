import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { membership } = await getActiveMembershipOrRedirect();

    const establishmentId = (membership as any)?.establishment_id as
      | string
      | undefined;

    if (!establishmentId) {
      return NextResponse.json(
        { error: "Estabelecimento não encontrado." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("suppliers")
      .select("id, name, document, is_active")
      .eq("establishment_id", establishmentId)
      .order("name", { ascending: true });

    if (error) {
      console.error("[GET /api/suppliers/catalog] erro ao listar fornecedores:", error);
      return NextResponse.json(
        { error: "Não foi possível carregar os fornecedores." },
        { status: 500 }
      );
    }

    const normalized = (data ?? [])
      .filter((item: any) => item?.is_active !== false)
      .map((item: any) => ({
        id: String(item.id),
        name: String(item.name ?? ""),
        document: item.document ? String(item.document) : null,
      }));

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("[GET /api/suppliers/catalog] erro inesperado:", error);
    return NextResponse.json(
      { error: "Erro interno ao carregar fornecedores." },
      { status: 500 }
    );
  }
}