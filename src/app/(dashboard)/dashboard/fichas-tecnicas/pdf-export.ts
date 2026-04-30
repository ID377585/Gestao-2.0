import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type PdfIngrediente = {
  id: string;
  productId: string | null;
  nome: string;
  quantidadeUso: number;
  unidadeUso: string;
  precoCompra: number;
  quantidadeCompra: number;
  unidadeCompra: string;
  custoUnitarioBase: number;
  custoIngrediente: number;
  fatorCorrecao: number;
  fatorCoccao: number;
};

export type PdfEscalaIngrediente = {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
};

export type PdfEscalaFicha = {
  id: string;
  label: string;
  rendimentoDescricao: string | null;
  pesoLiquido: number | null;
  ingredientes: PdfEscalaIngrediente[];
};

export type TechnicalSheetPdfData = {
  id: string;
  nome: string;
  categoria: string;
  rendimento: number;
  pesoPorcao: number;
  tempoPreparo: number;
  custoTotal: number;
  custoPorPorcao: number;
  margemLucro: number;
  precoVenda: number;
  modoPreparo: string;
  imageUrl: string | null;
  imagePath: string | null;

  difficultyLevel: string | null;
  temperatureCelsius: number | null;
  cookingTimeMinutes: number | null;
  cookingFactorGrams: number | null;
  correctionFactorGrams: number | null;
  yieldLabel: string | null;
  portionWeightUnit: string | null;
  storageInstructions: string | null;
  shelfLifeFrozen: string | null;
  shelfLifeRefrigerated: string | null;
  shelfLifeRoomTemp: string | null;
  allergens: string | null;
  sourceUpdatedAt: string | null;
  importOrigin: string | null;
  sourceFileName: string | null;
  sourcePageNumber: number | null;
  videoUrl: string | null;

  ingredientes: PdfIngrediente[];
  escalas: PdfEscalaFicha[];

  createdAt: string;
  updatedAt: string;
};

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function calcularCMV(custoPorPorcao: number, precoVenda: number) {
  if (!precoVenda || precoVenda <= 0) return 0;
  return (custoPorPorcao / precoVenda) * 100;
}

function calcularLucroUnitario(precoVenda: number, custoPorPorcao: number) {
  return (precoVenda || 0) - (custoPorPorcao || 0);
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function getScaledFicha(ficha: TechnicalSheetPdfData, servings: number) {
  const safeServings = Math.max(1, toNumber(servings, 1));
  const factor =
    ficha.rendimento > 0
      ? Number((safeServings / ficha.rendimento).toFixed(4))
      : 1;

  const ingredientesEscalados = ficha.ingredientes.map((item) => ({
    ...item,
    quantidadeUso: Number((item.quantidadeUso * factor).toFixed(3)),
    custoIngrediente: Number((item.custoIngrediente * factor).toFixed(2)),
  }));

  const custoTotal = Number(
    ingredientesEscalados
      .reduce((acc, item) => acc + item.custoIngrediente, 0)
      .toFixed(2)
  );

  return {
    factor,
    servings: safeServings,
    ingredientes: ingredientesEscalados,
    custoTotal,
  };
}

async function loadImageAsDataUrl(imageUrl: string) {
  try {
    const response = await fetch(imageUrl, { cache: "no-store" });
    if (!response.ok) return null;

    const blob = await response.blob();

    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result =
          typeof reader.result === "string" ? reader.result : null;
        resolve(result);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Erro ao carregar imagem para o PDF:", error);
    return null;
  }
}

async function tryAddHeaderImage(
  doc: jsPDF,
  imageUrl: string | null,
  marginX: number,
  startY: number
) {
  if (!imageUrl) return startY;

  const dataUrl = await loadImageAsDataUrl(imageUrl);
  if (!dataUrl) return startY;

  try {
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxWidth = 160;
    const maxHeight = 130;

    const props = doc.getImageProperties(dataUrl);
    const ratio = Math.min(maxWidth / props.width, maxHeight / props.height);

    const renderWidth = props.width * ratio;
    const renderHeight = props.height * ratio;
    const x = pageWidth - marginX - renderWidth;

    doc.setDrawColor(230, 230, 230);
    doc.roundedRect(x - 6, startY - 6, renderWidth + 12, renderHeight + 12, 8, 8);
    doc.addImage(
      dataUrl,
      props.fileType || "JPEG",
      x,
      startY,
      renderWidth,
      renderHeight
    );

    return startY;
  } catch (error) {
    console.error("Erro ao inserir imagem no PDF:", error);
    return startY;
  }
}

function ensureSpace(doc: jsPDF, currentY: number, neededHeight = 40, topY = 40) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - 50;

  if (currentY + neededHeight > bottomLimit) {
    doc.addPage();
    return topY;
  }

  return currentY;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 40, y);

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.line(40, y + 7, doc.internal.pageSize.getWidth() - 40, y + 7);

  return y + 20;
}

