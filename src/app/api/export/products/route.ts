// src/app/api/export/products/route.ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Escapa campo para CSV usando ; como separador.
 */
function csvField(value: any): string {
  if (value === null || value === undefined) return "";
  let text = String(value);

  if (/[;"\r\n]/.test(text)) {
    text = text.replace(/"/g, '""');
    return `"${text}"`;
  }

  return text;
}

/**
 * Formata números pt-BR
 */
function formatNumber(value: number | null | undefined, decimals: number) {
  if (value === null || value === undefined) return "";
  if (Number.isNaN(value)) return "";
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Tipagem explícita do retorno do export (evita GenericStringError)
 */
type ProductExportRow = {
  id: string | null;
  establishment_id: string | null;
  sku: string | null;
  name: string | null;
  product_type: string | null;
  default_unit_label: string | null;
  package_qty: number | string | null;
  qty_per_package: string | null;
  category: string | null;

  // ✅ NOVA COLUNA (SETOR)
  sector_category: string | null;

  price: number | string | null;
  conversion_factor: number | string | null;
  is_active: boolean | null;
};

function normalizeId(value: any): string | null {
  if (!value) return null;
  const v = String(value).trim();
  if (!v || v.toLowerCase() === "undefined" || v.toLowerCase() === "null") {
    return null;
  }
  return v;
}

/**
 * ✅ Resolve establishment_id com múltiplas estratégias
 * 1) getActiveMembershipOrRedirect (padrão do seu app)
 * 2) fallback: memberships
 * 3) fallback: profiles
 */
async function resolveEstablishmentId(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<{ establishmentId: string | null; debug: string[] }> {
  const debug: string[] = [];

  // 1) tenta pelo helper do app (o mais compatível com seu projeto)
  try {
    const { membership } = await getActiveMembershipOrRedirect();
    const estId = normalizeId((membership as any)?.establishment_id);
    const orgId = normalizeId((membership as any)?.organization_id);
    const picked = estId ?? orgId ?? null;

    debug.push(
      `membership-helper: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`,
    );
    if (picked) return { establishmentId: picked, debug };

    debug.push("membership-helper: sem establishment/org no membership");
  } catch (e: any) {
    debug.push(`membership-helper: falhou (${e?.message ?? "sem mensagem"})`);
  }

  // 2) fallback: auth.getUser + memberships (se existir)
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      debug.push("auth.getUser: falhou/sem user");
      return { establishmentId: null, debug };
    }

    const userId = userData.user.id;
    debug.push(`auth.getUser: ok (user=${userId})`);

    // memberships
    try {
      const { data: m, error: mErr } = await supabase
        .from("memberships")
        .select("establishment_id, organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (mErr) {
        debug.push(`fallback memberships: erro (${mErr.message})`);
      } else {
        const estId = normalizeId((m as any)?.establishment_id);
        const orgId = normalizeId((m as any)?.organization_id);
        const picked = estId ?? orgId ?? null;

        debug.push(
          `fallback memberships: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`,
        );
        if (picked) return { establishmentId: picked, debug };
      }
    } catch (e: any) {
      debug.push(`fallback memberships: exceção (${e?.message ?? "sem mensagem"})`);
    }

    // profiles (muitos projetos guardam establishment_id aqui)
    try {
      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("establishment_id, organization_id")
        .eq("id", userId)
        .maybeSingle();

      if (pErr) {
        debug.push(`fallback profiles: erro (${pErr.message})`);
      } else {
        const estId = normalizeId((p as any)?.establishment_id);
        const orgId = normalizeId((p as any)?.organization_id);
        const picked = estId ?? orgId ?? null;

        debug.push(
          `fallback profiles: ok (est=${estId ?? "null"} org=${orgId ?? "null"})`,
        );
        if (picked) return { establishmentId: picked, debug };
      }
    } catch (e: any) {
      debug.push(`fallback profiles: exceção (${e?.message ?? "sem mensagem"})`);
    }

    return { establishmentId: null, debug };
  } catch (e: any) {
    debug.push(`auth+fallback: exceção geral (${e?.message ?? "sem mensagem"})`);
    return { establishmentId: null, debug };
  }
}

export async function GET(_request: Request) {
  try {
    const supabase = await createSupabaseServerClient();

    const { establishmentId, debug } = await resolveEstablishmentId(supabase);

    if (!establishmentId) {
      // ✅ mensagem clara + debug no console
      console.error("Export products: establishmentId não resolvido", debug);
      return NextResponse.json(
        {
          error:
            "Não foi possível identificar o estabelecimento do usuário. Verifique a tabela de vínculo (membership/profiles) e as policies (RLS).",
        },
        { status: 403 },
      );
    }

    // Campos que queremos exportar
    const selectFields = [
      "id",
      "establishment_id",
      "sku",
      "name",
      "product_type",
      "default_unit_label",
      "package_qty",
      "qty_per_package",
      "category",

      // ✅ NOVA COLUNA (SETOR)
      "sector_category",

      "price",
      "conversion_factor",
      "is_active",
    ].join(", ");

    const query = supabase
      .from("products")
      .select(selectFields)
      .eq("establishment_id", establishmentId);

    // ✅ Cast controlado: evita GenericStringError derrubar build
    const { data, error } = await (query as any);

    if (error) {
      console.error("Erro ao exportar produtos:", error);
      return NextResponse.json(
        { error: "Erro ao exportar produtos." },
        { status: 500 },
      );
    }

    const products = (Array.isArray(data) ? data : []) as ProductExportRow[];

    const header = [
      "id",
      "sku",
      "name",
      "product_type",
      "default_unit_label",
      "package_qty",
      "qty_per_package",
      "category",

      // ✅ NOVA COLUNA (SETOR)
      "sector_category",

      "price",
      "conversion_factor",
      "is_active",
    ];

    const rows: string[] = [];
    rows.push(header.join(";"));

    for (const p of products) {
      if (!p) continue;

      let packageQtyFormatted = "";
      if (p.package_qty !== null && p.package_qty !== undefined) {
        const n = Number(p.package_qty);
        packageQtyFormatted = !Number.isNaN(n) ? formatNumber(n, 3) : "";
      }

      const qtyPerPackageText =
        p.qty_per_package !== null && p.qty_per_package !== undefined
          ? String(p.qty_per_package)
          : "";

      let priceFormatted = "";
      if (p.price !== null && p.price !== undefined) {
        const n = Number(p.price);
        priceFormatted = !Number.isNaN(n) ? formatNumber(n, 2) : "";
      }

      let conversionFormatted = "";
      if (p.conversion_factor !== null && p.conversion_factor !== undefined) {
        const n = Number(p.conversion_factor);
        conversionFormatted = !Number.isNaN(n) ? formatNumber(n, 4) : "";
      }

      const sectorCategoryText =
        p.sector_category !== null && p.sector_category !== undefined
          ? String(p.sector_category)
          : "";

      const row = [
        csvField(p.id ?? ""),
        csvField(p.sku ?? ""),
        csvField(p.name ?? ""),
        csvField(p.product_type ?? ""),
        csvField(p.default_unit_label ?? ""),
        csvField(packageQtyFormatted),
        csvField(qtyPerPackageText),
        csvField(p.category ?? ""),

        // ✅ NOVA COLUNA (SETOR)
        csvField(sectorCategoryText),

        csvField(priceFormatted),
        csvField(conversionFormatted),
        csvField(p.is_active ? 1 : 0),
      ];

      rows.push(row.join(";"));
    }

    const csvContent = "\uFEFF" + rows.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="produtos.csv"',
      },
    });
  } catch (err) {
    console.error("Erro inesperado em export produtos:", err);
    return NextResponse.json(
      { error: "Erro inesperado ao exportar produtos." },
      { status: 500 },
    );
  }
}
