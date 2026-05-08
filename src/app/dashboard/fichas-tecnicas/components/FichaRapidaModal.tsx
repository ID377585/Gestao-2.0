"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import IngredientEditor from "@/app/dashboard/fichas-tecnicas/components/IngredientEditor";
import { createTechnicalSheet } from "@/app/(dashboard)/dashboard/fichas-tecnicas/actions";
import {
  type ProductOption as MatcherProductOption,
  type Ingrediente as MatcherIngrediente,
  normalizeUnit,
  toNumber,
} from "@/app/dashboard/fichas-tecnicas/lib/ingredient-product-matcher";
import { detectAllergens } from "@/app/dashboard/fichas-tecnicas/utils/allergens";

type ProductOption = MatcherProductOption;
type Ingrediente = MatcherIngrediente;

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  products: ProductOption[];
  uid: () => string;
  formatCurrency: (value: number) => string;
};

function calcularCustos(
  ingredientes: Ingrediente[],
  rendimento: number,
  cmvAlvo = 0
) {
  const custoTotal = ingredientes.reduce(
    (acc, item) => acc + Number(item.custoIngrediente || 0),
    0
  );

  const rendimentoSeguro = Math.max(1, Number(rendimento || 1));
  const custoPorPorcao = custoTotal / rendimentoSeguro;

  let precoVenda = 0;

  if (cmvAlvo > 0 && cmvAlvo < 100) {
    precoVenda = custoPorPorcao / (cmvAlvo / 100);
  }

  return {
    custoTotal: Number(custoTotal.toFixed(4)),
    custoPorPorcao: Number(custoPorPorcao.toFixed(4)),
    precoVenda: Number((precoVenda || 0).toFixed(4)),
  };
}

function calcularFinanceiroFichaRapida({
  custoPorPorcao,
  cmvAlvoPercent,
  impostosDespesasPercent,
  precoVendaReal,
}: {
  custoPorPorcao: number;
  cmvAlvoPercent: number;
  impostosDespesasPercent: number;
  precoVendaReal: number;
}) {
  const cmvAlvoDecimal = cmvAlvoPercent > 0 ? cmvAlvoPercent / 100 : 0;
  const impostosDespesasDecimal =
    impostosDespesasPercent > 0 ? impostosDespesasPercent / 100 : 0;

  const precoVendaDesejavel =
    custoPorPorcao > 0 && cmvAlvoDecimal > 0
      ? custoPorPorcao / cmvAlvoDecimal
      : 0;

  const precoVendaComImpostos =
    precoVendaDesejavel > 0
      ? precoVendaDesejavel + precoVendaDesejavel * impostosDespesasDecimal
      : 0;

  const precoVendaBase =
    precoVendaReal > 0 ? precoVendaReal : precoVendaComImpostos;

  const lucroPorProduto =
    precoVendaBase > 0 ? precoVendaBase - custoPorPorcao : 0;

  const impostosDespesasValor =
    precoVendaBase > 0 ? precoVendaBase * impostosDespesasDecimal : 0;

  const cmvReal =
    precoVendaBase > 0 && custoPorPorcao > 0
      ? custoPorPorcao / precoVendaBase
      : 0;

  const lucroLiquido =
    precoVendaBase > 0 ? lucroPorProduto - impostosDespesasValor : 0;

  return {
    precoVendaDesejavel: Number(precoVendaDesejavel.toFixed(4)),
    precoVendaComImpostos: Number(precoVendaComImpostos.toFixed(4)),
    precoVendaBase: Number(precoVendaBase.toFixed(4)),
    lucroPorProduto: Number(lucroPorProduto.toFixed(4)),
    impostosDespesasValor: Number(impostosDespesasValor.toFixed(4)),
    cmvReal: Number(cmvReal.toFixed(4)),
    lucroLiquido: Number(lucroLiquido.toFixed(4)),
  };
}

