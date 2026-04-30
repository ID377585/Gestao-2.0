export type ProductOption = {
  id: string;
  name: string;
  sku?: string | null;
  price?: number | null;
  standard_cost?: number | null;
  default_unit_label?: string | null;
  sector_category?: string | null;
  category?: string | null;
  package_qty?: number | null;
  qty_per_package?: string | null;
  allergens?: string[] | string | null;
  alternate_names?: string[] | string | null;
  aliases?: string[] | string | null;
};

export type Ingrediente = {
  id: string;
  productId: string | null;
  nome: string;
  quantidadeUso: number;
  unidadeUso: string;
  precoCompra: number;
  quantidadeCompra: number;
  unidadeCompra: string;
  custoUnitarioBase: number;
  custoIngrediente: number;
  fatorCorrecao: number;
  fatorCoccao: number;
};

export const INGREDIENT_PRODUCT_EQUIVALENCES: Record<string, string[]> = {
  "FARINHA": ["FARINHA DE TRIGO"],
  "FARINHA DE TRIGO ESPECIAL": ["FARINHA DE TRIGO"],
  "ACUCAR": ["ACUCAR REFINADO", "ACUCAR CRISTAL"],
  "AÇUCAR": ["ACUCAR REFINADO", "ACUCAR CRISTAL"],
  "ACUCAR REFINADO": ["ACUCAR REFINADO"],
  "AÇÚCAR REFINADO": ["ACUCAR REFINADO"],
  "ACUCAR CRISTAL": ["ACUCAR CRISTAL"],
  "AÇÚCAR CRISTAL": ["ACUCAR CRISTAL"],
  "CHOCOLATE 50": ["CHOCOLATE MEIO AMARGO"],
  "CHOCOLATE 50%": ["CHOCOLATE MEIO AMARGO"],
  "CHOCOLATE MEIO AMARGO": ["CHOCOLATE MEIO AMARGO"],
  "CREME DE LEITE": ["CREME DE LEITE UHT", "CREME DE LEITE"],
  "LEITE CONDENSADO": ["LEITE CONDENSADO"],
  "MANTEIGA": ["MANTEIGA SEM SAL", "MANTEIGA"],
  "MANTEIGA SEM SAL": ["MANTEIGA SEM SAL"],
  "OVOS": ["OVO", "OVOS"],
  "OVO": ["OVO", "OVOS"],
  "LEITE": ["LEITE INTEGRAL", "LEITE"],
  "LEITE INTEGRAL": ["LEITE INTEGRAL"],
  "CACAU": ["CACAU EM PO", "CACAU 100%", "CACAU"],
  "CACAU EM PO": ["CACAU EM PO", "CACAU 100%"],
  "FERMENTO": ["FERMENTO EM PO", "FERMENTO QUIMICO"],
  "FERMENTO EM PO": ["FERMENTO EM PO", "FERMENTO QUIMICO"],
  "FERMENTO QUIMICO": ["FERMENTO QUIMICO", "FERMENTO EM PO"],
  "OLEO": ["OLEO DE SOJA", "OLEO"],
  "ÓLEO": ["OLEO DE SOJA", "OLEO"],
  "OLEO DE SOJA": ["OLEO DE SOJA"],
  "SAL": ["SAL REFINADO", "SAL"],
  "BAUNILHA": ["ESSENCIA DE BAUNILHA", "BAUNILHA"],
  "ESSENCIA DE BAUNILHA": ["ESSENCIA DE BAUNILHA", "BAUNILHA"],
};

export function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

export function normalizeUnit(value: unknown, fallback = "UN") {
  const unit = String(value ?? "").trim().toUpperCase();
  return unit || fallback;
}

export function normalizeUnitGroup(unit: string) {
  const normalized = normalizeUnit(unit, "UN");

  if (["KG", "G"].includes(normalized)) return "PESO";
  if (["L", "ML"].includes(normalized)) return "VOLUME";
  if (["UN"].includes(normalized)) return "UNIDADE";

  return normalized;
}

