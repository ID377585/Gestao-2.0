"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

type ScaleEditorProps = {
  scales: EscalaFicha[];
  onChange: (scales: EscalaFicha[]) => void;
  uid: () => string;
  toNumber: (value: unknown, fallback?: number) => number;
  normalizeUnit: (value: unknown, fallback?: string) => string;
};

export default function ScaleEditor({
  scales,
  onChange,
  uid,
  toNumber,
  normalizeUnit,
}: ScaleEditorProps) {
  const addScale = () => {
    onChange([
      ...scales,
      {
        id: uid(),
        label: `Escala ${scales.length + 1}`,
        rendimentoDescricao: "",
        pesoLiquido: null,
        ingredientes: [],
      },
    ]);
  };

  const updateScale = (scaleId: string, patch: Partial<EscalaFicha>) => {
    onChange(
      scales.map((scale) => (scale.id === scaleId ? { ...scale, ...patch } : scale))
    );
  };

  const removeScale = (scaleId: string) => {
    onChange(scales.filter((scale) => scale.id !== scaleId));
  };

  const addScaleIngredient = (scaleId: string) => {
    onChange(
      scales.map((scale) =>
        scale.id === scaleId
          ? {
              ...scale,
              ingredientes: [
                ...scale.ingredientes,
                {
                  id: uid(),
                  nome: "",
                  quantidade: 0,
                  unidade: "G",
                },
              ],
            }
          : scale
      )
    );
  };

  const updateScaleIngredient = (
    scaleId: string,
    ingredientId: string,
    patch: Partial<EscalaIngrediente>
  ) => {
    onChange(
      scales.map((scale) =>
        scale.id === scaleId
          ? {
              ...scale,
              ingredientes: scale.ingredientes.map((ingredient) =>
                ingredient.id === ingredientId
                  ? { ...ingredient, ...patch }
                  : ingredient
              ),
            }
          : scale
      )
    );
  };

  const removeScaleIngredient = (scaleId: string, ingredientId: string) => {
    onChange(
      scales.map((scale) =>
        scale.id === scaleId
          ? {
              ...scale,
              ingredientes: scale.ingredientes.filter(
                (ingredient) => ingredient.id !== ingredientId
              ),
            }
          : scale
      )
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="text-lg font-semibold">Escalas</h4>
          <p className="text-sm text-muted-foreground">
            Cadastre 1X, 2X, 3X ou qualquer outra escala da ficha.
          </p>
        </div>

        <Button type="button" variant="outline" onClick={addScale}>
          ➕ Adicionar escala
        </Button>
      </div>

      {scales.length === 0 ? (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Nenhuma escala cadastrada ainda.
        </div>
      ) : (
        scales.map((scale) => (
          <div key={scale.id} className="rounded-xl border p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <Label>Label</Label>
                <Input
                  value={scale.label}
                  onChange={(e) => updateScale(scale.id, { label: e.target.value })}
                  placeholder="Ex.: 1X"
                />
              </div>

              <div>
                <Label>Rendimento</Label>
                <Input
                  value={scale.rendimentoDescricao ?? ""}
                  onChange={(e) =>
                    updateScale(scale.id, {
                      rendimentoDescricao: e.target.value || null,
                    })
                  }
                  placeholder="Ex.: 4 assadeiras"
                />
              </div>

              <div>
                <Label>Peso líquido</Label>
                <Input
                  type="number"
                  value={scale.pesoLiquido ?? ""}
                  onChange={(e) =>
                    updateScale(scale.id, {
                      pesoLiquido:
                        e.target.value === "" ? null : toNumber(e.target.value, 0),
                    })
                  }
                  placeholder="Ex.: 1200"
                />
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => removeScale(scale.id)}
                >
                  Remover escala
                </Button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Ingredientes da escala</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addScaleIngredient(scale.id)}
                >
                  Adicionar ingrediente
                </Button>
              </div>

              {scale.ingredientes.length === 0 ? (
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-muted-foreground">
                  Nenhum ingrediente cadastrado para esta escala.
                </div>
              ) : (
                <div className="space-y-3">
                  {scale.ingredientes.map((ingredient) => (
                    <div
                      key={ingredient.id}
                      className="grid grid-cols-1 gap-3 rounded-lg border p-3 md:grid-cols-[2fr_1fr_1fr_auto]"
                    >
                      <div>
                        <Label>Ingrediente</Label>
                        <Input
                          value={ingredient.nome}
                          onChange={(e) =>
                            updateScaleIngredient(scale.id, ingredient.id, {
                              nome: e.target.value,
                            })
                          }
                          placeholder="Nome do ingrediente"
                        />
                      </div>

                      <div>
                        <Label>Quantidade</Label>
                        <Input
                          type="number"
                          value={ingredient.quantidade}
                          onChange={(e) =>
                            updateScaleIngredient(scale.id, ingredient.id, {
                              quantidade: toNumber(e.target.value, 0),
                            })
                          }
                        />
                      </div>

                      <div>
                        <Label>Unidade</Label>
                        <Input
                          value={ingredient.unidade}
                          onChange={(e) =>
                            updateScaleIngredient(scale.id, ingredient.id, {
                              unidade: normalizeUnit(e.target.value, "G"),
                            })
                          }
                        />
                      </div>

                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() =>
                            removeScaleIngredient(scale.id, ingredient.id)
                          }
                        >
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}