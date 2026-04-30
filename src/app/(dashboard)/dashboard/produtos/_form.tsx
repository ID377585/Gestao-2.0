"use client";

import { useTransition } from "react";
import { createProduct, updateProduct } from "./actions";
import {
  ALLERGEN_OPTIONS,
  normalizeAllergenList,
} from "@/lib/allergens";

type ProductType = "INSU" | "PREP" | "PROD";
type StorageCategory = "Resfriado" | "Congelado" | "Temp. Ambiente";

type ProductFormProps = {
  product?: {
    id: string;
    sku: string | null;
    name: string;

    product_type: ProductType | null;

    // Qtd (peso/volume da embalagem) -> número
    package_qty: number | null;

    // Unidade padrão -> texto (KG, G, L, ML, UN)
    default_unit_label: string;

    qty_per_package: string | null;

    // Categoria (armazenamento)
    category: StorageCategory | null;

    price: number | null;
    conversion_factor: number | null;
    is_active: boolean;

    // ✅ Setor
    sector_category: string | null;

    // (Opcional) aparece no seu modal
    shelf_life_days?: number | null;
    allergens?: string[] | string | null;
  };
};

const UNIT_OPTIONS = ["UN", "KG", "G", "L", "ML"] as const;

const STORAGE_CATEGORIES: StorageCategory[] = [
  "Resfriado",
  "Congelado",
  "Temp. Ambiente",
];

const SECTOR_CATEGORIES = [
  "Confeitaria",
  "Padaria",
  "Açougue",
  "Produção",
  "Massaria",
  "Burrataria",

  "Hortifruti", // ✅ NOVO
  "Laticínios",
  "Pescados",
  "Frutos do Mar",
  "Carnes",

  "Secos", // ✅ ALTERADO (antes era “Estoque Secos”)

  "Embalagens",
  "Produto de Limpeza",
  "Descartáveis",
  "Bebidas",
] as const;

export function ProductForm({ product }: ProductFormProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(product?.id);

  function handleSubmit(formData: FormData) {
    startTransition(() => {
      if (isEdit) updateProduct(formData);
      else createProduct(formData);
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* 🔑 ID para update */}
      {isEdit && <input type="hidden" name="id" value={product!.id} />}

      <div>
        <label className="block text-sm font-medium">SKU</label>
        <input
          name="sku"
          defaultValue={product?.sku ?? ""}
          className="w-full rounded border px-3 py-2"
          placeholder="Ex.: 1001711"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Tipo</label>
        <select
          name="product_type"
          defaultValue={product?.product_type ?? "INSU"}
          className="w-full rounded border px-3 py-2"
        >
          <option value="INSU">INSU — Insumo</option>
          <option value="PREP">PREP — Pré-preparo</option>
          <option value="PROD">PROD — Produto acabado</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium">Nome do item</label>
        <input
          name="name"
          required
          defaultValue={product?.name ?? ""}
          className="w-full rounded border px-3 py-2"
          placeholder="Ex.: Farinha de Trigo, Creme Base Chocolate..."
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">
            Qtd (peso/volume da embalagem)
          </label>
          <input
            name="package_qty"
            type="number"
            step="0.001"
            defaultValue={product?.package_qty ?? ""}
            className="w-full rounded border px-3 py-2"
            placeholder="Ex.: 1, 2.5, 0.5"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Unidade padrão</label>
          <select
            name="default_unit_label"
            defaultValue={(product?.default_unit_label?.toUpperCase() as any) ?? "UN"}
            className="w-full rounded border px-3 py-2"
          >
            {UNIT_OPTIONS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Qtd. por Emb.</label>
          <input
            name="qty_per_package"
            defaultValue={product?.qty_per_package ?? ""}
            className="w-full rounded border px-3 py-2"
            placeholder="Ex.: 12 unidades, BDJ c/ 30 un"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Categoria (armazenamento)</label>
          <select
            name="category"
            defaultValue={product?.category ?? ""}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">— Selecione —</option>
            {STORAGE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ✅ Setor */}
      <div>
        <label className="block text-sm font-medium">Setor (Categoria)</label>
        <select
          name="sector_category"
          defaultValue={product?.sector_category ?? ""}
          className="w-full rounded border px-3 py-2"
        >
          <option value="">— Selecione —</option>
          {SECTOR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <p className="mt-1 text-xs text-muted-foreground">
          Use isso para identificar o setor responsável (e futuramente usar em Pedidos).
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium">Alergênico</label>
        <div className="mt-2 grid grid-cols-1 gap-2 rounded border px-3 py-2 sm:grid-cols-2">
          {ALLERGEN_OPTIONS.map((item) => (
            <label key={item} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="allergens"
                value={item}
                defaultChecked={normalizeAllergenList(
                  product?.allergens,
                ).includes(item)}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>

      {/* (Opcional) Shelf life */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Shelf life (dias)</label>
          <input
            name="shelf_life_days"
            type="number"
            step="1"
            defaultValue={product?.shelf_life_days ?? ""}
            className="w-full rounded border px-3 py-2"
            placeholder="Ex.: 3"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Dias corridos de vida útil após manipulação.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Preço / Custo padrão</label>
          <input
            name="price"
            type="number"
            step="0.01"
            defaultValue={product?.price ?? ""}
            className="w-full rounded border px-3 py-2"
            placeholder="0,00"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">Fator de conversão</label>
          <input
            name="conversion_factor"
            type="number"
            step="0.0001"
            defaultValue={product?.conversion_factor ?? 1}
            className="w-full rounded border px-3 py-2"
          />
        </div>

        <div className="flex items-center gap-2 pt-7">
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={product?.is_active ?? true}
          />
          <label>Status ativo</label>
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-60"
      >
        {isPending ? "Salvando..." : isEdit ? "Gravar alterações" : "Criar produto"}
      </button>
    </form>
  );
}