export function convertQuantityBetweenUnits(
  quantity: number,
  fromUnit: string,
  toUnit: string
) {
  const safeQuantity = toNumber(quantity, 0);
  const from = normalizeUnit(fromUnit, "UN");
  const to = normalizeUnit(toUnit, "UN");

  if (from === to) return safeQuantity;

  const weightMap: Record<string, number> = {
    KG: 1000,
    G: 1,
  };

  const volumeMap: Record<string, number> = {
    L: 1000,
    ML: 1,
  };

  if (from in weightMap && to in weightMap) {
    const quantityInGrams = safeQuantity * weightMap[from];
    return quantityInGrams / weightMap[to];
  }

  if (from in volumeMap && to in volumeMap) {
    const quantityInMl = safeQuantity * volumeMap[from];
    return quantityInMl / volumeMap[to];
  }

  return safeQuantity;
}

export function calcularCustoIngrediente(input: {
  quantidadeUso: number;
  unidadeUso?: string;
  precoCompra: number;
  quantidadeCompra: number;
  unidadeCompra?: string;
  fatorCorrecao: number;
  fatorCoccao: number;
}) {
  const quantidadeUso = toNumber(input.quantidadeUso, 0);
  const precoCompra = toNumber(input.precoCompra, 0);
  const quantidadeCompra = toNumber(input.quantidadeCompra, 0);
  const unidadeUso = normalizeUnit(input.unidadeUso, "UN");
  const unidadeCompra = normalizeUnit(input.unidadeCompra, "UN");
  const fatorCorrecao = toNumber(input.fatorCorrecao, 1) || 1;
  const fatorCoccao = toNumber(input.fatorCoccao, 1) || 1;

  if (quantidadeCompra <= 0 || quantidadeUso <= 0) {
    return {
      custoUnitarioBase: 0,
      custoIngrediente: 0,
      quantidadeUsoConvertida: quantidadeUso,
    };
  }

  const grupoUso = normalizeUnitGroup(unidadeUso);
  const grupoCompra = normalizeUnitGroup(unidadeCompra);

  const quantidadeUsoConvertida =
    grupoUso === grupoCompra
      ? convertQuantityBetweenUnits(quantidadeUso, unidadeUso, unidadeCompra)
      : quantidadeUso;

  const custoUnitarioBase = precoCompra / quantidadeCompra;
  const custoIngrediente =
    quantidadeUsoConvertida *
    custoUnitarioBase *
    fatorCorrecao *
    fatorCoccao;

  return {
    custoUnitarioBase: Number(custoUnitarioBase.toFixed(6)),
    custoIngrediente: Number(custoIngrediente.toFixed(2)),
    quantidadeUsoConvertida: Number(quantidadeUsoConvertida.toFixed(6)),
  };
}

export function getProductLinkedSnapshot(product?: ProductOption | null) {
  const unidadeBase = normalizeUnit(product?.default_unit_label, "UN");
  const precoBase = toNumber(product?.standard_cost ?? product?.price, 0);
  const quantidadeBase = toNumber(product?.package_qty, 0);

  return {
    unidadeBase,
    precoCompra: precoBase > 0 ? Number(precoBase.toFixed(2)) : 0,
    quantidadeCompra:
      quantidadeBase > 0 ? Number(quantidadeBase.toFixed(3)) : 1,
  };
}

export function syncIngredienteWithProduct(
  ingrediente: Ingrediente,
  product?: ProductOption | null
): Ingrediente {
  if (!product) return ingrediente;

  const snapshot = getProductLinkedSnapshot(product);

  const unidadeUsoFinal =
    normalizeUnitGroup(ingrediente.unidadeUso) ===
    normalizeUnitGroup(snapshot.unidadeBase)
      ? ingrediente.unidadeUso
      : snapshot.unidadeBase;

  const calculo = calcularCustoIngrediente({
    quantidadeUso: ingrediente.quantidadeUso,
    unidadeUso: unidadeUsoFinal,
    precoCompra: snapshot.precoCompra,
    quantidadeCompra: snapshot.quantidadeCompra,
    unidadeCompra: snapshot.unidadeBase,
    fatorCorrecao: ingrediente.fatorCorrecao,
    fatorCoccao: ingrediente.fatorCoccao,
  });

  return {
    ...ingrediente,
    productId: product.id,
    nome: product.name || ingrediente.nome,
    unidadeUso: unidadeUsoFinal,
    precoCompra: snapshot.precoCompra,
    quantidadeCompra: snapshot.quantidadeCompra,
    unidadeCompra: snapshot.unidadeBase,
    custoUnitarioBase: calculo.custoUnitarioBase,
    custoIngrediente: calculo.custoIngrediente,
  };
}

