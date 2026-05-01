"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type ProductOption,
  type Ingrediente,
  autoLinkIngredienteWithCatalog,
  buildProductLookupMap,
  calcularCustoIngrediente,
  findProductByIngredientName,
  getProductLinkedSnapshot,
  normalizeUnit,
  normalizeUnitGroup,
  toNumber,
} from "@/app/dashboard/fichas-tecnicas/lib/ingredient-product-matcher";

type IngredientEditorProps = {
  products: ProductOption[];
  ingredientes: Ingrediente[];
  onChange: (ingredientes: Ingrediente[]) => void;
  uid: () => string;
  formatCurrency: (value: number) => string;
};

function formatDecimal3(value: number) {
  if (!Number.isFinite(value)) return "0,000";

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

export default function IngredientEditor({
  products,
  ingredientes,
  onChange,
  uid,
  formatCurrency,
}: IngredientEditorProps) {
  const [showIngredientForm, setShowIngredientForm] = useState(
    ingredientes.length === 0
  );
  const [editandoIngredienteId, setEditandoIngredienteId] = useState<string | null>(
    null
  );
  const [draftIngredienteId, setDraftIngredienteId] = useState("");
  const [draftIngredienteNome, setDraftIngredienteNome] = useState("");
  const [draftQuantidadeUso, setDraftQuantidadeUso] = useState<number | "">("");
  const [draftUnidadeUso, setDraftUnidadeUso] = useState("UN");
  const [draftPrecoCompra, setDraftPrecoCompra] = useState<number>(0);
  const [draftQuantidadeCompra, setDraftQuantidadeCompra] = useState<number>(1);
  const [draftUnidadeCompra, setDraftUnidadeCompra] = useState("UN");
  const [draftFCorrecao, setDraftFCorrecao] = useState<number>(1);
  const [draftFCoccao, setDraftFCoccao] = useState<number>(1);

  const productsById = useMemo(() => {
    return new Map(products.map((product) => [product.id, product]));
  }, [products]);

  const productLookup = useMemo(() => {
    return buildProductLookupMap(products);
  }, [products]);

  const matchedDraftProduct = useMemo(() => {
    if (draftIngredienteId) {
      return productsById.get(draftIngredienteId) ?? null;
    }

    return findProductByIngredientName(
      draftIngredienteNome,
      productLookup,
      products
    );
  }, [draftIngredienteId, draftIngredienteNome, productLookup, productsById, products]);

  const previewIngrediente = useMemo(() => {
    const snapshot = matchedDraftProduct
      ? getProductLinkedSnapshot(matchedDraftProduct)
      : null;

    const unidadeUsoPreview = snapshot
      ? normalizeUnitGroup(draftUnidadeUso) ===
        normalizeUnitGroup(snapshot.unidadeBase)
        ? draftUnidadeUso
        : snapshot.unidadeBase
      : draftUnidadeUso;

    const unidadeCompraPreview = snapshot
      ? snapshot.unidadeBase
      : draftUnidadeCompra;

    return calcularCustoIngrediente({
      quantidadeUso: toNumber(draftQuantidadeUso, 0),
      unidadeUso: unidadeUsoPreview,
      precoCompra: snapshot ? snapshot.precoCompra : draftPrecoCompra,
      quantidadeCompra: snapshot ? snapshot.quantidadeCompra : draftQuantidadeCompra,
      unidadeCompra: unidadeCompraPreview,
      fatorCorrecao: draftFCorrecao,
      fatorCoccao: draftFCoccao,
    });
  }, [
    matchedDraftProduct,
    draftQuantidadeUso,
    draftUnidadeUso,
    draftPrecoCompra,
    draftQuantidadeCompra,
    draftUnidadeCompra,
    draftFCorrecao,
    draftFCoccao,
  ]);

  useEffect(() => {
    if (ingredientes.length === 0) {
      setShowIngredientForm(true);
    }
  }, [ingredientes.length]);

  useEffect(() => {
    if (!draftIngredienteId) return;

    const selectedProduct = productsById.get(draftIngredienteId);
    if (!selectedProduct) return;

    const snapshot = getProductLinkedSnapshot(selectedProduct);

    setDraftIngredienteNome(selectedProduct.name);
    setDraftUnidadeUso(snapshot.unidadeBase);
    setDraftUnidadeCompra(snapshot.unidadeBase);
    setDraftPrecoCompra(snapshot.precoCompra);
    setDraftQuantidadeCompra(snapshot.quantidadeCompra);
  }, [draftIngredienteId, productsById]);

  useEffect(() => {
    if (!ingredientes.length || !products.length) return;

    const synced = ingredientes.map((item) =>
      autoLinkIngredienteWithCatalog(item, productsById, productLookup, products)
    );

    const hasChanges = synced.some((item, index) => {
      const current = ingredientes[index];

      return (
        current.productId !== item.productId ||
        current.nome !== item.nome ||
        current.unidadeUso !== item.unidadeUso ||
        current.precoCompra !== item.precoCompra ||
        current.quantidadeCompra !== item.quantidadeCompra ||
        current.unidadeCompra !== item.unidadeCompra ||
        current.custoUnitarioBase !== item.custoUnitarioBase ||
        current.custoIngrediente !== item.custoIngrediente
      );
    });

    if (hasChanges) {
      onChange(synced);
    }
  }, [ingredientes, onChange, products.length, productsById, productLookup, products]);

  const resetDraftIngrediente = () => {
    setEditandoIngredienteId(null);
    setDraftIngredienteId("");
    setDraftIngredienteNome("");
    setDraftQuantidadeUso("");
    setDraftUnidadeUso("UN");
    setDraftPrecoCompra(0);
    setDraftQuantidadeCompra(1);
    setDraftUnidadeCompra("UN");
    setDraftFCorrecao(1);
    setDraftFCoccao(1);
  };

  const iniciarNovoIngrediente = () => {
    resetDraftIngrediente();
    setShowIngredientForm(true);
  };

  const onSelectProductIngredient = (productId: string) => {
    setDraftIngredienteId(productId);

    if (!productId) {
      setDraftIngredienteNome("");
      setDraftUnidadeUso("UN");
      setDraftUnidadeCompra("UN");
      setDraftPrecoCompra(0);
      setDraftQuantidadeCompra(1);
      return;
    }

    const product = productsById.get(productId);
    if (!product) return;

    const snapshot = getProductLinkedSnapshot(product);

    setDraftIngredienteNome(product.name);
    setDraftUnidadeUso(snapshot.unidadeBase);
    setDraftUnidadeCompra(snapshot.unidadeBase);
    setDraftPrecoCompra(snapshot.precoCompra);
    setDraftQuantidadeCompra(snapshot.quantidadeCompra);
  };

  const salvarIngrediente = () => {
    const productFromSelect = draftIngredienteId
      ? productsById.get(draftIngredienteId) ?? null
      : null;

    const productFromName =
      !productFromSelect && draftIngredienteNome.trim()
        ? findProductByIngredientName(draftIngredienteNome, productLookup, products)
        : null;

    const selectedProduct = productFromSelect ?? productFromName;

    const selectedSnapshot = selectedProduct
      ? getProductLinkedSnapshot(selectedProduct)
      : null;

    const quantidadeUso = toNumber(draftQuantidadeUso, 0);
    const precoCompra = selectedSnapshot
      ? selectedSnapshot.precoCompra
      : toNumber(draftPrecoCompra, 0);
    const quantidadeCompra = selectedSnapshot
      ? selectedSnapshot.quantidadeCompra
      : toNumber(draftQuantidadeCompra, 0);
    const unidadeUso = selectedSnapshot
      ? normalizeUnitGroup(draftUnidadeUso) ===
        normalizeUnitGroup(selectedSnapshot.unidadeBase)
        ? normalizeUnit(draftUnidadeUso, "UN")
        : selectedSnapshot.unidadeBase
      : normalizeUnit(draftUnidadeUso, "UN");
    const unidadeCompra = selectedSnapshot
      ? selectedSnapshot.unidadeBase
      : normalizeUnit(draftUnidadeCompra, "UN");
    const fatorCorrecao = toNumber(draftFCorrecao, 1) || 1;
    const fatorCoccao = toNumber(draftFCoccao, 1) || 1;

    const nomeIngrediente = selectedProduct?.name || draftIngredienteNome.trim();

    if (!nomeIngrediente.trim()) {
      alert("Selecione ou informe um ingrediente.");
      return;
    }

    if (quantidadeUso <= 0) {
      alert("Informe uma quantidade de uso válida.");
      return;
    }

    if (quantidadeCompra <= 0) {
      alert("Informe uma quantidade de compra válida.");
      return;
    }

    const calculo = calcularCustoIngrediente({
      quantidadeUso,
      unidadeUso,
      precoCompra,
      quantidadeCompra,
      unidadeCompra,
      fatorCorrecao,
      fatorCoccao,
    });

    const payload: Ingrediente = {
      id: editandoIngredienteId || uid(),
      productId: selectedProduct?.id || null,
      nome: nomeIngrediente,
      quantidadeUso,
      unidadeUso,
      precoCompra,
      quantidadeCompra,
      unidadeCompra,
      custoUnitarioBase: calculo.custoUnitarioBase,
      custoIngrediente: calculo.custoIngrediente,
      fatorCorrecao,
      fatorCoccao,
    };

    if (editandoIngredienteId) {
      onChange(
        ingredientes.map((item) =>
          item.id === editandoIngredienteId ? payload : item
        )
      );
    } else {
      onChange([...ingredientes, payload]);
    }

    setShowIngredientForm(true);
    resetDraftIngrediente();
  };

  const editarIngrediente = (id: string) => {
    const item = ingredientes.find((ing) => ing.id === id);
    if (!item) return;

    const autoMatchedProduct =
      (item.productId ? productsById.get(item.productId) ?? null : null) ??
      findProductByIngredientName(item.nome, productLookup, products);

    setShowIngredientForm(true);
    setEditandoIngredienteId(item.id);
    setDraftIngredienteId(autoMatchedProduct?.id || "");
    setDraftIngredienteNome(item.nome);
    setDraftQuantidadeUso(item.quantidadeUso);
    setDraftUnidadeUso(item.unidadeUso);
    setDraftPrecoCompra(item.precoCompra);
    setDraftQuantidadeCompra(item.quantidadeCompra);
    setDraftUnidadeCompra(item.unidadeCompra);
    setDraftFCorrecao(item.fatorCorrecao);
    setDraftFCoccao(item.fatorCoccao);
  };

  const removerIngrediente = (id: string) => {
    onChange(ingredientes.filter((item) => item.id !== id));
    if (editandoIngredienteId === id) {
      resetDraftIngrediente();
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold">Ingredientes</h4>
          <p className="text-sm text-muted-foreground">
            Adicione, edite ou remova ingredientes da ficha técnica.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={iniciarNovoIngrediente}>
            {editandoIngredienteId ? "Novo ingrediente" : "Adicionar ingrediente"}
          </Button>

          {showIngredientForm && ingredientes.length > 0 && !editandoIngredienteId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowIngredientForm(false)}
            >
              Ocultar formulário
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        {showIngredientForm ? (
          <div className="space-y-4 rounded-lg border border-dashed bg-slate-50/70 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  {editandoIngredienteId ? "Editando ingrediente" : "Novo ingrediente"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Preencha os dados abaixo e salve para atualizar a ficha.
                </p>
              </div>

              {editandoIngredienteId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditandoIngredienteId(null)}
                  className="border-red-500 text-red-600 font-semibold shadow-md hover:bg-red-50 hover:text-red-700 hover:border-red-600 hover:shadow-lg transition-all duration-200"
                >
                  Cancelar edição
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
              <div className="md:col-span-3">
                <Label>Produto cadastrado</Label>
                <select
                  className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={draftIngredienteId}
                  onChange={(e) => onSelectProductIngredient(e.target.value)}
                >
                  <option value="">— Selecionar produto —</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {draftIngredienteId ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Produto vinculado: unidade, preço e qtd. comprada acompanham o cadastro de Produtos.
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-3">
                <Label>Ingrediente</Label>
                <Input
                  value={draftIngredienteNome}
                  onChange={(e) => setDraftIngredienteNome(e.target.value)}
                  placeholder="Nome do ingrediente"
                />

                {!draftIngredienteId && matchedDraftProduct ? (
                  <p className="mt-1 text-xs text-emerald-700">
                    Produto encontrado automaticamente no catálogo: {matchedDraftProduct.name}
                  </p>
                ) : null}
              </div>

              <div>
                <Label>Qtd de uso</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  placeholder=""
                  value={draftQuantidadeUso === "" ? "" : draftQuantidadeUso}
                  onChange={(e) =>
                    setDraftQuantidadeUso(
                      e.target.value === "" ? "" : Number(e.target.value)
                    )
                  }
                />
              </div>

              <div className="md:col-span-2">
                <Label>Unidade de uso</Label>
                <Input
                  value={
                    matchedDraftProduct
                      ? normalizeUnitGroup(draftUnidadeUso) ===
                        normalizeUnitGroup(
                          getProductLinkedSnapshot(matchedDraftProduct).unidadeBase
                        )
                        ? draftUnidadeUso
                        : getProductLinkedSnapshot(matchedDraftProduct).unidadeBase
                      : draftUnidadeUso
                  }
                  onChange={(e) =>
                    setDraftUnidadeUso(normalizeUnit(e.target.value, "UN"))
                  }
                />
              </div>

              <div className="md:col-span-2">
                <Label>Preço da compra</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={
                    matchedDraftProduct
                      ? getProductLinkedSnapshot(matchedDraftProduct).precoCompra
                      : draftPrecoCompra
                  }
                  onChange={(e) => setDraftPrecoCompra(toNumber(e.target.value, 0))}
                  disabled={Boolean(matchedDraftProduct)}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Qtd comprada</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={
                    matchedDraftProduct
                      ? getProductLinkedSnapshot(matchedDraftProduct).quantidadeCompra
                      : draftQuantidadeCompra
                  }
                  onChange={(e) =>
                    setDraftQuantidadeCompra(toNumber(e.target.value, 1))
                  }
                  disabled={Boolean(matchedDraftProduct)}
                />
              </div>

              <div className="md:col-span-2">
                <Label>Unidade compra</Label>
                <Input
                  value={
                    matchedDraftProduct
                      ? getProductLinkedSnapshot(matchedDraftProduct).unidadeBase
                      : draftUnidadeCompra
                  }
                  onChange={(e) =>
                    setDraftUnidadeCompra(normalizeUnit(e.target.value, "UN"))
                  }
                  disabled={Boolean(matchedDraftProduct)}
                />
              </div>

              <div className="md:col-span-2">
                <Label>F. Correção</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draftFCorrecao}
                  onChange={(e) => setDraftFCorrecao(toNumber(e.target.value, 1))}
                />
              </div>

              <div className="md:col-span-2">
                <Label>F. Cocção</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={draftFCoccao}
                  onChange={(e) => setDraftFCoccao(toNumber(e.target.value, 1))}
                />
              </div>

              <div className="md:col-span-4 flex flex-wrap items-end gap-2">
                <Button
                  type="button"
                  className="w-full sm:flex-1 bg-emerald-600 text-white font-semibold shadow-md hover:bg-emerald-700 hover:shadow-lg transition-all duration-200"
                  onClick={salvarIngrediente}
                >
                  {editandoIngredienteId ? "Salvar ingrediente" : "Adicionar ingrediente"}
              </Button>

                {!editandoIngredienteId && ingredientes.length > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowIngredientForm(false)}
                  >
                    Fechar
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 text-sm">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <p className="text-gray-600">Custo unitário base</p>
                  <p className="font-bold">
                    {formatCurrency(previewIngrediente.custoUnitarioBase)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Custo final do ingrediente</p>
                  <p className="font-bold text-red-600">
                    {formatCurrency(previewIngrediente.custoIngrediente)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Itens cadastrados</p>
                  <p className="font-medium">{ingredientes.length}</p>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {ingredientes.length === 0 ? (
          <p className="text-sm text-gray-600">
            Nenhum ingrediente adicionado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[920px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Ingrediente</TableHead>
                  <TableHead>Uso</TableHead>
                  <TableHead>Compra</TableHead>
                  <TableHead>Preço compra</TableHead>
                  <TableHead>Custo unit.</TableHead>
                  <TableHead>Custo final</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ingredientes.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div>{item.nome}</div>
                        {item.productId ? (
                          <div className="text-xs text-emerald-700">
                            Vinculado ao catálogo
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDecimal3(item.quantidadeUso)} {item.unidadeUso}
                    </TableCell>
                    <TableCell>
                      {formatDecimal3(item.quantidadeCompra)} {item.unidadeCompra}
                    </TableCell>
                    <TableCell>{formatCurrency(item.precoCompra)}</TableCell>
                    <TableCell>{formatCurrency(item.custoUnitarioBase)}</TableCell>
                    <TableCell className="font-medium text-red-600">
                      {formatCurrency(item.custoIngrediente)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => editarIngrediente(item.id)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => removerIngrediente(item.id)}
                        >
                          Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}