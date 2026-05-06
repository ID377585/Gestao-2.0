export const PRODUCT_ABC_CURVES = ["A", "B", "C"] as const;

export type ProductAbcCurve = (typeof PRODUCT_ABC_CURVES)[number];

export function normalizeProductAbcCurve(value: unknown): ProductAbcCurve | null {
  const v = String(value ?? "").trim().toUpperCase();
  if (v === "A" || v === "B" || v === "C") return v;
  return null;
}

export function isProductAbcConstraintError(error: unknown) {
  const err = error as { code?: string; message?: string; details?: string };
  const text = `${err?.message ?? ""} ${err?.details ?? ""}`;
  return (
    err?.code === "23514" &&
    /abc_curve|products_abc_curve_check/i.test(text)
  );
}