"use client";

import { Button } from "@/components/ui/button";

type Ingrediente = {
  id: string;
  nome: string;
  quantidadeUso: number;
  unidadeUso: string;
  custoIngrediente: number;
};

type ModoPreparo = {
  id: string;
  ordem: number;
  descricao: string;
};

type EscalaIngrediente = {
  id: string;
  nome: string;
  quantidade: number;
  unidade: string;
};

type EscalaFicha = {
  id: string;
  label: string;
  rendimentoDescricao: string | null;
  pesoLiquido: number | null;
  ingredientes: EscalaIngrediente[];
};

type RecipeViewerProps = {
  nome: string;
  rendimento: string;
  ingredientes: Ingrediente[];
  modoPreparo: ModoPreparo[];
  escalas: EscalaFicha[];
  formatCurrency: (value: number) => string;
  onClose: () => void;
};

export default function RecipeViewer({
  nome,
  rendimento,
  ingredientes,
  modoPreparo,
  escalas,
  formatCurrency,
  onClose,
}: RecipeViewerProps) {
  const custoTotal = ingredientes.reduce(
    (acc, item) => acc + (item.custoIngrediente || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl rounded-xl bg-white p-6 shadow-xl">
        {/* HEADER */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{nome}</h2>
            <p className="text-sm text-gray-500">
              Rendimento: {rendimento || "—"}
            </p>
          </div>

          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>

        {/* CUSTO */}
        <div className="mb-6 rounded-lg bg-slate-50 p-4">
          <p className="text-sm text-gray-600">Custo total da receita</p>
          <p className="text-xl font-bold text-red-600">
            {formatCurrency(custoTotal)}
          </p>
        </div>

        {/* INGREDIENTES */}
        <div className="mb-6">
          <h3 className="mb-2 text-lg font-semibold">Ingredientes</h3>
          <div className="space-y-1 text-sm">
            {ingredientes.map((item) => (
              <div key={item.id} className="flex justify-between">
                <span>
                  {item.nome} — {item.quantidadeUso} {item.unidadeUso}
                </span>
                <span className="font-medium text-red-600">
                  {formatCurrency(item.custoIngrediente)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* MODO DE PREPARO */}
        <div className="mb-6">
          <h3 className="mb-2 text-lg font-semibold">Modo de preparo</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {modoPreparo
              .sort((a, b) => a.ordem - b.ordem)
              .map((step) => (
                <li key={step.id}>{step.descricao}</li>
              ))}
          </ol>
        </div>

        {/* ESCALAS */}
        {escalas.length > 0 && (
          <div>
            <h3 className="mb-3 text-lg font-semibold">Escalas</h3>

            <div className="space-y-4">
              {escalas.map((scale) => (
                <div key={scale.id} className="rounded-lg border p-3">
                  <div className="mb-2 flex justify-between">
                    <strong>{scale.label}</strong>
                    <span className="text-sm text-gray-500">
                      {scale.rendimentoDescricao || "—"}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm">
                    {scale.ingredientes.map((ing) => (
                      <div key={ing.id}>
                        {ing.nome} — {ing.quantidade} {ing.unidade}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}