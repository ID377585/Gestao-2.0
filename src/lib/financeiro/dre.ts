import { listAccountsPayable } from "@/lib/financeiro/accounts-payable";
import { listAccountsReceivable } from "@/lib/financeiro/accounts-receivable";
import type { AccountPayable, AccountReceivable } from "@/types/compras";

export type DreFilters = {
  dateFrom?: string;
  dateTo?: string;
};

export type DreLine = {
  key: string;
  label: string;
  value: number;
};

export type DreSummary = {
  receitaBruta: number;
  deducoesImpostos: number;
  receitaLiquida: number;
  cmv: number;
  lucroBruto: number;
  despesasOperacionais: number;
  ebitda: number;
  resultadoFinanceiro: number;
  impostosResultado: number;
  lucroLiquido: number;
};

export type DreDashboardData = {
  summary: DreSummary;
  lines: DreLine[];
  cards: {
    margemLiquida: number;
    margemBruta: number;
    cmvPercentual: number;
    despesasPercentual: number;
  };
  charts: {
    composicaoDre: { name: string; value: number }[];
    receitasVsDespesas: {
      periodo: string;
      receitas: number;
      despesas: number;
      lucro: number;
    }[];
    despesasPorCategoria: { name: string; value: number }[];
    despesasPorCentroCusto: { name: string; value: number }[];
    topDespesas: { name: string; value: number }[];
  };
};

const DEDUCTION_CATEGORIES = [
  "impostos",
  "taxas",
  "deducoes",
  "devolucao",
  "cancelamento",
];

const FINANCIAL_EXPENSE_CATEGORIES = [
  "juros",
  "tarifas bancarias",
  "multas",
  "encargos financeiros",
];

const TAX_RESULT_CATEGORIES = [
  "irpj",
  "csll",
  "simples nacional",
  "imposto de renda",
  "contribuicao social",
];

const COGS_CATEGORIES = [
  "cmv",
  "mercadoria",
  "insumos",
  "materia prima",
  "embalagens",
  "perdas",
];

function inRange(date: string | undefined, filters: DreFilters) {
  if (!date) return false;
  if (filters.dateFrom && date < filters.dateFrom) return false;
  if (filters.dateTo && date > filters.dateTo) return false;
  return true;
}

function monthKey(date?: string) {
  if (!date) return "Sem data";
  return date.slice(0, 7);
}

function sum(items: number[]) {
  return items.reduce((acc, value) => acc + Number(value || 0), 0);
}