function drawMetricCard(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  accent: [number, number, number] = [15, 23, 42]
) {
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(x, y, width, 46, 8, 8, "FD");

  doc.setFillColor(...accent);
  doc.roundedRect(x, y, 4, 46, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(label.toUpperCase(), x + 13, y + 15);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(value, x + 13, y + 33);
}

function addWrappedText(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 15
) {
  const safeText = text?.trim() || "—";
  const lines = doc.splitTextToSize(safeText, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function getLastAutoTableY(doc: jsPDF, fallback: number) {
  const docWithTable = doc as jsPDF & {
    lastAutoTable?: {
      finalY?: number;
    };
  };

  return docWithTable.lastAutoTable?.finalY ?? fallback;
}

function applyTableDefaults() {
  return {
    theme: "plain" as const,
    styles: {
      fontSize: 8.5,
      cellPadding: 6,
      overflow: "linebreak" as const,
      valign: "middle" as const,
      textColor: [30, 41, 59] as [number, number, number],
      lineColor: [226, 232, 240] as [number, number, number],
      lineWidth: 0.4,
    },
    headStyles: {
      fillColor: [15, 23, 42] as [number, number, number],
      textColor: [255, 255, 255] as [number, number, number],
      fontStyle: "bold" as const,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252] as [number, number, number],
    },
  };
}

export async function exportTechnicalSheetPdf(
  ficha: TechnicalSheetPdfData,
  desiredServings: number
) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const marginX = 40;
  const pageWidth = doc.internal.pageSize.getWidth();
  let currentY = 42;

  const scaled = getScaledFicha(ficha, desiredServings);
  const cmv = calcularCMV(ficha.custoPorPorcao, ficha.precoVenda);
  const lucro = calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao);

  await tryAddHeaderImage(doc, ficha.imageUrl, marginX, currentY);

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1.4);
  doc.line(marginX, currentY, pageWidth - marginX, currentY);

  currentY += 24;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(23);
  doc.setTextColor(15, 23, 42);

  const titleLines = doc.splitTextToSize(
    ficha.nome || "Ficha Técnica",
    ficha.imageUrl ? pageWidth - marginX * 2 - 180 : pageWidth - marginX * 2
  );

  doc.text(titleLines, marginX, currentY);
  currentY += titleLines.length * 25;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text((ficha.categoria || "Sem categoria").toUpperCase(), marginX, currentY);

  currentY += 16;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Gerado em ${formatDate(new Date().toISOString())}`, marginX, currentY);

  currentY += 18;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 36, 8, 8, "FD");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Rendimento original: ${ficha.rendimento} porções${
      ficha.yieldLabel ? ` • ${ficha.yieldLabel}` : ""
    }`,
    marginX + 12,
    currentY + 14
  );

  doc.text(
    `Rendimento exportado: ${scaled.servings} porções • Fator aplicado: ${scaled.factor.toFixed(
      3
    )}x`,
    marginX + 12,
    currentY + 28
  );

  currentY += 52;

  const cardWidth = (pageWidth - marginX * 2 - 16) / 2;

  drawMetricCard(
    doc,
    "Custo total",
    formatCurrency(scaled.custoTotal),
    marginX,
    currentY,
    cardWidth,
    [185, 28, 28]
  );

  drawMetricCard(
    doc,
    "Custo por porção",
    formatCurrency(ficha.custoPorPorcao),
    marginX + cardWidth + 16,
    currentY,
    cardWidth,
    [37, 99, 235]
  );

  currentY += 56;

  drawMetricCard(
    doc,
    "Preço de venda",
    formatCurrency(ficha.precoVenda),
    marginX,
    currentY,
    cardWidth,
    [22, 163, 74]
  );

  drawMetricCard(
    doc,
    "CMV",
    `${cmv.toFixed(1)}%`,
    marginX + cardWidth + 16,
    currentY,
    cardWidth,
    [15, 23, 42]
  );

  currentY += 56;

  drawMetricCard(
    doc,
    "Lucro unitário",
    formatCurrency(lucro),
    marginX,
    currentY,
    cardWidth,
    [124, 58, 237]
  );

  drawMetricCard(
    doc,
    "Margem",
    `${Number(ficha.margemLucro || 0).toFixed(0)}%`,
    marginX + cardWidth + 16,
    currentY,
    cardWidth,
    [234, 88, 12]
  );

  currentY += 66;
  currentY = ensureSpace(doc, currentY, 90);

  currentY = drawSectionTitle(doc, "Dados complementares", currentY);

  autoTable(doc, {
    startY: currentY,
    ...applyTableDefaults(),
    body: [
      [
        "Dificuldade",
        ficha.difficultyLevel || "—",
        "Temperatura",
        ficha.temperatureCelsius !== null ? `${ficha.temperatureCelsius} ºC` : "—",
      ],
      [
        "Tempo de cocção",
        ficha.cookingTimeMinutes !== null
          ? `${ficha.cookingTimeMinutes} min`
          : "—",
        "Fator de cocção",
        ficha.cookingFactorGrams !== null
          ? `${ficha.cookingFactorGrams} g`
          : "—",
      ],
      [
        "Fator de correção",
        ficha.correctionFactorGrams !== null
          ? `${ficha.correctionFactorGrams} g`
          : "—",
        "Armazenamento",
        ficha.storageInstructions || "—",
      ],
      [
        "Validade congelado",
        ficha.shelfLifeFrozen || "—",
        "Validade refrigerado",
        ficha.shelfLifeRefrigerated || "—",
      ],
      [
        "Validade ambiente",
        ficha.shelfLifeRoomTemp || "—",
        "Alergênicos",
        ficha.allergens || "—",
      ],
      [
        "Atualizado em",
        formatDate(ficha.sourceUpdatedAt || ficha.updatedAt),
        "Origem",
        ficha.importOrigin || "Cadastro manual",
      ],
      [
        "Arquivo de origem",
        ficha.sourceFileName || "—",
        "Página",
        ficha.sourcePageNumber !== null ? String(ficha.sourcePageNumber) : "—",
      ],
      ["Vídeo", ficha.videoUrl || "—", "Imagem", ficha.imageUrl ? "Sim" : "Não"],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 105 },
      1: { cellWidth: 155 },
      2: { fontStyle: "bold", cellWidth: 105 },
      3: { cellWidth: 155 },
    },
    margin: { left: marginX, right: marginX },
  });

  currentY = getLastAutoTableY(doc, currentY) + 22;
  currentY = ensureSpace(doc, currentY, 90);

  currentY = drawSectionTitle(doc, "Ingredientes", currentY);

  autoTable(doc, {
    startY: currentY,
    ...applyTableDefaults(),
    head: [
      [
        "Ingrediente",
        "Qtd. utilizada",
        "Qtd. embalagem",
        "Preço compra",
        "Custo unit.",
        "Preço qtd utilizada",
      ],
    ],
    body:
      scaled.ingredientes.length > 0
        ? scaled.ingredientes.map((item) => [
            item.nome || "—",
            `${item.quantidadeUso} ${item.unidadeUso}`,
            `${item.quantidadeCompra} ${item.unidadeCompra}`,
            formatCurrency(item.precoCompra),
            formatCurrency(item.custoUnitarioBase),
            formatCurrency(item.custoIngrediente),
          ])
        : [["Nenhum ingrediente cadastrado.", "", "", "", "", ""]],
    columnStyles: {
      0: { cellWidth: 160, fontStyle: "bold" },
      1: { cellWidth: 78 },
      2: { cellWidth: 78 },
      3: { cellWidth: 74 },
      4: { cellWidth: 68 },
      5: { cellWidth: 84 },
    },
    margin: { left: marginX, right: marginX },
  });

  currentY = getLastAutoTableY(doc, currentY) + 22;
  currentY = ensureSpace(doc, currentY, 140);

  currentY = drawSectionTitle(doc, "Modo de preparo", currentY);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);

  const preparoBoxX = marginX;
  const preparoBoxWidth = pageWidth - marginX * 2;
  const preparoText = ficha.modoPreparo || "Não informado.";
  const preparoLines = doc.splitTextToSize(preparoText, preparoBoxWidth - 24);
  const preparoBoxHeight = Math.max(48, preparoLines.length * 15 + 24);

  if (currentY + preparoBoxHeight > doc.internal.pageSize.getHeight() - 55) {
    doc.addPage();
    currentY = 40;
    currentY = drawSectionTitle(doc, "Modo de preparo", currentY);
  }

  doc.roundedRect(
    preparoBoxX,
    currentY,
    preparoBoxWidth,
    preparoBoxHeight,
    8,
    8,
    "FD"
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text(preparoLines, preparoBoxX + 12, currentY + 20);

  currentY += preparoBoxHeight + 24;
  currentY = ensureSpace(doc, currentY, 90);

  currentY = drawSectionTitle(doc, "Escalas", currentY);

  if (!ficha.escalas.length) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, currentY, pageWidth - marginX * 2, 34, 8, 8, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text("Nenhuma escala cadastrada.", marginX + 12, currentY + 21);

    currentY += 44;
  } else {
    for (const scale of ficha.escalas) {
      currentY = ensureSpace(doc, currentY, 120);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(scale.label || "Escala", marginX, currentY);
      currentY += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `Rendimento: ${scale.rendimentoDescricao || "—"} • Peso líquido: ${
          scale.pesoLiquido !== null ? `${scale.pesoLiquido} g` : "—"
        }`,
        marginX,
        currentY
      );

      currentY += 12;

      autoTable(doc, {
        startY: currentY + 6,
        ...applyTableDefaults(),
        head: [["Ingrediente", "Quantidade", "Unidade"]],
        body:
          scale.ingredientes.length > 0
            ? scale.ingredientes.map((item) => [
                item.nome || "—",
                String(item.quantidade ?? ""),
                item.unidade || "—",
              ])
            : [["Sem ingredientes cadastrados nesta escala.", "", ""]],
        columnStyles: {
          0: { cellWidth: 315, fontStyle: "bold" },
          1: { cellWidth: 105 },
          2: { cellWidth: 95 },
        },
        margin: { left: marginX, right: marginX },
      });

      currentY = getLastAutoTableY(doc, currentY) + 22;
    }
  }

  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);

    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.6);
    doc.line(marginX, pageHeight - 34, pageWidth - marginX, pageHeight - 34);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${ficha.nome} • Página ${page}/${totalPages}`, marginX, pageHeight - 18);
  }

  const fileName =
    sanitizeFileName(`ficha-tecnica-${ficha.nome || "receita"}`) ||
    "ficha-tecnica";

  doc.save(`${fileName}.pdf`);
}