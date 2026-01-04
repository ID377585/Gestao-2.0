"use client";

import { useTransition } from "react";
import { createProduct, updateProduct } from "./actions";

    type ProductFormProps = {
    product?: {
        id: string;
        sku: string | null;
        name: string;
        product_type: "INSU" | "PREP" | "PROD";
        default_unit_label: string;
        package_qty: number | null;
        qty_per_package: string | null;
        category: string | null;
        price: number | null;
        conversion_factor: number | null;
        is_active: boolean;
    };
    };

    export function ProductForm({ product }: ProductFormProps) {
    const [isPending, startTransition] = useTransition();

    const isEdit = Boolean(product?.id);

    function handleSubmit(formData: FormData) {
        startTransition(() => {
        if (isEdit) {
            updateProduct(formData);
        } else {
            createProduct(formData);
        }
        });
    }

    return (
        <form action={handleSubmit} className="space-y-4">
        {/* 🔑 ID OBRIGATÓRIO PARA UPDATE */}
        {isEdit && (
            <input
            type="hidden"
            name="id"
            value={product!.id}
            />
        )}

        <div>
            <label className="block text-sm font-medium">SKU</label>
            <input
            name="sku"
            defaultValue={product?.sku ?? ""}
            className="w-full rounded border px-3 py-2"
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
            />
            </div>

            <div>
            <label className="block text-sm font-medium">
                Unidade padrão
            </label>
            <input
                name="default_unit_label"
                defaultValue={product?.default_unit_label ?? "un"}
                className="w-full rounded border px-3 py-2"
            />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
            <label className="block text-sm font-medium">Qtd. por Emb.</label>
            <input
                name="qty_per_package"
                defaultValue={product?.qty_per_package ?? ""}
                className="w-full rounded border px-3 py-2"
            />
            </div>

            <div>
            <label className="block text-sm font-medium">Categoria</label>
            <input
                name="category"
                defaultValue={product?.category ?? ""}
                className="w-full rounded border px-3 py-2"
            />
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
            <label className="block text-sm font-medium">
                Preço / Custo padrão
            </label>
            <input
                name="price"
                type="number"
                step="0.01"
                defaultValue={product?.price ?? ""}
                className="w-full rounded border px-3 py-2"
            />
            </div>

            <div>
            <label className="block text-sm font-medium">
                Fator de conversão
            </label>
            <input
                name="conversion_factor"
                type="number"
                step="0.0001"
                defaultValue={product?.conversion_factor ?? 1}
                className="w-full rounded border px-3 py-2"
            />
            </div>
        </div>

        <div className="flex items-center gap-2">
            <input
            type="checkbox"
            name="is_active"
            defaultChecked={product?.is_active ?? true}
            />
            <label>Status ativo</label>
        </div>

        <button
            type="submit"
            disabled={isPending}
            className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        >
            {isPending
            ? "Salvando..."
            : isEdit
            ? "Gravar alterações"
            : "Criar produto"}
        </button>
        </form>
    );
    }
