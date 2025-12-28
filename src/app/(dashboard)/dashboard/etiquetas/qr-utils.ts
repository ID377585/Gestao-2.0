// src/app/(dashboard)/dashboard/etiquetas/qr-utils.ts

import type { InventoryLabelRow } from "./actions";

export type LabelExtraInfo = {
  productName: string;
  storageLocation?: string | null;
  manufacturingDate?: string | null; // "YYYY-MM-DD"
  expirationDate?: string | null;    // "YYYY-MM-DD"
};

/**
 * Monta o JSON que será gravado DENTRO do QR code.
 * Esse formato precisa ser 100% compatível com o extractLabelCodeFromQr().
 */
export function buildQrPayload(
  label: InventoryLabelRow,
  extra: LabelExtraInfo
): string {
  return JSON.stringify({
    v: 1, // versão do payload (pra futuro)
    lt: label.label_code,              // <= usado por extractLabelCodeFromQr
    pid: (label as any).product_id ?? null,
    q: label.qty,
    u: label.unit_label,
    pn: extra.productName,
    loc: extra.storageLocation ?? null,
    mfg: extra.manufacturingDate ?? null,
    exp: extra.expirationDate ?? null,
  });
}
