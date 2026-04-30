import type {
  Ingrediente,
  ProductOption,
} from "@/app/dashboard/fichas-tecnicas/lib/ingredient-product-matcher";

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function parseProductAllergens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[;,|]/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
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

    parseProductAllergens(product?.allergens).forEach((allergen) => {
      allergens.add(allergen);
    });
  });

  return allergens.size > 0 ? Array.from(allergens).join(", ") : "Não contém";
}