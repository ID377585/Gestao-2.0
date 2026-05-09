"use client";

import { useEffect, useState, useTransition } from "react";
import {
  deleteFiscalProductMappingAction,
  listFiscalProductMappingsAction,
  listProductsForFiscalMappingAction,
  saveFiscalProductMappingAction,
} from "./actions";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

const EMPTY_FORM = {
  product_id: "",
  supplier_document: "",
  xml_code: "",
  xml_ean: "",
  xml_description: "",
  xml_unit: "",
};

export default function FiscalProductMappingsPage() {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [mappings, setMappings] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = async () => {
    try {
      setLoading(true);
      const [mappingsData, productsData] = await Promise.all([
        listFiscalProductMappingsAction(),
        listProductsForFiscalMappingAction(),
      ]);

      setMappings(Array.isArray(mappingsData) ? mappingsData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const updateField = (field: keyof typeof EMPTY_FORM, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = () => {
    const formData = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value);
    });

    startTransition(async () => {
      try {
        await saveFiscalProductMappingAction(formData);
        setForm(EMPTY_FORM);
        await loadData();
        alert("Vínculo fiscal salvo com sucesso.");
      } catch (error: any) {
        console.error(error);
        alert(error?.message || "Erro ao salvar vínculo fiscal.");
      }
    });
  };

  const handleDelete = (mappingId: string) => {
    const confirmed = window.confirm("Excluir este vínculo fiscal?");

    if (!confirmed) return;

    startTransition(async () => {
      try {
        await deleteFiscalProductMappingAction(mappingId);
        await loadData();
        alert("Vínculo fiscal excluído.");
      } catch (error: any) {
        console.error(error);
        alert(error?.message || "Erro ao excluir vínculo fiscal.");
      }
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Vínculos Fiscais de Produtos</h1>
        <p className="text-sm text-muted-foreground">
          Ensine o Gestify a relacionar itens do XML da NF-e aos produtos internos.
        </p>
      </div>

      <div className="border rounded-xl bg-card p-6 space-y-5">
        <div className="font-semibold">Novo vínculo</div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="space-y-2 xl:col-span-2">
            <label className="text-sm font-medium">Produto interno</label>
            <select
              value={form.product_id}
              onChange={(e) => updateField("product_id", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            >
              <option value="">Selecione um produto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name} {product.sku ? `— SKU ${product.sku}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CNPJ fornecedor</label>
            <input
              value={form.supplier_document}
              onChange={(e) => updateField("supplier_document", e.target.value)}
              placeholder="Opcional"
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Código XML</label>
            <input
              value={form.xml_code}
              onChange={(e) => updateField("xml_code", e.target.value)}
              placeholder="cProd"
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">EAN XML</label>
            <input
              value={form.xml_ean}
              onChange={(e) => updateField("xml_ean", e.target.value)}
              placeholder="cEAN"
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Unidade XML</label>
            <input
              value={form.xml_unit}
              onChange={(e) => updateField("xml_unit", e.target.value.toUpperCase())}
              placeholder="UN, KG, CX..."
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2 md:col-span-2 xl:col-span-3">
            <label className="text-sm font-medium">Descrição XML</label>
            <input
              value={form.xml_description}
              onChange={(e) => updateField("xml_description", e.target.value)}
              placeholder="Descrição exata ou semelhante do XML"
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm disabled:opacity-50"
          >
            {isPending ? "Salvando..." : "Salvar vínculo"}
          </button>
        </div>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden">
        <div className="p-4 border-b font-semibold">Vínculos cadastrados</div>

        {loading && (
          <div className="p-4 text-sm text-muted-foreground">
            Carregando vínculos...
          </div>
        )}

        {!loading && mappings.length === 0 && (
          <div className="p-4 text-sm text-muted-foreground">
            Nenhum vínculo cadastrado.
          </div>
        )}

        <div className="divide-y">
          {mappings.map((mapping) => {
            const product = mapping.products;

            return (
              <div
                key={mapping.id}
                className="grid grid-cols-1 xl:grid-cols-6 gap-4 p-4 text-sm items-center"
              >
                <div>
                  <div className="text-xs text-muted-foreground">Produto interno</div>
                  <div className="font-medium">{product?.name || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    SKU {product?.sku || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Fornecedor</div>
                  <div>{mapping.supplier_document || "Qualquer"}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Código/EAN XML</div>
                  <div>{mapping.xml_code || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {mapping.xml_ean || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Descrição XML</div>
                  <div>{mapping.xml_description || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">Unidade/Custo</div>
                  <div>{mapping.xml_unit || "—"}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatCurrency(Number(product?.standard_cost || product?.price || 0))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDelete(String(mapping.id))}
                    disabled={isPending}
                    className="border rounded-md px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
