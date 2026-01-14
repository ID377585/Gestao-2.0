// src/lib/etiquetas/print.ts
import QRCode from "qrcode";
import type { EtiquetaGerada } from "./helpers";
import { buildQrPayloadFromEtiqueta } from "./helpers";

type PrintOptions = {
  labelWidthMm?: number; // default 104
  labelHeightMm?: number; // default 50.8
};

const formatDateBR = (dateString: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("pt-BR");
};

const makeQrDataUrl = async (text: string) => {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 0,
    // ✅ QR maior e mais nítido (a dimensão final é dada pelo CSS em mm)
    width: 260,
  });
};

/**
 * ✅ Extensão local de tipagem (não mexe no helpers)
 * - Mantém 100% compatível com o fluxo já validado
 * - Apenas permite ler o campo opcional "marca" na impressão
 */
type EtiquetaGeradaComMarca = EtiquetaGerada & {
  marca?: string;
};

const buildExtraFabHtml = (e: EtiquetaGeradaComMarca) => {
  let html = "";

  // ✅ NOVO: Marca (dados do fabricante)
  if (e.marca) {
    html +=
      `<div class="row"><span class="k">Marca:</span><span class="v">` +
      e.marca +
      `</span></div>`;
  }

  if (e.dataFabricante) {
    html +=
      `<div class="row"><span class="k">Fabricação:</span><span class="v">` +
      formatDateBR(e.dataFabricante) +
      `</span></div>`;
  }

  if (e.dataVencimento) {
    html +=
      `<div class="row"><span class="k">Val. Original:</span><span class="v">` +
      formatDateBR(e.dataVencimento) +
      `</span></div>`;
  }

  if (e.sif) {
    html += `<div class="row"><span class="k">SIF:</span><span class="v">${e.sif}</span></div>`;
  }

  if (e.loteFab) {
    html +=
      `<div class="row"><span class="k">Lote Fab.:</span><span class="v">` +
      e.loteFab +
      `</span></div>`;
  }

  return html;
};

export async function imprimirBatchNoBrowser(
  etqs: EtiquetaGerada[],
  options: PrintOptions = {}
) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;

  const LABEL_W_MM = options.labelWidthMm ?? 104;
  const LABEL_H_MM = options.labelHeightMm ?? 50.8;

  const qrDataUrls = await Promise.all(
    etqs.map((e) => makeQrDataUrl(buildQrPayloadFromEtiqueta(e)))
  );

  const parts: string[] = [];

  const head = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Impressão de Etiquetas</title>
  <style>
    @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }

    html, body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: Arial, Helvetica, sans-serif;
      background: #fff;
    }

    .page {
      width: ${LABEL_W_MM}mm;
      height: ${LABEL_H_MM}mm;
      page-break-after: always;
      break-after: page;
      box-sizing: border-box;

      /*
        ✅ Margens internas (padding)
        - Top/Bottom: 2.0mm (seguro)
        - Right: 0.0mm (lado do QR, como você pediu)
        - Left: 1.6mm (mantém respiro do outro lado)
      */
      padding: 2.0mm 0.0mm 2.0mm 1.6mm;

      display: flex;
      align-items: stretch;
      justify-content: stretch;
      overflow: hidden;
    }

    .label {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .main {
      display: flex;
      flex: 1;

      /* ✅ reduz o vão entre QR e texto */
      gap: 1.2mm;
      align-items: stretch;
    }

    /* ✅ QR maior */
    .qrBox {
      width: 22mm;
      min-width: 22mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;

      /* ✅ encosta o QR no lado direito sem “folga” */
      margin-right: 0 !important;
      padding-right: 0 !important;
    }

    .qrImg {
      width: 22mm;
      height: 22mm;
      object-fit: contain;
      display: block;
    }

    .qrHint {
      margin-top: 0.4mm;
      font-size: 2.1mm;
      line-height: 1.05;
      text-align: center;
      font-weight: 800;
      letter-spacing: 0.08mm;
    }

    .info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;

      /* ✅ compacta um pouco */
      gap: 0.45mm;
      overflow: hidden;
      min-width: 0;
    }

    /* ✅ fonte base um pouco menor */
    .row {
      display: flex;
      align-items: baseline;
      gap: 0.9mm;
      font-size: 2.7mm;
      line-height: 1.10;
      min-width: 0;
    }

    .k {
      font-weight: 900;
      min-width: 19mm;
      flex: 0 0 auto;
      white-space: nowrap;
    }

    .v {
      font-weight: 650;
      flex: 1 1 auto;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ✅ PRODUTO: quebra em até 2 linhas, com fonte um pouco menor */
    .row.produto { font-size: 3.0mm; }
    .row.produto .v {
      white-space: normal;
      overflow: hidden;
      text-overflow: ellipsis;

      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;

      line-height: 1.12;
      max-height: calc(2 * 1.12em);
    }

    /* ✅ QTD destaca mas sem exagero */
    .row.qtd { font-size: 3.0mm; }

    .footer {
      font-size: 2.5mm;
      line-height: 1.05;
      margin-top: 0.5mm;
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      min-width: 0;
    }

    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
`;
  parts.push(head);

  etqs.forEach((e, i) => {
    const isFab = e.tipo === "REVALIDAR";
    const extraFab = isFab ? buildExtraFabHtml(e as EtiquetaGeradaComMarca) : "";
    const qrSrc = qrDataUrls[i];

    const pageHtml = `
      <div class="page">
        <div class="label">
          <div class="main">
            <div class="qrBox">
              <img class="qrImg" alt="QR" src="${qrSrc}" />
              <div class="qrHint">SCAN</div>
            </div>

            <div class="info">
              <div class="row produto"><span class="k">Produto:</span><span class="v">${e.insumo}</span></div>
              <div class="row qtd"><span class="k">Qtd:</span><span class="v">${e.qtd} ${e.umd}</span></div>

              <div class="row"><span class="k">Manipulação:</span><span class="v">${formatDateBR(e.dataManip)}</span></div>
              <div class="row"><span class="k">Vencimento:</span><span class="v">${formatDateBR(e.dataVenc)}</span></div>

              <div class="row"><span class="k">Lote:</span><span class="v">${e.loteMan}</span></div>
              <div class="row"><span class="k">Resp.:</span><span class="v">${e.responsavel}</span></div>

              ${
                e.alergenico
                  ? `<div class="row"><span class="k">Alerg.:</span><span class="v">${e.alergenico}</span></div>`
                  : ""
              }

              ${extraFab}
            </div>
          </div>

          <div class="footer">
            <span>${e.localEnvio ? "Envio: " + e.localEnvio : ""}</span>
            <span>${e.localArmazenado ? "Arm.: " + e.localArmazenado : ""}</span>
          </div>
        </div>
      </div>
    `;
    parts.push(pageHtml);
  });

  parts.push(`
<script>
  function waitImagesLoaded() {
    const imgs = Array.from(document.images || []);
    if (imgs.length === 0) return Promise.resolve();
    return Promise.all(imgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => {
        img.onload = () => res();
        img.onerror = () => res();
      });
    }));
  }

  window.onload = async () => {
    try { await waitImagesLoaded(); } catch(e) {}
    window.focus();
    window.print();
  };
</script>
</body>
</html>`);

  w.document.open();
  w.document.write(parts.join("\n"));
  w.document.close();
}
