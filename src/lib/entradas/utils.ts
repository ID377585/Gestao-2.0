export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeText(value?: string): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.replace(',', '.');
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function generateSkuFromName(nome: string): string {
  const base = normalizeText(nome)
    .toUpperCase()
    .replace(/\s+/g, '-')
    .slice(0, 20);

  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${base}-${rand}`;
}