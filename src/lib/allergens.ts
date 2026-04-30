export const ALLERGEN_OPTIONS = [
  "Açúcar",
  "Glúten",
  "Lactose",
  "Castanhas",
  "Frutos do Mar",
] as const;

export type AllergenOption = (typeof ALLERGEN_OPTIONS)[number];

function collectAllergenItems(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectAllergenItems(item));
  }

  if (typeof value === "string") {
    return splitAllergenText(value);
  }

  return [value];
}

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALLERGEN_BY_KEY = new Map(
  ALLERGEN_OPTIONS.map((option) => [normalizeKey(option), option]),
);

function splitAllergenText(value: string): unknown[] {
  const trimmed = value.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }

  const postgresArray =
    trimmed.startsWith("{") && trimmed.endsWith("}")
      ? trimmed.slice(1, -1)
      : trimmed;

  return postgresArray
    .split(/[;,|]/g)
    .map((item) => item.replace(/^"|"$/g, "").trim())
    .filter(Boolean);
}

export function normalizeAllergenList(value: unknown): AllergenOption[] {
  const rawItems = collectAllergenItems(value).filter(Boolean);

  const selected = new Set<AllergenOption>();

  for (const raw of rawItems) {
    const canonical = ALLERGEN_BY_KEY.get(normalizeKey(raw));
    if (canonical) selected.add(canonical);
  }

  return ALLERGEN_OPTIONS.filter((option) => selected.has(option));
}

export function formatAllergenList(value: unknown, emptyLabel = "Não contém") {
  const allergens = normalizeAllergenList(value);
  return allergens.length > 0 ? allergens.join(", ") : emptyLabel;
}
