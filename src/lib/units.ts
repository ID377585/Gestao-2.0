// src/lib/units.ts
export function normalizeUnitLabel(unit?: string | null) {
  return (unit ?? "").trim().toUpperCase();
}
