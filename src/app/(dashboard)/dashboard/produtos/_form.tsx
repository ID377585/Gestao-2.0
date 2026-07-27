"use client";

import { formatPtBrDecimal } from "@/lib/number-format";
import { createProduct, updateProduct } from "./actions";
import { ProductSubmitButton } from "./ProductSubmitButton";
import {
  ALLERGEN_OPTIONS,
  normalizeAllergenList,
} from "@/lib/allergens";
import {
  PRODUCT_SECTOR_CATEGORIES,
  normalizeProductSectorCategory,
} from "@/lib/product-sectors";
import {
  PRODUCT_ABC_CURVES,
  normalizeProductAbcCurve,
} from "@/lib/product-curves";

type ProductType = "INSU" | "PREP" | "PROD";
type StorageCategory = "Resfriado" | "Congelado" | "Temp. Ambiente";

type ProductFormProps = {
  product?: {
    id: string;
    sku: string | null;
    name: string;
    product_type: ProductType | null;
    package_qty: number | null;
    default_unit_label: string;
    qty_per_package: string | null;
    category: StorageCategory | null;
    price: number | null;
    conversion_factor: number | null;
    is_active: boolean;
    sector_category: string | null;
    abc_curve?: "A" | "B" | "C" | string | null;
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

export function ProductForm({ product }: ProductFormProps) {
  const isEdit = Boolean(product?.id);

  function handleSubmit(formData: FormData) {
    if (isEdit) updateProduct(formData);
    else createProduct(formData);
  }

  return (
    <form action={handleSubmit} className="space-y-4">
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
            type="text"
            inputMode="decimal"
            defaultValue={
              product?.package_qty !== null &&
              product?.package_qty !== undefined
                ? formatPtBrDecimal(product.package_qty, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 3,
                  })
                : ""
            }
            className="w-full rounded border px-3 py-2"
            placeholder="Ex.: 6,438"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Use vírgula para decimal. Ex.: 6,438 KG.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium">Unidade padrão</label>
          <select
            name="default_unit_label"
            defaultValue={
              (product?.default_unit_label?.toUpperCase() as any) ?? "UN"
            }
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
            placeholder="Ex.: KILO, 12 unidades, BDJ c/ 30 un"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">
            Categoria (armazenamento)
          </label>
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

      <div>
        <label className="block text-sm font-medium">Setor (Categoria)</label>
        <select
          name="sector_category"
          defaultValue={
            normalizeProductSectorCategory(product?.sector_category) ?? ""
          }
          className="w-full rounded border px-3 py-2"
        >
          <option value="">— Selecione —</option>
          {PRODUCT_SECTOR_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <p className="mt-1 text-xs text-muted-foreground">
          Use isso para identificar o setor responsável.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium">Curva do produto</label>
        <select
          name="abc_curve"
          defaultValue={normalizeProductAbcCurve(product?.abc_curve) ?? ""}
          className="w-full rounded border px-3 py-2"
        >
          <option value="">— Selecione —</option>
          {PRODUCT_ABC_CURVES.map((curve) => (
            <option key={curve} value={curve}>
              {curve}
            </option>
          ))}
        </select>
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
                  product?.allergens
                ).includes(item)}
              />
              <span>{item}</span>
            </label>
          ))}
        </div>
      </div>

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
          <label className="block text-sm font-medium">
            Preço / Custo padrão
          </label>
          <input
            name="price"
            type="text"
            inputMode="decimal"
            defaultValue={
              product?.price !== null && product?.price !== undefined
                ? formatPtBrDecimal(product.price, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })
                : ""
            }
            className="w-full rounded border px-3 py-2"
            placeholder="Ex.: 92,50"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Use vírgula para centavos. Ex.: 92,50.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium">
            Fator de conversão
          </label>
          <input
            name="conversion_factor"
            type="text"
            inputMode="decimal"
            defaultValue={
              product?.conversion_factor !== null &&
              product?.conversion_factor !== undefined
                ? formatPtBrDecimal(product.conversion_factor, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 4,
                  })
                : "1"
            }
            className="w-full rounded border px-3 py-2"
            placeholder="Ex.: 1"
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

      <ProductSubmitButton
        idleLabel={isEdit ? "Gravar alterações" : "Criar produto"}
        pendingLabel={isEdit ? "Gravando..." : "Registrando..."}
        className="w-full"
      />
    </form>
  );
}