export function normalizeIngredientLookup(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function toAliasList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[;,|]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function buildProductLookupMap(products: ProductOption[]) {
  const map = new Map<string, ProductOption>();

  for (const product of products) {
    const aliases = [
      ...toAliasList(product.alternate_names),
      ...toAliasList(product.aliases),
    ];

    const keys = [
      product.name,
      product.sku,
      `${product.name ?? ""} ${product.sku ?? ""}`.trim(),
      ...aliases,
    ];

    for (const key of keys) {
      const normalized = normalizeIngredientLookup(key);
      if (normalized && !map.has(normalized)) {
        map.set(normalized, product);
      }
    }
  }

  return map;
}

export function findManualEquivalentCandidates(ingredientName: string) {
  const normalized = normalizeIngredientLookup(ingredientName);
  if (!normalized) return [];

  return INGREDIENT_PRODUCT_EQUIVALENCES[normalized] ?? [];
}

export function tokenizeLookup(value: string) {
  return normalizeIngredientLookup(value)
    .split(" ")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function calculateTokenSimilarity(a: string, b: string) {
  const tokensA = tokenizeLookup(a);
  const tokensB = tokenizeLookup(b);

  if (!tokensA.length || !tokensB.length) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...setA, ...setB]).size;
  if (!union) return 0;

  return intersection / union;
}

export function findBestProductFuzzyMatch(
  ingredientName: string,
  products: ProductOption[]
) {
  const normalizedIngredient = normalizeIngredientLookup(ingredientName);
  if (!normalizedIngredient) return null;

  let bestProduct: ProductOption | null = null;
  let bestScore = 0;

  for (const product of products) {
    const candidates = [
      product.name,
      product.sku,
      ...toAliasList(product.alternate_names),
      ...toAliasList(product.aliases),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      const score = calculateTokenSimilarity(normalizedIngredient, candidate);

      if (score > bestScore) {
        bestScore = score;
        bestProduct = product;
      }
    }
  }

  if (bestScore >= 0.5) {
    return bestProduct;
  }

  return null;
}

export function findProductByIngredientName(
  ingredientName: string,
  productLookup: Map<string, ProductOption>,
  products: ProductOption[]
) {
  const normalizedName = normalizeIngredientLookup(ingredientName);
  if (!normalizedName) return null;

  const exact = productLookup.get(normalizedName);
  if (exact) return exact;

  const manualCandidates = findManualEquivalentCandidates(ingredientName);
  for (const candidate of manualCandidates) {
    const normalizedCandidate = normalizeIngredientLookup(candidate);
    const product = productLookup.get(normalizedCandidate);
    if (product) return product;
  }

  for (const [key, product] of productLookup.entries()) {
    if (
      key === normalizedName ||
      key.includes(normalizedName) ||
      normalizedName.includes(key)
    ) {
      return product;
    }
  }

  const fuzzy = findBestProductFuzzyMatch(ingredientName, products);
  if (fuzzy) return fuzzy;

  return null;
}

export function autoLinkIngredienteWithCatalog(
  ingrediente: Ingrediente,
  productsById: Map<string, ProductOption>,
  productLookup: Map<string, ProductOption>,
  products: ProductOption[]
): Ingrediente {
  const linkedProduct =
    (ingrediente.productId
      ? productsById.get(ingrediente.productId) ?? null
      : null) ??
    findProductByIngredientName(ingrediente.nome, productLookup, products);

  if (!linkedProduct) {
    return ingrediente;
  }

  return syncIngredienteWithProduct(ingrediente, linkedProduct);
}