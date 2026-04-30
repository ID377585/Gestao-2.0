"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type IngredienteFicha = {
  id: string;
  nome: string;
  quantidadeUso: number;
  unidadeUso: string;
};

type EscalaFicha = {
  id: string;
  label: string;
  rendimentoDescricao: string | null;
  pesoLiquido: number | null;
  ingredientes: {
    id: string;
    nome: string;
    quantidade: number;
    unidade: string;
  }[];
};

type ScaleEditorProps = {
  scales: EscalaFicha[];
  onChange: (scales: EscalaFicha[]) => void;
  uid: () => string;
  toNumber: (value: unknown, fallback?: number) => number;
  normalizeUnit: (value: unknown, fallback?: string) => string;

  nome?: string;
  ingredientes?: IngredienteFicha[];
  rendimento?: number;
  portionWeight?: number;
  portionWeightUnit?: string | null;
  prepTimeMinutes?: number;
  temperatureCelsius?: number | null;
  cookingTimeMinutes?: number | null;
  cookingFactorGrams?: number | null;
  correctionFactorGrams?: number | null;
  difficultyLevel?: string | null;
  preparationMethod?: string;
  storageInstructions?: string | null;
  shelfLifeFrozen?: string | null;
  shelfLifeRefrigerated?: string | null;
  shelfLifeRoomTemp?: string | null;
  allergens?: string | null;
  sourceUpdatedAt?: string | null;
  yieldLabel?: string | null;
};

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0,000";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("pt-BR").format(date);
}

function getYieldUnit(yieldLabel?: string | null) {
  const cleaned = String(yieldLabel ?? "").trim();
  if (!cleaned) return "unidades";

  const withoutNumber = cleaned.replace(/^\d+(?:[.,]\d+)?\s*/i, "").trim();
  return withoutNumber || "unidades";
}

function getIngredientUnit(unit?: string | null) {
  return String(unit ?? "G").trim().toUpperCase() || "G";
}

function getBaseLiquidWeight(ingredientes: IngredienteFicha[]) {
  const total = ingredientes.reduce((acc, item) => {
    const unit = getIngredientUnit(item.unidadeUso);
    const qty = Number(item.quantidadeUso || 0);

    if (unit === "KG") return acc + qty * 1000;
    if (unit === "G") return acc + qty;

    return acc + qty;
  }, 0);

  return Number(total.toFixed(3));
}

