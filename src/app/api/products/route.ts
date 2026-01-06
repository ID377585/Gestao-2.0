import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export type ProductOption = {
  id: string;
  name: string;
  unit: string | null;
  category: string | null;
};

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { membership } = await getActiveMembershipOrRedirect();

    const establishmentId = (membership as any).establishment_id;

    if (!establishmentId) {
      return NextResponse.json(
        { error: "Estabelecimento não encontrado no membership." },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("products")
      .select("id, name, unit, category")
      .eq("establishment_id", establishmentId)
      .order("name", { ascending: true });

    if (error) {
      console.error("Erro ao listar produtos (products):", error);
      return NextResponse.json(
        { error: "Erro ao carregar produtos do banco." },
        { status: 500 }
      );
    }

    const mapped: ProductOption[] = (data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      unit: p.unit ?? null,
      category: p.category ?? null,
    }));

    return NextResponse.json(mapped, { status: 200 });
  } catch (e: any) {
    console.error("Erro em GET /api/products:", e);
    return NextResponse.json(
      { error: e?.message ?? "Erro inesperado ao carregar produtos." },
      { status: 500 }
    );
  }
}
