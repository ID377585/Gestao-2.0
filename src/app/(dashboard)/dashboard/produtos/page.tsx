import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";
import { createProduct, deleteProduct, updateProduct } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const UNIT_OPTIONS = ["UN", "KG", "G", "L", "ML"] as const;
const STORAGE_CATEGORIES = ["Resfriado", "Congelado", "Temp. Ambiente"] as const;

type ProductRow = {
  id: string;
  sku: string | null;
  name: string;
  brand: string | null;
  product_type: "INSU" | "PREP" | "PROD" | string;
  default_unit_label: string | null;
  package_qty: number | null;
  qty_per_package: string | null;
  category: string | null;
  sector_category: string | null;
  abc_curve: "A" | "B" | "C" | string | null;
  shelf_life_days: number | null;
  is_active: boolean | null;
  price: number | null;
  allergens: string[] | string | null;
  created_at: string | null;
  created_by: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type PageProps = {
  searchParams?: Promise<{
    success?: string;
    error?: string;
  }>;
};

function getProductTypeLabel(type: ProductRow["product_type"]) {
  switch (type) {
    case "INSU":
      return "Insumo";
    case "PREP":
      return "Pré-preparo";
    case "PROD":
      return "Produto";
    default:
      return type;
  }
}

function formatCurrency(value: number | null | undefined) {
  if (value == null) return "-";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatQty(value: number | null | undefined) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 3,
  }).format(value);
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const { membership } = await getActiveMembershipOrRedirect();
  const establishmentId = String((membership as any)?.establishment_id ?? "").trim();

  const supabase = await createSupabaseServerClient();

  if (!establishmentId) {
    throw new Error("Estabelecimento não encontrado para carregar produtos.");
  }

  const { data, error } = await supabase
    .from("products")
    .select(
      "id, sku, name, brand, product_type, default_unit_label, package_qty, qty_per_package, category, sector_category, abc_curve, shelf_life_days, is_active, price, allergens, created_at, created_by",
    )
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("product_type", { ascending: true })
    .order("name", { ascending: true });

  const products: ProductRow[] = (data ?? []) as ProductRow[];

  if (error) {
    console.error("Erro ao carregar produtos:", error);
  }

  const sectorCounts = PRODUCT_SECTOR_CATEGORIES.map((sector) => {
    const count = products.filter(
      (p) => (p.sector_category ?? "").trim() === sector,
    ).length;

    return { sector, count };
  });

  const totalWithSector = products.filter((p) =>
    Boolean((p.sector_category ?? "").trim()),
  ).length;

  const totalWithoutSector = products.length - totalWithSector;

  let userMap: Record<string, ProfileRow> = {};
  if (products.length > 0) {
    const userIds = Array.from(
      new Set(
        products
          .map((p) => p.created_by)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profilesError) {
        console.error("Erro ao carregar perfis:", profilesError);
      } else {
        userMap = (profilesData ?? []).reduce<Record<string, ProfileRow>>(
          (acc, profile) => {
            acc[profile.id] = profile as ProfileRow;
            return acc;
          },
          {},
        );
      }
    }
  }

  const lastUploadProduct = products.reduce<ProductRow | null>(
    (latest, current) => {
      if (!current.created_at) return latest;
      if (!latest || !latest.created_at) return current;
      return new Date(current.created_at) > new Date(latest.created_at)
        ? current
        : latest;
    },
    null,
  );

  const lastUploadProfile =
    lastUploadProduct?.created_by &&
    userMap[lastUploadProduct.created_by as string]
      ? userMap[lastUploadProduct.created_by as string]
      : null;

  const lastUploadUserName =
    lastUploadProfile?.full_name || lastUploadProduct?.created_by || null;

  const success = (await searchParams)?.success;
  const errorMsg = (await searchParams)?.error;

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          Erro: {decodeURIComponent(errorMsg)}
        </div>
      )}

      {success === "new" && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
          Produto cadastrado com sucesso!
        </div>
      )}

      {success === "updated" && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
          Produto ajustado com sucesso!
        </div>
      )}

      {success === "deleted" && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
          Produto excluído com sucesso!
        </div>
      )}

      {success === "import" && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
          Produtos importados com sucesso!
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground max-w-prose mx-auto sm:mx-0">
            Cadastro de <strong>insumos (INSU)</strong>,{" "}
            <strong>pré-preparos (PREP)</strong> e{" "}
            <strong>produtos acabados (PROD)</strong>. Esta tabela é a base para
            etiquetas, estoque, fichas técnicas e produção.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="w-full sm:w-auto">
                + Novo item
              </Button>
            </DialogTrigger>

            <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg bg-white text-foreground">
              <DialogHeader>
                <DialogTitle>Novo produto</DialogTitle>
              </DialogHeader>

              <form action={createProduct} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU / Código do item</Label>
                    <Input id="sku" name="sku" placeholder="Ex.: 1001711" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="product_type">Tipo</Label>
                    <select
                      id="product_type"
                      name="product_type"
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                      defaultValue="INSU"
                      required
                    >
                      <option value="INSU">INSU — Insumo</option>
                      <option value="PREP">PREP — Pré-preparo</option>
                      <option value="PROD">PROD — Produto acabado</option>
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="name">Nome do item</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Ex.: Farinha de Trigo, Creme Base Chocolate..."
                      required
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="brand">Marca</Label>
                    <Input
                      id="brand"
                      name="brand"
                      placeholder="Ex.: Nestlé, Seara, Sadia"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="package_qty">
                      Qtd (peso/volume da embalagem)
                    </Label>
                    <Input
                      id="package_qty"
                      name="package_qty"
                      type="number"
                      step="0.001"
                      min="0"
                      placeholder="Ex.: 1, 2,5, 0,5"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="default_unit_label">Unidade padrão</Label>
                    <select
                      id="default_unit_label"
                      name="default_unit_label"
                      defaultValue="UN"
                      required
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {UNIT_OPTIONS.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="qty_per_package">Qtd. por Emb.</Label>
                    <Input
                      id="qty_per_package"
                      name="qty_per_package"
                      placeholder="Ex.: 12 unidades, 6 bandejas, 1 PAC C/ 1KG"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria (armazenamento)</Label>
                    <select
                      id="category"
                      name="category"
                      defaultValue=""
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">— Selecione —</option>
                      {STORAGE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="abc_curve">Curva do produto</Label>
                    <select
                      id="abc_curve"
                      name="abc_curve"
                      defaultValue=""
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">— Selecione —</option>
                      {PRODUCT_ABC_CURVES.map((curve) => (
                        <option key={curve} value={curve}>
                          {curve}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="sector_category">Setor (Categoria)</Label>
                    <select
                      id="sector_category"
                      name="sector_category"
                      defaultValue=""
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">— Selecione —</option>
                      {PRODUCT_SECTOR_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Use isso para identificar o setor responsável.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label>Alergênico</Label>
                    <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
                      {ALLERGEN_OPTIONS.map((item) => (
                        <label key={item} className="flex items-center gap-2 text-sm">
                          <input type="checkbox" name="allergens" value={item} />
                          <span>{item}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="shelf_life_days">Shelf life (dias)</Label>
                    <Input
                      id="shelf_life_days"
                      name="shelf_life_days"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Ex.: 3"
                    />
                  </div>

                  <div className="space-y-2">
                    <Input
                      id="price"
                      name="price"
                      type="text"
                      inputMode="decimal"
                      pattern="^[0-9]+([,.][0-9]{1,5})?$"
                      placeholder="0,00000"
                      title="Informe o valor no formato 0,00000. Exemplo: 8,25583"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="conversion_factor">
                      Fator de conversão (opcional)
                    </Label>
                    <Input
                      id="conversion_factor"
                      name="conversion_factor"
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="1"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="submit">Salvar produto</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <form action="/api/export/products" method="GET" className="w-full sm:w-auto">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full sm:w-auto border-gray-300 hover:bg-gray-100"
            >
              ⬇️ Exportar
            </Button>
          </form>

          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto border-green-400 text-green-700 bg-green-50 hover:bg-green-100"
              >
                ⬆️ Importar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white text-foreground">
              <DialogHeader>
                <DialogTitle>Importar planilha de produtos</DialogTitle>
              </DialogHeader>

              <form
                action="/api/import/products"
                method="POST"
                encType="multipart/form-data"
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="file">Arquivo (.csv) com os produtos</Label>
                  <Input
                    id="file"
                    name="file"
                    type="file"
                    accept=".csv"
                    required
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Dica: use o modelo exportado em{" "}
                  <strong>Exportar &gt; produtos.csv</strong> para manter os
                  campos padronizados.
                </p>

                <Button
                  type="submit"
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                >
                  Enviar e processar
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo por setor</CardTitle>
          <CardDescription>
            Quantidade de itens cadastrados por setor (categoria).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {sectorCounts.map(({ sector, count }) => (
              <Badge key={sector} variant="secondary" className="px-3 py-1">
                {sector}: <strong className="ml-1">{count}</strong>
              </Badge>
            ))}
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Total de itens: <strong>{products.length}</strong> • Com setor:{" "}
            <strong>{totalWithSector}</strong> • Sem setor:{" "}
            <strong>{totalWithoutSector}</strong>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Lista de produtos</CardTitle>
          <CardDescription>
            Produtos disponíveis para uso em etiquetas, estoque, produção e
            fichas técnicas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum produto cadastrado ainda. Clique em{" "}
              <strong>&quot;Novo item&quot;</strong> para cadastrar o primeiro.
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table className="min-w-[1600px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-30 w-[110px] min-w-[110px] bg-white dark:bg-slate-950">
                        Tipo
                      </TableHead>
                      <TableHead className="sticky left-[110px] z-30 w-[130px] min-w-[130px] bg-white dark:bg-slate-950">
                        SKU
                      </TableHead>
                      <TableHead className="sticky left-[240px] z-30 min-w-[340px] bg-white shadow-[4px_0_8px_-6px_rgba(0,0,0,0.18)] dark:bg-slate-950">
                        Nome
                      </TableHead>
                      <TableHead className="w-[160px]">Marca</TableHead>
                      <TableHead className="w-[110px] text-center">Qtd</TableHead>
                      <TableHead className="w-[80px]">Unidade</TableHead>
                      <TableHead className="w-[160px] text-center">
                        Qtd. por Emb.
                      </TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead className="w-[80px] text-center">Curva</TableHead>
                      <TableHead className="w-[140px] text-center">
                        Shelf life (dias)
                      </TableHead>
                      <TableHead className="w-[110px] text-right">
                        Preço / Custo
                      </TableHead>
                      <TableHead className="w-[80px] text-center">Status</TableHead>
                      <TableHead className="w-[90px] text-center">Ações</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell className="sticky left-0 z-20 w-[110px] min-w-[110px] bg-white dark:bg-slate-950">
                          <Badge variant="outline">
                            {getProductTypeLabel(product.product_type)}
                          </Badge>
                        </TableCell>

                        <TableCell className="sticky left-[110px] z-20 w-[130px] min-w-[130px] bg-white font-mono text-xs dark:bg-slate-950">
                          {product.sku ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="sticky left-[240px] z-20 min-w-[340px] align-top bg-white dark:bg-slate-950 shadow-[4px_0_8px_-6px_rgba(0,0,0,0.18)]">
                          <div className="text-xs font-medium leading-snug whitespace-normal break-words">
                            {product.name}
                          </div>
                        </TableCell>

                        <TableCell>
                          {product.brand?.trim() ? (
                            product.brand
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {formatQty(product.package_qty)}
                        </TableCell>

                        <TableCell>
                          {product.default_unit_label ? (
                            product.default_unit_label.toUpperCase()
                          ) : (
                            <span>-</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {product.qty_per_package?.trim() ? (
                            product.qty_per_package
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {product.category ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell>
                          {product.sector_category ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {product.abc_curve ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          {product.shelf_life_days ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          {formatCurrency(product.price)}
                        </TableCell>

                        <TableCell className="text-center">
                          {product.is_active ? (
                            <Badge variant="secondary">Ativo</Badge>
                          ) : (
                            <Badge variant="outline">Inativo</Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="border border-blue-300 bg-blue-50 text-blue-700 shadow-sm hover:bg-blue-100"
                              >
                                ✏️ Editar
                              </Button>
                            </DialogTrigger>

                            <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-white text-foreground">
                              <DialogHeader>
                                <DialogTitle>Editar produto — {product.name}</DialogTitle>
                              </DialogHeader>

                              <form
                                id={`update-product-form-${product.id}`}
                                action={updateProduct}
                                className="space-y-4"
                              >
                                <input type="hidden" name="id" value={product.id} />

                                <div className="grid gap-4 md:grid-cols-2">
                                  <div className="space-y-2">
                                    <Label htmlFor={`sku-${product.id}`}>SKU / Código do item</Label>
                                    <Input
                                      id={`sku-${product.id}`}
                                      name="sku"
                                      defaultValue={product.sku ?? ""}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`product_type-${product.id}`}>Tipo</Label>
                                    <select
                                      id={`product_type-${product.id}`}
                                      name="product_type"
                                      defaultValue={product.product_type}
                                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <option value="INSU">INSU — Insumo</option>
                                      <option value="PREP">PREP — Pré-preparo</option>
                                      <option value="PROD">PROD — Produto acabado</option>
                                    </select>
                                  </div>

                                  <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor={`name-${product.id}`}>Nome do item</Label>
                                    <Input
                                      id={`name-${product.id}`}
                                      name="name"
                                      defaultValue={product.name}
                                      required
                                    />
                                  </div>

                                  <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor={`brand-${product.id}`}>Marca</Label>
                                    <Input
                                      id={`brand-${product.id}`}
                                      name="brand"
                                      defaultValue={product.brand ?? ""}
                                      placeholder="Ex.: Nestlé, Seara, Sadia"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`package_qty-${product.id}`}>
                                      Qtd (peso/volume da embalagem)
                                    </Label>
                                    <Input
                                      id={`package_qty-${product.id}`}
                                      name="package_qty"
                                      type="number"
                                      step="0.001"
                                      min="0"
                                      defaultValue={product.package_qty ?? undefined}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`default_unit_label-${product.id}`}>
                                      Unidade padrão
                                    </Label>
                                    <select
                                      id={`default_unit_label-${product.id}`}
                                      name="default_unit_label"
                                      defaultValue={
                                        (product.default_unit_label?.toUpperCase() as any) ?? "UN"
                                      }
                                      required
                                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      {UNIT_OPTIONS.map((u) => (
                                        <option key={u} value={u}>
                                          {u}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`qty_per_package-${product.id}`}>Qtd. por Emb.</Label>
                                    <Input
                                      id={`qty_per_package-${product.id}`}
                                      name="qty_per_package"
                                      defaultValue={product.qty_per_package ?? ""}
                                      placeholder="Ex.: 12 unidades, BDJ C/ 30 UNID"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`category-${product.id}`}>
                                      Categoria (armazenamento)
                                    </Label>
                                    <select
                                      id={`category-${product.id}`}
                                      name="category"
                                      defaultValue={product.category ?? ""}
                                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <option value="">— Selecione —</option>
                                      {STORAGE_CATEGORIES.map((c) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`abc_curve-${product.id}`}>
                                      Curva do produto
                                    </Label>
                                    <select
                                      id={`abc_curve-${product.id}`}
                                      name="abc_curve"
                                      defaultValue={
                                        normalizeProductAbcCurve(product.abc_curve) ?? ""
                                      }
                                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <option value="">— Selecione —</option>
                                      {PRODUCT_ABC_CURVES.map((curve) => (
                                        <option key={curve} value={curve}>
                                          {curve}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor={`sector_category-${product.id}`}>
                                      Setor (Categoria)
                                    </Label>
                                    <select
                                      id={`sector_category-${product.id}`}
                                      name="sector_category"
                                      defaultValue={
                                        normalizeProductSectorCategory(product.sector_category) ?? ""
                                      }
                                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <option value="">— Selecione —</option>
                                      {PRODUCT_SECTOR_CATEGORIES.map((c) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-2 md:col-span-2">
                                    <Label>Alergênico</Label>
                                    <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
                                      {ALLERGEN_OPTIONS.map((item) => (
                                        <label key={item} className="flex items-center gap-2 text-sm">
                                          <input
                                            type="checkbox"
                                            name="allergens"
                                            value={item}
                                            defaultChecked={normalizeAllergenList(
                                              product.allergens,
                                            ).includes(item)}
                                          />
                                          <span>{item}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`shelf_life_days-${product.id}`}>
                                      Shelf life (dias)
                                    </Label>
                                    <Input
                                      id={`shelf_life_days-${product.id}`}
                                      name="shelf_life_days"
                                      type="number"
                                      min="0"
                                      step="1"
                                      defaultValue={product.shelf_life_days ?? undefined}
                                      placeholder="Ex.: 3"
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`price-${product.id}`}>Preço / Custo padrão</Label>
                                    <Input
                                      id="price"
                                      name="price"
                      type="text"
                      inputMode="decimal"
                      pattern="^[0-9]+([,.][0-9]{1,5})?$"
                      placeholder="0,00000"
                      title="Informe o valor no formato 0,00000. Exemplo: 8,25583"
                                      defaultValue={product.price ?? undefined}
                                    />
                                  </div>

                                  <div className="space-y-2">
                                    <Label htmlFor={`conversion_factor-${product.id}`}>
                                      Fator de conversão (opcional)
                                    </Label>
                                    <Input
                                      id={`conversion_factor-${product.id}`}
                                      name="conversion_factor"
                                      type="number"
                                      step="0.0001"
                                      min="0"
                                      defaultValue={1}
                                      placeholder="1"
                                    />
                                  </div>

                                  <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor={`is_active-${product.id}`}>Status</Label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        id={`is_active-${product.id}`}
                                        name="is_active"
                                        type="checkbox"
                                        defaultChecked={product.is_active ?? true}
                                      />
                                      <span className="text-sm text-muted-foreground">Ativo</span>
                                    </div>
                                  </div>
                                </div>
                              </form>

                              <div className="mt-4 border-t pt-4">
                                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <form action={deleteProduct} className="w-full sm:w-auto">
                                    <input type="hidden" name="id" value={product.id} />
                                    <Button
                                      type="submit"
                                      variant="destructive"
                                      className="w-full sm:w-auto bg-red-600 text-white hover:bg-red-700"
                                    >
                                      Excluir
                                    </Button>
                                  </form>

                                  <Button
                                    type="submit"
                                    form={`update-product-form-${product.id}`}
                                    className="w-full sm:w-auto"
                                  >
                                    Gravar alterações
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {lastUploadProduct && lastUploadProduct.created_at && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Último upload/importação de produtos registrado em{" "}
                  <strong>
                    {new Date(lastUploadProduct.created_at).toLocaleString("pt-BR")}
                  </strong>
                  {lastUploadUserName && (
                    <>
                      {" "}
                      por <strong>{lastUploadUserName}</strong>
                    </>
                  )}
                  .
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}