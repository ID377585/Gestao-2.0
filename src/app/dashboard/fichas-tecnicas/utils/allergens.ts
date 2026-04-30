import type {
  Ingrediente,
  ProductOption,
} from "@/app/dashboard/fichas-tecnicas/lib/ingredient-product-matcher";
import {
  ALLERGEN_OPTIONS,
  normalizeAllergenList,
} from "@/lib/allergens";

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function findLinkedProduct(
  ingredient: Ingrediente,
  products: ProductOption[]
): ProductOption | null {
  if (!products.length) return null;

  if (ingredient.productId) {
    const byId = products.find(
      (product) => String(product.id) === String(ingredient.productId)
    );

    if (byId) return byId;
  }

  const ingredientName = normalizeText(ingredient.nome);

  if (!ingredientName) return null;

  return (
    products.find((product) => normalizeText(product.name) === ingredientName) ??
    null
  );
}

export function detectAllergens(
  ingredients: Ingrediente[],
  products: ProductOption[] = []
) {
  const allergens = new Set<string>();

  ingredients.forEach((ingredient) => {
    const product = findLinkedProduct(ingredient, products);

    normalizeAllergenList(product?.allergens).forEach((allergen) => {
      allergens.add(allergen);
    });
  });

  const ordered = ALLERGEN_OPTIONS.filter((allergen) =>
    allergens.has(allergen)
  );

  return ordered.length > 0 ? ordered.join(", ") : "Não contém";
}