function normalizeText(value: string | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAnyCategory(value: string | undefined, options: string[]) {
  const normalized = normalizeText(value);
  return options.some((item) => normalized.includes(normalizeText(item)));
}

function isReceivableActive(item: AccountReceivable) {
  return item.statusRecebimento !== "cancelado";
}

function isPayableActive(item: AccountPayable) {
  return item.statusPagamento !== "cancelado";
}

export async function getDreDashboardData(
  filters: DreFilters = {}
): Promise<DreDashboardData> {
  const [payables, receivables] = await Promise.all([
    listAccountsPayable(),
    listAccountsReceivable(),
  ]);

  const filteredPayables = payables.filter(
    (item) => isPayableActive(item) && inRange(item.vencimento, filters)
  );

  const filteredReceivables = receivables.filter(
    (item) => isReceivableActive(item) && inRange(item.vencimento, filters)
  );

  const receitaBruta = sum(filteredReceivables.map((item) => Number(item.valor)));

  const deducoesImpostos = sum(
    filteredReceivables
      .filter((item) => includesAnyCategory(item.categoria, DEDUCTION_CATEGORIES))
      .map((item) => Number(item.valor))
  );

  const receitaLiquida = receitaBruta - deducoesImpostos;

  const cmv = sum(
    filteredPayables
      .filter((item) => includesAnyCategory(item.categoria, COGS_CATEGORIES))
      .map((item) => Number(item.valor))
  );

  const lucroBruto = receitaLiquida - cmv;

  const despesasOperacionais = sum(
    filteredPayables
      .filter(
        (item) =>
          !includesAnyCategory(item.categoria, COGS_CATEGORIES) &&
          !includesAnyCategory(item.categoria, FINANCIAL_EXPENSE_CATEGORIES) &&
          !includesAnyCategory(item.categoria, TAX_RESULT_CATEGORIES)
      )
      .map((item) => Number(item.valor))
  );

  const ebitda = lucroBruto - despesasOperacionais;

  const resultadoFinanceiro =
    -sum(
      filteredPayables
        .filter((item) =>
          includesAnyCategory(item.categoria, FINANCIAL_EXPENSE_CATEGORIES)
        )
        .map((item) => Number(item.valor))
    );

  const impostosResultado = sum(
    filteredPayables
      .filter((item) => includesAnyCategory(item.categoria, TAX_RESULT_CATEGORIES))
      .map((item) => Number(item.valor))
  );

  const lucroLiquido = ebitda + resultadoFinanceiro - impostosResultado;

  const byMonth = new Map<
    string,
    { receitas: number; despesas: number; lucro: number }
  >();

  for (const receivable of filteredReceivables) {
    const key = monthKey(receivable.vencimento);
    const current = byMonth.get(key) ?? { receitas: 0, despesas: 0, lucro: 0 };
    current.receitas += Number(receivable.valor || 0);
    byMonth.set(key, current);
  }

  for (const payable of filteredPayables) {
    const key = monthKey(payable.vencimento);
    const current = byMonth.get(key) ?? { receitas: 0, despesas: 0, lucro: 0 };
    current.despesas += Number(payable.valor || 0);
    byMonth.set(key, current);
  }

  const receitasVsDespesas = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, values]) => ({
      periodo,
      receitas: values.receitas,
      despesas: values.despesas,
      lucro: values.receitas - values.despesas,
    }));

  const categoryMap = new Map<string, number>();
  const centerMap = new Map<string, number>();

  for (const payable of filteredPayables) {
    const categoria = payable.categoria || "Sem categoria";
    const centro = payable.centroCusto || "Sem centro de custo";

    categoryMap.set(
      categoria,
      (categoryMap.get(categoria) ?? 0) + Number(payable.valor || 0)
    );
    centerMap.set(
      centro,
      (centerMap.get(centro) ?? 0) + Number(payable.valor || 0)
    );
  }

  const despesasPorCategoria = Array.from(categoryMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const despesasPorCentroCusto = Array.from(centerMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return {
    summary: {
      receitaBruta,
      deducoesImpostos,
      receitaLiquida,
      cmv,
      lucroBruto,
      despesasOperacionais,
      ebitda,
      resultadoFinanceiro,
      impostosResultado,
      lucroLiquido,
    },
    lines: [
      { key: "receitaBruta", label: "Receita Bruta", value: receitaBruta },
      {
        key: "deducoesImpostos",
        label: "(-) Deducoes e impostos",
        value: -deducoesImpostos,
      },
      {
        key: "receitaLiquida",
        label: "Receita Liquida",
        value: receitaLiquida,
      },
      { key: "cmv", label: "(-) CMV / Servicos", value: -cmv },
      { key: "lucroBruto", label: "Lucro Bruto", value: lucroBruto },
      {
        key: "despesasOperacionais",
        label: "(-) Despesas Operacionais",
        value: -despesasOperacionais,
      },
      { key: "ebitda", label: "EBITDA", value: ebitda },
      {
        key: "resultadoFinanceiro",
        label: "Resultado Financeiro",
        value: resultadoFinanceiro,
      },
      {
        key: "impostosResultado",
        label: "(-) Impostos",
        value: -impostosResultado,
      },
      { key: "lucroLiquido", label: "Lucro Liquido", value: lucroLiquido },
    ],
    cards: {
      margemLiquida: receitaLiquida > 0 ? (lucroLiquido / receitaLiquida) * 100 : 0,
      margemBruta: receitaLiquida > 0 ? (lucroBruto / receitaLiquida) * 100 : 0,
      cmvPercentual: receitaLiquida > 0 ? (cmv / receitaLiquida) * 100 : 0,
      despesasPercentual:
        receitaLiquida > 0 ? (despesasOperacionais / receitaLiquida) * 100 : 0,
    },
    charts: {
      composicaoDre: [
        { name: "Receita liquida", value: receitaLiquida },
        { name: "CMV", value: cmv },
        { name: "Despesas operacionais", value: despesasOperacionais },
        { name: "Impostos", value: impostosResultado },
      ],
      receitasVsDespesas,
      despesasPorCategoria,
      despesasPorCentroCusto,
      topDespesas: despesasPorCategoria.slice(0, 8),
    },
  };
}
