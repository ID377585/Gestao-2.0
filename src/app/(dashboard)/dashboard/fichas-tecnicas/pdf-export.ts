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
    const maxWidth = pageWidth - marginX * 2;
    const maxHeight = 180;

    const props = doc.getImageProperties(dataUrl);
    const ratio = Math.min(maxWidth / props.width, maxHeight / props.height);

    const renderWidth = props.width * ratio;
    const renderHeight = props.height * ratio;
    const x = (pageWidth - renderWidth) / 2;

    doc.addImage(dataUrl, props.fileType || "JPEG", x, startY, renderWidth, renderHeight);

    return startY + renderHeight + 18;
  } catch (error) {
    console.error("Erro ao inserir imagem no PDF:", error);
    return startY;
  }
}

function ensureSpace(doc: jsPDF, currentY: number, neededHeight = 40, topY = 40) {
  const pageHeight = doc.internal.pageSize.getHeight();
  const bottomLimit = pageHeight - 40;

  if (currentY + neededHeight > bottomLimit) {
    doc.addPage();
    return topY;
  }

  return currentY;
}

function drawSectionTitle(doc: jsPDF, title: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, 40, y);
  doc.setDrawColor(220, 220, 220);
  doc.line(40, y + 6, doc.internal.pageSize.getWidth() - 40, y + 6);
  return y + 18;
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
  let currentY = 40;

  const scaled = getScaledFicha(ficha, desiredServings);
  const cmv = calcularCMV(ficha.custoPorPorcao, ficha.precoVenda);
  const lucro = calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao);

  currentY = await tryAddHeaderImage(doc, ficha.imageUrl, marginX, currentY);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(ficha.nome || "Ficha Técnica", marginX, currentY);
  currentY += 20;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `${ficha.categoria || "Sem categoria"} • Gerado em ${formatDate(new Date().toISOString())}`,
    marginX,
    currentY
  );
  currentY += 18;

  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text(
    `Rendimento original: ${ficha.rendimento} porções${
      ficha.yieldLabel ? ` • ${ficha.yieldLabel}` : ""
    }`,
    marginX,
    currentY
  );
  currentY += 14;

  doc.text(
    `Rendimento exportado: ${scaled.servings} porções • Fator aplicado: ${scaled.factor.toFixed(
      3
    )}x`,
    marginX,
    currentY
  );
  currentY += 18;

  autoTable(doc, {
    startY: currentY,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 6,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [30, 30, 30],
      fontStyle: "bold",
    },
    body: [
      [
        "Custo total ajustado",
        formatCurrency(scaled.custoTotal),
        "Custo por porção",
        formatCurrency(ficha.custoPorPorcao),
      ],
      [
        "Preço de venda",
        formatCurrency(ficha.precoVenda),
        "CMV",
        `${cmv.toFixed(1)}%`,
      ],
      [
        "Lucro unitário",
        formatCurrency(lucro),
        "Margem de lucro",
        `${Number(ficha.margemLucro || 0).toFixed(0)}%`,
      ],
      [
        "Peso por porção",
        `${ficha.pesoPorcao} ${ficha.portionWeightUnit || "G"}`,
        "Tempo de preparo",
        `${ficha.tempoPreparo} min`,
      ],
    ],
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 115 },
      1: { cellWidth: 120 },
      2: { fontStyle: "bold", cellWidth: 115 },
      3: { cellWidth: 120 },
    },
    margin: { left: marginX, right: marginX },
  });

  currentY = getLastAutoTableY(doc, currentY) + 18;
  currentY = ensureSpace(doc, currentY, 80);

  currentY = drawSectionTitle(doc, "Dados complementares", currentY);

  autoTable(doc, {
    startY: currentY,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 6,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [30, 30, 30],
      fontStyle: "bold",
    },
    body: [
      ["Dificuldade", ficha.difficultyLevel || "—", "Temperatura", ficha.temperatureCelsius !== null ? `${ficha.temperatureCelsius} ºC` : "—"],
      ["Tempo de cocção", ficha.cookingTimeMinutes !== null ? `${ficha.cookingTimeMinutes} min` : "—", "Fator de cocção", ficha.cookingFactorGrams !== null ? `${ficha.cookingFactorGrams} g` : "—"],
      ["Fator de correção", ficha.correctionFactorGrams !== null ? `${ficha.correctionFactorGrams} g` : "—", "Armazenamento", ficha.storageInstructions || "—"],
      ["Validade congelado", ficha.shelfLifeFrozen || "—", "Validade refrigerado", ficha.shelfLifeRefrigerated || "—"],
      ["Validade ambiente", ficha.shelfLifeRoomTemp || "—", "Alergênicos", ficha.allergens || "—"],
      ["Atualizado em", formatDate(ficha.sourceUpdatedAt || ficha.updatedAt), "Origem", ficha.importOrigin || "Cadastro manual"],
      ["Arquivo de origem", ficha.sourceFileName || "—", "Página", ficha.sourcePageNumber !== null ? String(ficha.sourcePageNumber) : "—"],
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

  currentY = getLastAutoTableY(doc, currentY) + 18;
  currentY = ensureSpace(doc, currentY, 80);

  currentY = drawSectionTitle(doc, "Ingredientes", currentY);

  autoTable(doc, {
    startY: currentY,
    theme: "grid",
    styles: {
      fontSize: 8.5,
      cellPadding: 5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [30, 30, 30],
      fontStyle: "bold",
    },
    head: [
      [
        "Ingrediente",
        "Uso ajustado",
        "Compra",
        "Preço compra",
        "Custo unit.",
        "Custo final",
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
      0: { cellWidth: 170 },
      1: { cellWidth: 82 },
      2: { cellWidth: 72 },
      3: { cellWidth: 75 },
      4: { cellWidth: 70 },
      5: { cellWidth: 72 },
    },
    margin: { left: marginX, right: marginX },
  });

  currentY = getLastAutoTableY(doc, currentY) + 18;
  currentY = ensureSpace(doc, currentY, 120);

  currentY = drawSectionTitle(doc, "Modo de preparo", currentY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  currentY = addWrappedText(
    doc,
    ficha.modoPreparo || "Não informado.",
    marginX,
    currentY,
    pageWidth - marginX * 2,
    14
  );

  currentY += 18;
  currentY = ensureSpace(doc, currentY, 80);

  currentY = drawSectionTitle(doc, "Escalas", currentY);

  if (!ficha.escalas.length) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Nenhuma escala cadastrada.", marginX, currentY);
    currentY += 20;
  } else {
    for (const scale of ficha.escalas) {
      currentY = ensureSpace(doc, currentY, 100);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(scale.label || "Escala", marginX, currentY);
      currentY += 14;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(
        `Rendimento: ${scale.rendimentoDescricao || "—"} • Peso líquido: ${
          scale.pesoLiquido !== null ? `${scale.pesoLiquido} g` : "—"
        }`,
        marginX,
        currentY
      );
      currentY += 10;

      autoTable(doc, {
        startY: currentY + 6,
        theme: "grid",
        styles: {
          fontSize: 8.5,
          cellPadding: 5,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [245, 245, 245],
          textColor: [30, 30, 30],
          fontStyle: "bold",
        },
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
          0: { cellWidth: 300 },
          1: { cellWidth: 100 },
          2: { cellWidth: 100 },
        },
        margin: { left: marginX, right: marginX },
      });

      currentY = getLastAutoTableY(doc, currentY) + 18;
    }
  }

  const totalPages = doc.getNumberOfPages();

  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Ficha técnica • ${ficha.nome} • Página ${page} de ${totalPages}`,
      marginX,
      doc.internal.pageSize.getHeight() - 18
    );
  }

  const fileName = sanitizeFileName(`ficha-tecnica-${ficha.nome || "receita"}`) || "ficha-tecnica";
  doc.save(`${fileName}.pdf`);
}