import type {
  Ingrediente,
  ProductOption,
} from "@/app/dashboard/fichas-tecnicas/lib/ingredient-product-matcher";

function normalizeAllergenText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function detectAllergens(
  ingredients: Ingrediente[],
  products: ProductOption[] = []
) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const allergens = new Set<string>();

  ingredients.forEach((ingredient) => {
    const product = ingredient.productId
      ? productMap.get(ingredient.productId)
      : null;

    const text = normalizeAllergenText(
      [
        ingredient.nome,
        product?.name,
        product?.category,
        product?.sector_category,
        product?.sku,
        product?.alternate_names,
        product?.aliases,
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (
      text.includes("leite") ||
      text.includes("creme de leite") ||
      text.includes("cream cheese") ||
      text.includes("manteiga") ||
      text.includes("iogurte") ||
      text.includes("laticinio") ||
      text.includes("laticinios")
    ) {
      allergens.add("Lactose");
    }

    if (text.includes("ovo")) {
      allergens.add("Ovos");
    }

    if (
      text.includes("amendoim") ||
      text.includes("castanha") ||
      text.includes("caju") ||
      text.includes("para") ||
      text.includes("nozes") ||
      text.includes("avela") ||
      text.includes("pistache") ||
      text.includes("amendoa")
    ) {
      allergens.add("Castanhas");
    }

    if (
      text.includes("camarao") ||
      text.includes("ostra") ||
      text.includes("mexilhao") ||
      text.includes("vongole") ||
      text.includes("vieira") ||
      text.includes("frutos do mar")
    ) {
      allergens.add("Frutos do Mar");
    }

    if (
      text.includes("farinha de trigo") ||
      text.includes("trigo") ||
      text.includes("gluten")
    ) {
      allergens.add("Glúten");
    }

    if (text.includes("acucar")) {
      allergens.add("Açúcar");
    }
  });

  return Array.from(allergens).join(", ");
}