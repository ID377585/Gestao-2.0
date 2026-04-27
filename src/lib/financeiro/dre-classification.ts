export type DreBucket =
  | "receita_bruta"
  | "deducoes_impostos"
  | "cmv"
  | "despesa_operacional"
  | "resultado_financeiro"
  | "impostos_resultado"
  | "ignorar";

export type DreClassificationRule = {
  key: string;
  label: string;
  bucket: DreBucket;
  match: string[];
};

export const DRE_CLASSIFICATION_RULES: DreClassificationRule[] = [
  {
    key: "receita-impostos",
    label: "Deduções e impostos sobre venda",
    bucket: "deducoes_impostos",
    match: [
      "impostos",
      "taxas",
      "deducoes",
      "deduções",
      "devolucao",
      "devolução",
      "cancelamento",
      "estorno",
      "taxa plataforma",
      "taxa de plataforma",
      "tributos sobre venda",
    ],
  },
  {
    key: "cmv-insumos",
    label: "CMV e insumos",
    bucket: "cmv",
    match: [
      "cmv",
      "mercadoria",
      "insumos",
      "materia prima",
      "matéria prima",
      "embalagens",
      "perdas",
      "custo produto",
      "custo mercadoria",
    ],
  },
  {
    key: "financeiro",
    label: "Resultado financeiro",
    bucket: "resultado_financeiro",
    match: [
      "juros",
      "tarifas bancarias",
      "tarifas bancárias",
      "multas",
      "encargos financeiros",
      "iof",
      "despesa bancaria",
      "despesa bancária",
    ],
  },
  {
    key: "tributacao-resultado",
    label: "Impostos sobre resultado",
    bucket: "impostos_resultado",
    match: [
      "irpj",
      "csll",
      "simples nacional",
      "imposto de renda",
      "contribuicao social",
      "contribuição social",
    ],
  },
];

function normalizeText(value: string | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function classifyDreBucket(value: string | undefined): DreBucket {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "despesa_operacional";
  }

  for (const rule of DRE_CLASSIFICATION_RULES) {
    const matched = rule.match.some((term) =>
      normalized.includes(normalizeText(term))
    );

    if (matched) {
      return rule.bucket;
    }
  }

  return "despesa_operacional";
}