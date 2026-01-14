export function formatQty3(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0.000";

  // corrige ruído de floating point e arredonda para 3 casas
  const rounded = Math.round((n + Number.EPSILON) * 1000) / 1000;

  // sempre 3 casas
  return rounded.toFixed(3);
}
