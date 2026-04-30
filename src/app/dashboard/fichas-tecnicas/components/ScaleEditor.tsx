"use client";

import { useMemo, useState } from "react";
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
  if (!Number.isFinite(value)) return "0";

  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: value % 1 === 0 ? 0 : 3,
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

    return acc;
  }, 0);

  return Number(total.toFixed(3));
}

function getPreparationFontSize(text: string) {
  const length = text.trim().length;

  if (length > 2200) return 7.2;
  if (length > 1800) return 8;
  if (length > 1400) return 8.8;
  if (length > 1000) return 9.6;
  if (length > 700) return 10.5;

  return 11.5;
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

  const scaleNumbers = useMemo(() => {
    return Array.from({ length: 10 }, (_, index) => index + 1);
  }, []);

  const yieldUnit = getYieldUnit(yieldLabel);
  const baseLiquidWeight =
    correctionFactorGrams && correctionFactorGrams > 0
      ? correctionFactorGrams
      : getBaseLiquidWeight(ingredientes);

  const preparationFontSize = getPreparationFontSize(preparationMethod);

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
          <div className="mx-auto w-[794px] overflow-hidden rounded-md bg-white p-4 text-slate-900 shadow-sm">
            <div className="mb-3 flex justify-center">
              <div className="rounded-full bg-yellow-300 px-10 py-3 text-center text-4xl font-black italic text-black shadow-sm">
                {nome || "Ficha Técnica"}
              </div>
            </div>

            <div className="mb-3 grid grid-cols-7 gap-2 text-center text-[10px] font-bold uppercase">
              <div className="rounded-lg bg-yellow-300 p-2 italic">
                Grau de dificuldade
                <div className="mt-1 text-base normal-case">
                  {difficultyLevel || "—"}
                </div>
              </div>

              <div>
                Temperatura
                <div className="mt-1 text-xl font-black normal-case">
                  {temperatureCelsius ?? 0}º
                </div>
              </div>

              <div>
                Tempo de prep.
                <div className="mt-1 text-xl font-black normal-case">
                  {prepTimeMinutes || 0}
                  <span className="ml-1 text-xs font-semibold">min</span>
                </div>
              </div>

              <div>
                Tempo cocção
                <div className="mt-1 text-xl font-black normal-case">
                  {cookingTimeMinutes ?? 0}
                  <span className="ml-1 text-xs font-semibold">min</span>
                </div>
              </div>

              <div>
                Fator cocção
                <div className="mt-1 text-xl font-black normal-case">
                  {formatNumber(cookingFactorGrams ?? 0)}
                  <span className="ml-1 text-xs font-semibold">g</span>
                </div>
              </div>

              <div>
                Fator correção
                <div className="mt-1 text-xl font-black normal-case">
                  {formatNumber(correctionFactorGrams ?? 0)}
                  <span className="ml-1 text-xs font-semibold">g</span>
                </div>
              </div>

              <div>
                Peso da porção
                <div className="mt-1 text-xl font-black normal-case">
                  {formatNumber(portionWeight || 0)}
                  <span className="ml-1 text-xs font-semibold">
                    {portionWeightUnit || "G"}
                  </span>
                </div>
              </div>
            </div>

            <table className="w-full table-fixed border-collapse text-center text-[11px]">
              <thead>
                <tr>
                  <th className="w-[150px] border bg-white p-2"></th>
                  {scaleNumbers.map((scale) => (
                    <th key={scale} className="border bg-white p-2 text-2xl font-black">
                      {scale}X
                    </th>
                  ))}
                </tr>

                <tr>
                  <th className="rounded-l-lg border bg-yellow-300 p-2 text-left text-xl font-black italic">
                    Ingredientes:
                  </th>
                  {scaleNumbers.map((scale) => (
                    <th key={scale} className="border bg-yellow-300 p-1 text-[9px] font-black">
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
                      <td className="border bg-white p-2 text-left text-[11px] font-black uppercase">
                        {ingredient.nome}
                      </td>

                      {scaleNumbers.map((scale) => (
                        <td key={scale} className="border bg-white p-2 font-black">
                          {formatNumber(Number(ingredient.quantidadeUso || 0) * scale)}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={11}
                      className="border bg-white p-4 text-center font-semibold text-slate-500"
                    >
                      Nenhum ingrediente cadastrado.
                    </td>
                  </tr>
                )}

                <tr>
                  <td className="border bg-yellow-300 p-2 text-left text-xl font-black uppercase">
                    Peso líquido:
                  </td>
                  {scaleNumbers.map((scale) => (
                    <td key={scale} className="border bg-yellow-300 p-2 text-lg font-black">
                      {formatNumber(baseLiquidWeight * scale)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            <div className="mt-4 inline-block rounded-lg bg-yellow-300 px-3 py-1 text-xl font-black italic">
              Modo de Preparo:
            </div>

            <div
              className="mt-3 whitespace-pre-line text-center font-black uppercase leading-tight text-zinc-700"
              style={{
                fontSize: `${preparationFontSize}px`,
                lineHeight: preparationFontSize <= 8 ? "1.12" : "1.22",
                maxHeight: "250px",
                overflow: "hidden",
              }}
            >
              {preparationMethod || "Modo de preparo não informado."}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-sm font-black">
              <span className="rounded-lg bg-yellow-300 px-2 py-1 text-lg italic">
                Armazenamento:
              </span>
              <span>{storageInstructions || "—"}</span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm font-black text-zinc-700">
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

            <div className="mt-3 grid grid-cols-[140px_1fr_180px] items-center gap-2 text-sm font-black">
              <div className="text-xl font-black italic text-red-500">
                Alergênicos:
              </div>
              <div>{allergens || "—"}</div>
              <div className="rounded bg-yellow-50 p-2 text-right">
                Atualizada em: {formatDate(sourceUpdatedAt)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}