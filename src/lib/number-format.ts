export function parsePtBrNumber(
  value: unknown,
  fallback: number | null = null
) {
  if (value === null || value === undefined) return fallback;

  const raw = String(value).trim();

  if (!raw) return fallback;

  const cleaned = raw
    .replace(/[^\d,.-]/g, "")
    .replace(/\s/g, "");

  if (!cleaned) return fallback;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");

    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatPtBrDecimal(
  value: unknown,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
) {
  const numberValue =
    typeof value === "number" ? value : parsePtBrNumber(value, null);

  if (numberValue === null) return "";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 3,
  }).format(numberValue);
}