function getPreparationFontSize(text: string) {
  const length = text.trim().length;

  if (length > 2600) return 6.8;
  if (length > 2200) return 7.2;
  if (length > 1800) return 7.8;
  if (length > 1400) return 8.5;
  if (length > 1000) return 9.2;
  if (length > 700) return 9.8;

  return 10.4;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default function ScaleEditor({
  nome = "Ficha Técnica",
  ingredientes = [],
  rendimento = 1,
  portionWeight = 0,
  portionWeightUnit = "G",
  prepTimeMinutes = 0,
  temperatureCelsius = null,
  cookingTimeMinutes = null,
  cookingFactorGrams = null,
  correctionFactorGrams = null,
  difficultyLevel = null,
  preparationMethod = "",
  storageInstructions = null,
  shelfLifeFrozen = null,
  shelfLifeRefrigerated = null,
  shelfLifeRoomTemp = null,
  allergens = null,
  sourceUpdatedAt = null,
  yieldLabel = null,
}: ScaleEditorProps) {
  const [showScalePage, setShowScalePage] = useState(false);
  const printRef = useRef<HTMLDivElement | null>(null);

  const scaleNumbers = useMemo(() => {
    return Array.from({ length: 10 }, (_, index) => index + 1);
  }, []);

  const yieldUnit = getYieldUnit(yieldLabel);
  const baseLiquidWeight =
    correctionFactorGrams && correctionFactorGrams > 0
      ? correctionFactorGrams
      : getBaseLiquidWeight(ingredientes);

  const preparationFontSize = getPreparationFontSize(preparationMethod);

  const handlePrintScale = () => {
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank", "width=1200,height=900");

    if (!printWindow) {
      alert("Não foi possível abrir a janela de impressão.");
      return;
    }

    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((node) => node.outerHTML)
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Escala - ${escapeHtml(nome || "Ficha Técnica")}</title>
          ${styles}
          <style>
            * {
              box-sizing: border-box;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            @page {
              size: A4 portrait;
              margin: 5mm;
            }

            html,
            body {
              margin: 0;
              padding: 0;
              background: #ffffff !important;
              color: #0f172a;
              font-family: Arial, Helvetica, sans-serif;
            }

            body {
              display: flex;
              justify-content: center;
              align-items: flex-start;
            }

            .scale-print-page {
              width: 200mm !important;
              min-height: 287mm !important;
              max-height: 287mm !important;
              padding: 5mm !important;
              box-shadow: none !important;
              border: 1px solid #d4d4d4 !important;
              border-radius: 0 !important;
              overflow: hidden !important;
              background: #ffffff !important;
            }

            .scale-print-wrapper {
              background: #ffffff !important;
              border: 0 !important;
              padding: 0 !important;
            }

            .scale-print-button {
              display: none !important;
            }
          </style>
        </head>
        <body>
          <div class="scale-print-wrapper">
            ${printRef.current.innerHTML}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-semibold">Escalas</h4>
          <p className="text-sm text-muted-foreground">
            Gere automaticamente a escala completa de 1X até 10X em uma página única.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setShowScalePage((prev) => !prev)}
        >
          {showScalePage ? "Ocultar escala" : "Gerar escala 1X a 10X"}
        </Button>
      </div>

      {!showScalePage ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Clique em “Gerar escala 1X a 10X” para visualizar a página de escala da ficha.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-slate-100 p-4">
          <div ref={printRef}>
            <div className="scale-print-page mx-auto w-[794px] overflow-hidden rounded-xl bg-white p-5 text-slate-900 shadow-sm">
              <div className="mb-3 flex justify-center">
                <div className="rounded-full bg-yellow-300 px-10 py-2 text-center text-[27px] font-extrabold italic tracking-wide text-black shadow-sm">
                  {nome || "Ficha Técnica"}
                </div>
              </div>

              <div className="mb-3 grid grid-cols-7 gap-2 text-center text-[8.5px] font-bold uppercase">
                <div className="rounded-lg bg-yellow-300 p-2 italic">
                  Grau de dificuldade
                  <div className="mt-1 text-[12px] normal-case">
                    {difficultyLevel || ""}
                  </div>
                </div>

                <div>
                  Temperatura
                  <div className="mt-1 text-[16px] font-black normal-case">
                    {temperatureCelsius !== null && temperatureCelsius !== undefined
                    ? formatNumber(temperatureCelsius)
                    : "—"}º
                  </div>
                </div>

                <div>
                  Tempo de prep.
                  <div className="mt-1 text-[16px] font-black normal-case">
                    {prepTimeMinutes ? formatNumber(prepTimeMinutes) : ""}
                    <span className="ml-1 text-[9px] font-semibold">min</span>
                  </div>
                </div>

                <div>
                  Tempo cocção
                  <div className="mt-1 text-[16px] font-black normal-case">
                    {cookingTimeMinutes !== null && cookingTimeMinutes !== undefined
                      ? formatNumber(cookingTimeMinutes)
                      : ""}
                    <span className="ml-1 text-[9px] font-semibold">min</span>
                  </div>
                </div>

                <div>
                  Fator cocção
                  <div className="mt-1 text-[16px] font-black normal-case">
                    {formatNumber(cookingFactorGrams ?? 0)}
                    <span className="ml-1 text-[9px] font-semibold">g</span>
                  </div>
                </div>

                <div>
                  Fator correção
                  <div className="mt-1 text-[16px] font-black normal-case">
                    {formatNumber(correctionFactorGrams ?? 0)}
                    <span className="ml-1 text-[9px] font-semibold">g</span>
                  </div>
                </div>

                <div>
                  Peso da porção
                  <div className="mt-1 text-[16px] font-black normal-case">
                    {formatNumber(portionWeight || 0)}
                    <span className="ml-1 text-[9px] font-semibold">
                      {portionWeightUnit || "G"}
                    </span>
                  </div>
                </div>
              </div>

              <table className="w-full table-fixed border-collapse text-center text-[9px] leading-[1.15]">
                <thead>
                  <tr>
                    <th className="w-[150px] border bg-white py-1"></th>
                    {scaleNumbers.map((scale) => (
                      <th
                        key={`scale-title-${scale}`}
                        className="border bg-white py-1 text-[16px] font-extrabold tracking-tight"
                      >
                        {scale}X
                      </th>
                    ))}
                  </tr>

                  <tr>
                    <th className="border bg-yellow-300 px-2 py-1 text-left text-[14px] font-extrabold italic">
                      Ingredientes:
                    </th>
                    {scaleNumbers.map((scale) => (
                      <th
                        key={`yield-${scale}`}
                        className="border bg-yellow-300 py-1 text-[8px] font-bold leading-tight"
                      >
                        <div>{formatNumber((rendimento || 1) * scale)}</div>
                        <div className="uppercase">{yieldUnit}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {ingredientes.length > 0 ? (
                    ingredientes.map((ingredient) => (
                      <tr key={ingredient.id}>
                        <td className="border bg-white px-2 py-1 text-left text-[9px] font-semibold uppercase">
                          {ingredient.nome}
                        </td>

                        {scaleNumbers.map((scale) => (
                          <td
                            key={`${ingredient.id}-${scale}`}
                            className="border bg-white py-1 text-[9px] font-semibold"
                          >
                            {formatNumber(Number(ingredient.quantidadeUso || 0) * scale)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={11}
                        className="border bg-white p-3 text-center font-semibold text-slate-500"
                      >
                        Nenhum ingrediente cadastrado.
                      </td>
                    </tr>
                  )}

                  <tr>
                    <td className="border bg-yellow-300 px-2 py-1 text-left text-[14px] font-extrabold uppercase">
                      Peso líquido:
                    </td>
                    {scaleNumbers.map((scale) => (
                      <td
                        key={`weight-${scale}`}
                        className="border bg-yellow-300 py-1 text-[12px] font-extrabold"
                      >
                        {formatNumber(baseLiquidWeight * scale)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              <div className="mt-4 inline-block rounded-lg bg-yellow-300 px-3 py-1 text-[15px] font-black italic">
                Modo de Preparo:
              </div>

              <div
                className="mt-3 whitespace-pre-line px-4 text-center font-semibold uppercase text-zinc-700"
                style={{
                  fontSize: `${preparationFontSize}px`,
                  lineHeight: "1.38",
                  letterSpacing: "0.25px",
                  maxHeight: "310px",
                  overflow: "hidden",
                }}
              >
                {preparationMethod || "Modo de preparo não informado."}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2 text-[13px] font-black">
                <span className="rounded-lg bg-yellow-300 px-2 py-1 text-[16px] italic">
                  Armazenamento:
                </span>
                <span>{storageInstructions || "—"}</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[12px] font-semibold text-zinc-700">
                <div className="rounded bg-slate-50 p-2">
                  Congelamento: {shelfLifeFrozen || "—"}
                </div>
                <div className="rounded bg-slate-50 p-2">
                  Sob refrigeração: {shelfLifeRefrigerated || "—"}
                </div>
                <div className="rounded bg-slate-50 p-2">
                  Temperatura Ambiente: {shelfLifeRoomTemp || "—"}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-[140px_1fr_180px] items-center gap-2 text-[13px] font-black">
                <div className="text-[18px] font-black italic text-red-500">
                  Alergênicos:
                </div>
                <div>{allergens || "—"}</div>
                <div className="rounded bg-yellow-50 p-2 text-right">
                  Atualizada em: {formatDate(sourceUpdatedAt)}
                </div>
              </div>
            </div>
          </div>

          <div className="scale-print-button mt-4 flex justify-end">
            <Button
              type="button"
              onClick={handlePrintScale}
              className="bg-emerald-600 text-white font-semibold shadow-md hover:bg-emerald-700 hover:shadow-lg transition-all duration-200"
            >
              🖨️ Imprimir escala
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}