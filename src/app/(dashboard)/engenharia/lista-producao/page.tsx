import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

type ProductionListItem = {
  setor: string;
  produto: string;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeSector(value: string | null | undefined) {
  const setor = String(value ?? "").trim();
  return setor || "Sem setor";
}

function isEmpratamento(value: string | null | undefined) {
  return normalizeText(value) === "empratamento";
}

function isPrePreparo(value: string | null | undefined) {
  const normalized = normalizeText(value);
  return normalized === "pre-preparo" || normalized === "pre preparo";
}

async function getProductionListItems(): Promise<ProductionListItem[]> {
  const supabase = createSupabaseAdminClient();
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = (membership as any)?.establishment_id as string | undefined;

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado para o usuário atual.");
  }

  const { data: sheets, error } = await supabase
    .from("technical_sheets")
    .select(`
      id,
      name,
      category,
      sector,
      linked_product_id,
      ingredients:technical_sheet_ingredients (
        product_id,
        ingredient_name
      )
    `)
    .eq("establishment_id", establishmentId)
    .order("sector", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Erro ao carregar lista de produção:", error);
    throw new Error("Não foi possível carregar a lista de produção.");
  }

  const allSheets = sheets ?? [];
  const prepSheets = allSheets.filter((sheet: any) => isPrePreparo(sheet.category));
  const empratamentoSheets = allSheets.filter((sheet: any) => isEmpratamento(sheet.category));

  const linkedPrepIds = new Set<string>();
  const prepByProductId = new Map<string, string>();
  const prepByName = new Map<string, string>();

  for (const prep of prepSheets) {
    const prepId = String(prep.id ?? "");
    const prepName = String(prep.name ?? "").trim();

    if (!prepId || !prepName) continue;

    const linkedProductId = String(prep.linked_product_id ?? "").trim();
    if (linkedProductId) prepByProductId.set(linkedProductId, prepId);

    prepByName.set(normalizeText(prepName), prepId);
  }

  for (const empratamento of empratamentoSheets) {
    for (const ingredient of empratamento.ingredients ?? []) {
      const productId = String(ingredient?.product_id ?? "").trim();
      const ingredientName = normalizeText(ingredient?.ingredient_name);
      const prepId =
        (productId ? prepByProductId.get(productId) : undefined) ??
        (ingredientName ? prepByName.get(ingredientName) : undefined);

      if (prepId) linkedPrepIds.add(prepId);
    }
  }

  return prepSheets
    .filter((prep: any) => linkedPrepIds.has(String(prep.id)))
    .map((prep: any) => ({
      setor: normalizeSector(prep.sector),
      produto: String(prep.name ?? "").trim(),
    }))
    .filter((item) => item.produto)
    .sort(
      (a, b) =>
        a.setor.localeCompare(b.setor, "pt-BR") ||
        a.produto.localeCompare(b.produto, "pt-BR")
    );
}

export default async function ListaProducaoPage() {
  const items = await getProductionListItems();
  const itemsBySector = items.reduce<Record<string, ProductionListItem[]>>((acc, item) => {
    if (!acc[item.setor]) acc[item.setor] = [];
    acc[item.setor].push(item);
    return acc;
  }, {});
  const sectors = Object.keys(itemsBySector);

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 via-sky-50 to-violet-50 p-4 text-slate-950 md:p-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-white/50 bg-white/70 p-5 shadow-xl shadow-slate-900/10 backdrop-blur-xl md:flex-row md:items-center md:justify-between print:shadow-none">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">
              Engenharia
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Listas de Produção
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Pré-preparos usados em receitas de empratamento, separados por setor. A coluna quantidade fica vazia para preenchimento manual.
            </p>
          </div>

          <Link
            href="/engenharia"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 print:hidden"
          >
            Voltar
          </Link>
        </div>

        {sectors.length === 0 ? (
          <section className="rounded-2xl border border-white/50 bg-white/70 p-8 text-center shadow-lg shadow-slate-900/10 backdrop-blur-xl print:shadow-none">
            <h2 className="text-xl font-black text-slate-950">Nenhum pré-preparo encontrado</h2>
            <p className="mt-2 text-sm text-slate-600">
              Não há pré-preparos vinculados a receitas de empratamento no momento.
            </p>
          </section>
        ) : (
          sectors.map((sector) => (
            <section
              key={sector}
              className="break-inside-avoid rounded-2xl border border-white/50 bg-white/75 p-5 shadow-lg shadow-slate-900/10 backdrop-blur-xl print:border-slate-300 print:bg-white print:shadow-none"
            >
              <h2 className="mb-4 border-b border-slate-200 pb-3 text-2xl font-black uppercase tracking-wide text-slate-950">
                {sector}
              </h2>

              <div className="overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full border-collapse bg-white text-sm">
                  <thead className="bg-slate-100 text-left text-xs uppercase tracking-[0.18em] text-slate-600">
                    <tr>
                      <th className="w-2/3 border-b border-slate-200 px-4 py-3">Produto</th>
                      <th className="w-1/3 border-b border-slate-200 px-4 py-3">Quantidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsBySector[sector].map((item) => (
                      <tr key={`${sector}-${item.produto}`} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-4 py-3 font-semibold text-slate-900">{item.produto}</td>
                        <td className="px-4 py-3 text-slate-400">&nbsp;</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </main>
  );
}
