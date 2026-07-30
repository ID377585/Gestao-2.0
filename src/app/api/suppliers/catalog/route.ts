import { NextResponse } from "next/server";
import { privateCacheHeaders } from "@/lib/cache/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentTenant } from "@/lib/tenant/get-current-tenant";
import { rateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const limited = rateLimit(request, {
      key: "api:suppliers:catalog",
      limit: 90,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const tenant = await getCurrentTenant();

    if (!tenant?.establishmentId) {
      return NextResponse.json(
        { error: "Empresa ativa não encontrada." },
        { status: 403 }
      );
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("suppliers")
      .select("id, razao_social, nome_fantasia, cnpj, ativo")
      .eq("establishment_id", tenant.establishmentId)
      .order("razao_social", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const normalized = (data ?? [])
      .map((supplier: any) => {
        const name = String(
          supplier.razao_social ??
            supplier.nome_fantasia ??
            ""
        ).trim();

        return {
          id: String(supplier.id ?? ""),
          name,
          document: supplier.cnpj ? String(supplier.cnpj) : null,
          active: supplier.ativo ?? true,
        };
      })
      .filter((supplier) => supplier.id && supplier.name)
      .filter((supplier) => supplier.active !== false)
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return NextResponse.json(normalized, {
      headers: privateCacheHeaders(60),
    });
  } catch (error) {
    console.error(
      "[GET /api/suppliers/catalog] erro ao carregar fornecedores:",
      error
    );

    return NextResponse.json(
      { error: "Não foi possível carregar os fornecedores." },
      { status: 500 }
    );
  }
}
