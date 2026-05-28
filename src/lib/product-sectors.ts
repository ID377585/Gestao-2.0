export const PRODUCT_SECTOR_CATEGORIES = [
  "Confeitaria",
  "Padaria",
  "Açougue",
  "Produção",
  "Massaria",
  "Burrataria",
  "Peixaria",
  "Bar",
  "Cozinha",
  "Boqueta",
  "Praça Quente",
  "Chapa",
  "Garde",
  "Garde Manger",
  "Fritadeira",
  "Praça Fria",
  "Secos",
  "Embalagens",
  "Hortifruti",
  "Produto de Limpeza",
  "Descartáveis",
  "Bebidas",
  "Laticínios",
  "Frutos do Mar",
  "Pescados",
  "Carnes",
  "Louça",
  "Equipamentos",
  "Utensílios",
  "Ferramentas",
  "Uniformes",
] as const;

export type ProductSectorCategory = (typeof PRODUCT_SECTOR_CATEGORIES)[number];

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const SECTOR_BY_KEY = new Map(
  PRODUCT_SECTOR_CATEGORIES.map((sector) => [normalizeKey(sector), sector]),
);

export function normalizeProductSectorCategory(
  value: unknown,
): ProductSectorCategory | null {
  const key = normalizeKey(value);
  if (!key) return null;

  return SECTOR_BY_KEY.get(key) ?? null;
}

export function isProductSectorConstraintError(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string };
  const text = `${err?.message ?? ""} ${err?.details ?? ""}`;
  const normalizedText = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return (
    err?.code === "23514" &&
    /products_sector_category_check|verificacao_categoria_setor_produ|categoria_setor|sector_category/i.test(
      normalizedText,
    )
  );
}