export default function FichaRapidaModal({
  open,
  onClose,
  onSaved,
  products,
  uid,
  formatCurrency,
}: Props) {
  const [isPending, startTransition] = useTransition();

  const [nome, setNome] = useState("");
  const [rendimento, setRendimento] = useState<number | "">("");
  const [pesoPorcao, setPesoPorcao] = useState<number | "">("");
  const [pesoFinal, setPesoFinal] = useState<number | "">("");

  const [cmvAlvo, setCmvAlvo] = useState<number | "">(25);

  // Mantido oculto para preservar a lógica da planilha sem poluir a tela.
  const [impostosDespesas, setImpostosDespesas] = useState<number | "">(34.42);

  // Mantido oculto. Quando vazio, o sistema usa o preço sugerido com impostos/despesas.
  const [precoVendaReal, setPrecoVendaReal] = useState<number | "">("");

  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [erro, setErro] = useState("");

  const preview = useMemo(() => {
    return calcularCustos(ingredientes, toNumber(rendimento, 1), 0);
  }, [ingredientes, rendimento]);

  const financeiro = useMemo(() => {
    return calcularFinanceiroFichaRapida({
      custoPorPorcao: preview.custoPorPorcao,
      cmvAlvoPercent: toNumber(cmvAlvo, 0),
      impostosDespesasPercent: toNumber(impostosDespesas, 0),
      precoVendaReal: toNumber(precoVendaReal, 0),
    });
  }, [preview.custoPorPorcao, cmvAlvo, impostosDespesas, precoVendaReal]);

  function resetForm() {
    setNome("");
    setRendimento("");
    setPesoPorcao("");
    setPesoFinal("");
    setCmvAlvo(25);
    setImpostosDespesas(34.42);
    setPrecoVendaReal("");
    setIngredientes([]);
    setErro("");
  }

  function handleClose() {
    if (isPending) return;
    resetForm();
    onClose();
  }

  function calcularRendimentoPorPesoFinal(
    pesoFinal: number | "" | null | undefined,
    pesoPorPorcao: number | "" | null | undefined
  ): number | "" {
    if (pesoFinal === "" || pesoPorPorcao === "") {
      return "";
    }

    const pesoFinalNumber = toNumber(pesoFinal, 0);
    const pesoPorPorcaoNumber = toNumber(pesoPorPorcao, 0);

    if (pesoFinalNumber <= 0 || pesoPorPorcaoNumber <= 0) {
      return "";
    }

    return Number((pesoFinalNumber / pesoPorPorcaoNumber).toFixed(3));
  }

  function salvarFichaRapida() {
    setErro("");

    if (!nome.trim()) {
      setErro("Informe o nome da receita.");
      return;
    }

    if (toNumber(rendimento, 0) <= 0) {
      setErro("Informe um rendimento válido.");
      return;
    }

    if (!ingredientes.length) {
      setErro("Adicione pelo menos um ingrediente.");
      return;
    }

    const allergens =
      detectAllergens(ingredientes, products)?.trim() || "Não contém";

    startTransition(async () => {
      try {
        const payload = {
          name: nome.trim().toUpperCase(),
          category: "Ficha Rápida",
          yield_portions: Math.max(1, toNumber(rendimento, 1)),
          portion_weight: Math.max(0, toNumber(pesoPorcao, 0)),
          prep_time_minutes: 0,
          profit_margin_percent: toNumber(cmvAlvo, 0),
          sale_price: financeiro.precoVendaBase,
          total_cost: preview.custoTotal,
          cost_per_portion: preview.custoPorPorcao,
          preparation_method: "",
          image_url: null,
          image_path: null,
          difficulty_level: null,
          temperature_celsius: null,
          cooking_time_minutes: null,
          cooking_factor_grams: null,
          correction_factor_grams: Math.max(0, toNumber(pesoFinal, 0)),
          yield_label: null,
          portion_weight_unit: "KG",
          storage_instructions: null,
          shelf_life_frozen: null,
          shelf_life_refrigerated: null,
          shelf_life_room_temp: null,
          sector: null,
          allergens,
          source_updated_at: null,
          import_origin: "ficha_rapida",
          source_file_name: null,
          source_page_number: null,
          video_url: null,
          ingredients: ingredientes.map((item, index) => ({
            product_id: item.productId || null,
            ingredient_name: item.nome.trim(),
            usage_quantity: toNumber(item.quantidadeUso, 0),
            usage_unit: normalizeUnit(item.unidadeUso, "UN"),
            purchase_price: toNumber(item.precoCompra, 0),
            purchase_quantity: toNumber(item.quantidadeCompra, 1),
            purchase_unit: normalizeUnit(item.unidadeCompra, "UN"),
            correction_factor: toNumber(item.fatorCorrecao, 1) || 1,
            cooking_factor: toNumber(item.fatorCoccao, 1) || 1,
            base_unit_cost: toNumber(item.custoUnitarioBase, 0),
            final_cost: toNumber(item.custoIngrediente, 0),
            sort_order: index,
          })),
          scales: [],
        };

        await createTechnicalSheet(payload);

        resetForm();
        await onSaved();
        onClose();
      } catch (error: any) {
        console.error("Erro ao salvar ficha rápida:", error);
        setErro(error?.message || "Não foi possível salvar a ficha rápida.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && handleClose()}>
      <DialogContent className="max-h-[94vh] overflow-y-auto bg-white text-slate-900 border border-slate-200 shadow-2xl sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Ficha Técnica Rápida</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Input
                id="ficha-rapida-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value.toUpperCase())}
                placeholder="Ex.: BOLO DE FUBÁ"
                className="uppercase"
              />
            </div>
          </div>

          <IngredientEditor
            products={products}
            ingredientes={ingredientes}
            onChange={setIngredientes}
            uid={uid}
            formatCurrency={formatCurrency}
            compactMode
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="ficha-rapida-peso-final">Peso Final</Label>
              <Input
                id="ficha-rapida-peso-final"
                type="number"
                min="0"
                step="0.001"
                value={pesoFinal}
                onChange={(e) => {
                  const nextPesoFinal =
                    e.target.value === "" ? "" : toNumber(e.target.value, 0);

                  setPesoFinal(nextPesoFinal);
                  setRendimento(
                    calcularRendimentoPorPesoFinal(nextPesoFinal, pesoPorcao)
                  );
                }}
              />
            </div>

            <div>
              <Label htmlFor="ficha-rapida-peso">Peso da Porção</Label>
              <Input
                id="ficha-rapida-peso"
                type="number"
                min="0"
                step="0.001"
                value={pesoPorcao}
                onChange={(e) => {
                  const nextPesoPorcao =
                    e.target.value === "" ? "" : toNumber(e.target.value, 0);

                  setPesoPorcao(nextPesoPorcao);
                  setRendimento(
                    calcularRendimentoPorPesoFinal(pesoFinal, nextPesoPorcao)
                  );
                }}
              />
            </div>

            <div>
              <Label htmlFor="ficha-rapida-rendimento">Rendimento</Label>
              <Input
                id="ficha-rapida-rendimento"
                type="number"
                min="0"
                step="0.001"
                value={rendimento}
                readOnly
                className="bg-slate-100 font-semibold text-slate-700"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="ficha-rapida-cmv-alvo">
                  CMV desejado (%)
                </Label>
                <Input
                  id="ficha-rapida-cmv-alvo"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cmvAlvo}
                  onChange={(e) =>
                    setCmvAlvo(
                      e.target.value === "" ? "" : toNumber(e.target.value, 0)
                    )
                  }
                  placeholder="25"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Preço de Custo Receita Total
                </p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(preview.custoTotal)}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Custo por porção</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(preview.custoPorPorcao)}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">
                  Preço venda sugerido
                </p>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(financeiro.precoVendaComImpostos)}
                </p>
              </div>

              <div className="rounded-lg bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Lucro por produto</p>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(financeiro.lucroPorProduto)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={salvarFichaRapida}
              disabled={isPending}
              className="bg-emerald-600 text-white font-semibold shadow-md hover:bg-emerald-700 hover:shadow-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? "Salvando..." : "Salvar ficha técnica"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}