export const PRODUCT_SECTOR_CATEGORIES = [
  "Confeitaria",
  "Padaria",
  "Açougue",
  "Produção",
  "Massaria",
  "Burrataria",
  "Secos",
  "Embalagens",
  "Hortifruti",
  "Produto de Limpeza",
  "Descartáveis",
  "Bebidas",
  "Laticínios",
  "Frutos do Mar",
  "Peixaria",
  "Pescados",
  "Carnes",
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

  return (
    err?.code === "23514" &&
    /products_sector_category_check|sector_category/i.test(text)
  );
}
