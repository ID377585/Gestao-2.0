"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

const CATEGORY_OPTIONS = ["Pré-Preparo", "Empratamento"];
const SECTOR_OPTIONS = [
  "Produção",
  "Massaria",
  "Confeitaria",
  "Burrataria",
  "Padaria",
  "Peixaria",
  "Bar",
  "Cozinha",
];

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
  const [categoria, setCategoria] = useState("");
  const [rendimento, setRendimento] = useState<number>(1);
  const [pesoPorcao, setPesoPorcao] = useState<number>(0);
  const [setor, setSetor] = useState("");
  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [erro, setErro] = useState("");

  const preview = useMemo(() => {
    return calcularCustos(ingredientes, rendimento, 0);
  }, [ingredientes, rendimento]);

  function resetForm() {
    setNome("");
    setCategoria("");
    setRendimento(1);
    setPesoPorcao(0);
    setSetor("");
    setIngredientes([]);
    setErro("");
  }

  function handleClose() {
    if (isPending) return;
    resetForm();
    onClose();
  }

  function salvarFichaRapida() {
    setErro("");

    if (!nome.trim()) {
      setErro("Informe o nome da receita.");
      return;
    }

    if (!categoria.trim()) {
      setErro("Informe a categoria.");
      return;
    }

    if (toNumber(rendimento, 0) <= 0) {
      setErro("Informe um rendimento válido.");
      return;
    }

    if (!setor.trim()) {
      setErro("Informe o setor.");
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
          name: nome.trim(),
          category: categoria.trim(),
          yield_portions: Math.max(1, toNumber(rendimento, 1)),
          portion_weight: Math.max(0, toNumber(pesoPorcao, 0)),
          prep_time_minutes: 0,
          profit_margin_percent: 0,
          sale_price: preview.precoVenda,
          total_cost: preview.custoTotal,
          cost_per_portion: preview.custoPorPorcao,
          preparation_method: "",
          image_url: null,
          image_path: null,
          difficulty_level: null,
          temperature_celsius: null,
          cooking_time_minutes: null,
          cooking_factor_grams: null,
          correction_factor_grams: null,
          yield_label: null,
          portion_weight_unit: "KG",
          storage_instructions: null,
          shelf_life_frozen: null,
          shelf_life_refrigerated: null,
          shelf_life_room_temp: null,
          sector: setor.trim(),
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
          <DialogTitle>Nova Ficha Técnica</DialogTitle>
          <DialogDescription>
            Cadastre uma nova ficha técnica de forma rápida e simplificada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {erro ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {erro}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label htmlFor="ficha-rapida-nome">Nome da receita</Label>
              <Input
                id="ficha-rapida-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Bolo de cenoura"
              />
            </div>

            <div>
              <Label htmlFor="ficha-rapida-rendimento">Rendimento</Label>
              <Input
                id="ficha-rapida-rendimento"
                type="number"
                min="1"
                step="1"
                value={rendimento}
                onChange={(e) => setRendimento(toNumber(e.target.value, 1))}
              />
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="ficha-rapida-categoria">Categoria</Label>
              <select
                id="ficha-rapida-categoria"
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                <option value="">— Selecione —</option>
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="ficha-rapida-setor">Setor</Label>
              <select
                id="ficha-rapida-setor"
                className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={setor}
                onChange={(e) => setSetor(e.target.value)}
              >
                <option value="">— Selecione —</option>
                {SECTOR_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <IngredientEditor
            products={products}
            ingredientes={ingredientes}
            onChange={setIngredientes}
            uid={uid}
            formatCurrency={formatCurrency}
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="ficha-rapida-peso">Peso da porção</Label>
              <Input
                id="ficha-rapida-peso"
                type="number"
                min="0"
                step="0.001"
                value={pesoPorcao}
                onChange={(e) => setPesoPorcao(toNumber(e.target.value, 0))}
                placeholder="0"
              />
            </div>

            <div className="rounded-lg bg-slate-50 p-4">
              <h4 className="mb-3 font-semibold">Prévia automática</h4>

              <div className="grid grid-cols-1 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Custo total</p>
                  <p className="font-bold text-red-600">
                    {formatCurrency(preview.custoTotal)}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">Custo por porção</p>
                  <p className="font-bold text-red-600">
                    {formatCurrency(preview.custoPorPorcao)}
                  </p>
                </div>

                <div>
                  <p className="text-muted-foreground">Ingredientes cadastrados</p>
                  <p className="font-bold">{ingredientes.length}</p>
                </div>
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