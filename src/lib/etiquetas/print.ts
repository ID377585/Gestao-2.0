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
    width: 200, // ✅ leve redução (antes 220) para ganhar espaço
  });
};

const buildExtraFabHtml = (e: EtiquetaGerada) => {
  let html = "";

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

      /* ✅ aqui estava a “margem” que empurrava tudo pra direita */
      padding: 2.2mm 1.6mm; /* era 2.6mm 3.2mm (reduzimos bastante o lado) */

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

      /* ✅ reduzimos o “vão” entre QR e texto */
      gap: 1.6mm; /* era 2.5mm */
      align-items: stretch;
    }

    /* ✅ QR ocupa exatamente o espaço necessário */
    .qrBox {
      width: 18mm;      /* era 20mm */
      min-width: 18mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    /* ✅ QR não pode ser maior que o box (evita “sobrar margem” e empurrar texto) */
    .qrImg {
      width: 18mm;      /* era 20mm */
      height: 18mm;     /* era 20mm */
      object-fit: contain;
      display: block;
    }

    .qrHint {
      margin-top: 0.6mm; /* era 1mm */
      font-size: 2.3mm;  /* era 2.6mm */
      line-height: 1.1;
      text-align: center;
      font-weight: 700;
      letter-spacing: 0.1mm;
    }

    .info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.6mm; /* era 0.8mm */
      overflow: hidden;
      min-width: 0; /* ✅ importante para ellipsis/quebra funcionar corretamente */
    }

    /* ✅ fonte base */
    .row {
      display: flex;
      align-items: baseline;
      gap: 1.0mm;     /* era 1.2mm */
      font-size: 2.9mm; /* era 3.0mm */
      line-height: 1.12;
      min-width: 0;
    }

    .k {
      font-weight: 800;
      min-width: 20mm; /* era 22mm (ganhamos área pro valor) */
      flex: 0 0 auto;
      white-space: nowrap;
    }

    .v {
      font-weight: 650;
      flex: 1 1 auto;
      min-width: 0;

      /* padrão continua sem quebrar */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ✅ PRODUTO: permitir quebrar linha e caber mais (sem cortar o final) */
    .row.produto { font-size: 3.2mm; } /* era 3.5mm */
    .row.produto .v {
      white-space: normal;              /* ✅ permite quebrar */
      overflow: hidden;
      text-overflow: ellipsis;

      /* ✅ limita em 2 linhas para não “estourar” a etiqueta */
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      line-height: 1.15;
      max-height: calc(2 * 1.15em);
    }

    /* ✅ QTD ainda destaca mas sem exagero */
    .row.qtd { font-size: 3.2mm; } /* era 3.5mm */

    .footer {
      font-size: 2.7mm; /* era 2.8mm */
      line-height: 1.1;
      margin-top: 0.6mm; /* era 1mm */
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
    const extraFab = isFab ? buildExtraFabHtml(e) : "";
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
              <div class="row"><span class="k">Responsável:</span><span class="v">${e.responsavel}</span></div>

              ${
                e.alergenico
                  ? `<div class="row"><span class="k">Alergênico:</span><span class="v">${e.alergenico}</span></div>`
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
