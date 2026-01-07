// src/lib/etiquetas/helpers.ts

/* =========================
   TIPOS (compartilhados)
========================= */
export type TipoSel = "MANIPULACAO" | "REVALIDAR";

export interface EtiquetaGerada {
  id: string; // id estável (banco) ou id local
  tipo: TipoSel;
  tamanho: string;
  insumo: string;
  qtd: number;
  umd: string;
  dataManip: string; // ISO yyyy-mm-dd
  dataVenc: string; // ISO yyyy-mm-dd
  loteMan: string;
  responsavel: string;

  alergenico?: string;
  armazenamento?: string;
  ingredientes?: string;

  // fabricante
  dataFabricante?: string;
  dataVencimento?: string;
  sif?: string;
  loteFab?: string;

  localEnvio?: string;
  localArmazenado?: string;

  createdAt: string; // ISO datetime
}

export type LinhaPorcao = { id: string; qtd: string };

export type LinhaErro = {
  baseQtd: boolean;
  porcoes: Record<string, boolean>;
};

/* =========================
   DATAS / TEXTO
========================= */
export const getTodayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const isoToDDMMYY = (iso: string) => {
  if (!iso || iso.length < 10) return "";
  const yyyy = iso.slice(2, 4);
  const mm = iso.slice(5, 7);
  const dd = iso.slice(8, 10);
  return `${dd}${mm}${yyyy}`;
};

export const removeAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const getInsumoCode2 = (nome: string) => {
  const first = (nome || "").trim().split(/\s+/)[0] ?? "";
  const cleaned = removeAccents(first).toUpperCase();
  return cleaned.slice(0, 2) || "XX";
};

/* =========================
   IDs / RANDOM
========================= */
export const gerarSufixoRandomico = (tamanho = 3) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < tamanho; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars[idx];
  }
  return result;
};

export const makeLinhaId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/* =========================
   QR PAYLOAD
========================= */
export const buildQrPayloadFromEtiqueta = (e: EtiquetaGerada) => {
  const payload = {
    v: 1,
    lt: e.loteMan,
    p: e.insumo,
    q: e.qtd,
    u: e.umd,
    dv: e.dataVenc,
  };
  return JSON.stringify(payload);
};

/* =========================
   JSON SAFE
========================= */
export const safeJsonParse = <T,>(s: string): T | null => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};
