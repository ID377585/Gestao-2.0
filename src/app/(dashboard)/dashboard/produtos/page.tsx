// src/app/(dashboard)/dashboard/produtos/page.tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembershipOrRedirect } from "@/lib/auth/get-membership";

import { createProduct, updateProduct } from "./actions";

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

/**
 * ✅ Melhorias de formulário (sem mexer em lógica já validada):
 * - Unidade padrão: select (UN, KG, G, L, ML)  ✅ (forçado em maiúsculo)
 * - Categoria (armazenamento): select (Resfriado, Congelado, Temp. Ambiente)
 */
const UNIT_OPTIONS = ["UN", "KG", "G", "L", "ML"] as const;
const STORAGE_CATEGORIES = ["Resfriado", "Congelado", "Temp. Ambiente"] as const;

const SECTOR_CATEGORIES = [
  "Confeitaria",
  "Padaria",
  "Açougue",
  "Produção",
  "Massaria",
  "Burrataria",
  "Secos",
  "Embalagens",
  "Hortifruti",
  "Produto de Limpeza",
  "Descartáveis",
  "Bebidas",
] as const;

type ProductRow = {
  id: string;
  sku: string | null;
  name: string;
  product_type: "INSU" | "PREP" | "PROD" | string;
  default_unit_label: string | null;
  package_qty: number | null; // Qtd total da embalagem (peso/volume) - NUMÉRICO
  qty_per_package: string | null; // Qtd por embalagem - TEXTO LIVRE
  category: string | null; // agora será usado como categoria de armazenamento (Resfriado/Congelado/Temp. Ambiente)

  // ✅ Setor (Categoria)
  sector_category: string | null;

  // ✅ NOVO: Shelf life em dias
  shelf_life_days: number | null;

  is_active: boolean | null;
  price: number | null;
  created_at: string | null;
  created_by: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
};

type PageProps = {
  searchParams?: {
    success?: string;
    error?: string;
  };
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
  // Garante que o usuário está autenticado e com membership ativo
  await getActiveMembershipOrRedirect();

  const supabase = await createSupabaseServerClient();

  // Carrega produtos
  const { data, error } = await supabase
    .from("products")
    .select(
      "id, sku, name, product_type, default_unit_label, package_qty, qty_per_package, category, sector_category, shelf_life_days, is_active, price, created_at, created_by",
    )
    .order("product_type", { ascending: true })
    .order("name", { ascending: true });

  const products: ProductRow[] = (data ?? []) as ProductRow[];

  if (error) {
    console.error("Erro ao carregar produtos:", error);
  }

  // ✅ NOVO: resumo por setor (sempre mostra todos os setores, mesmo com 0)
  const sectorCounts = SECTOR_CATEGORIES.map((sector) => {
    const count = products.filter(
      (p) => (p.sector_category ?? "").trim() === sector,
    ).length;
    return { sector, count };
  });

  const totalWithSector = products.filter((p) =>
    Boolean((p.sector_category ?? "").trim()),
  ).length;

  const totalWithoutSector = products.length - totalWithSector;

  // ==== MAPA DE USUÁRIOS (para saber quem fez o upload/cadastro) ====
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
      // ✅ ROBUSTO: seu banco não tem profiles.email (no log deu erro).
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

  // Produto com última data de criação (como referência de "último upload")
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

  const success = searchParams?.success;
  const errorMsg = searchParams?.error;

  return (
    <div className="space-y-6">
      {/* Avisos de erro */}
      {errorMsg && (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-800">
          Erro: {decodeURIComponent(errorMsg)}
        </div>
      )}

      {/* Avisos de sucesso */}
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

      {/* ✅ NOVO: sucesso de importação */}
      {success === "import" && (
        <div className="rounded-md border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-800">
          Produtos importados com sucesso!
        </div>
      )}

      {/* Cabeçalho + ações */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Produtos</h1>
          <p className="text-sm text-muted-foreground">
            Cadastro de <strong>insumos (INSU)</strong>,{" "}
            <strong>pré-preparos (PREP)</strong> e{" "}
            <strong>produtos acabados (PROD)</strong>. Esta tabela é a base para
            etiquetas, estoque, fichas técnicas e produção.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* NOVO PRODUTO */}
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">+ Novo item</Button>
            </DialogTrigger>

            {/* Modal NOVO PRODUTO */}
            <DialogContent className="max-w-lg bg-white text-foreground">
              <DialogHeader>
                <DialogTitle>Novo produto</DialogTitle>
              </DialogHeader>

              <form action={createProduct} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* SKU */}
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU / Código do item</Label>
                    <Input id="sku" name="sku" placeholder="Ex.: 1001711" />
                  </div>

                  {/* Tipo */}
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

                  {/* Nome */}
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="name">Nome do item</Label>
                    <Input
                      id="name"
                      name="name"
                      placeholder="Ex.: Farinha de Trigo, Creme Base Chocolate..."
                      required
                    />
                  </div>

                  {/* Qtd total da embalagem (NUMÉRICO) */}
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

                  {/* ✅ Unidade (agora SELECT) */}
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

                  {/* Qtd. por embalagem (TEXTO LIVRE) */}
                  <div className="space-y-2">
                    <Label htmlFor="qty_per_package">Qtd. por Emb.</Label>
                    <Input
                      id="qty_per_package"
                      name="qty_per_package"
                      placeholder="Ex.: 12 unidades, 6 bandejas, 1 PAC C/ 1KG"
                    />
                  </div>

                  {/* ✅ Categoria (armazenamento) (agora SELECT) */}
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

                  {/* ✅ Setor (Categoria) */}
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="sector_category">Setor (Categoria)</Label>
                    <select
                      id="sector_category"
                      name="sector_category"
                      defaultValue=""
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <option value="">— Selecione —</option>
                      {SECTOR_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Use isso para identificar o setor responsável (e futuramente
                      vamos usar em Pedidos).
                    </p>
                  </div>

                  {/* ✅ NOVO: Shelf life (dias) */}
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
                    <p className="text-xs text-muted-foreground">
                      Dias corridos de vida útil após manipulação.
                    </p>
                  </div>

                  {/* Preço */}
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço / Custo padrão</Label>
                    <Input
                      id="price"
                      name="price"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                    />
                  </div>

                  {/* Fator de conversão */}
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

          {/* EXPORTAR */}
          <form action="/api/export/products" method="GET">
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-gray-300 hover:bg-gray-100"
            >
              ⬇️ Exportar
            </Button>
          </form>

          {/* IMPORTAR */}
          <Dialog>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="border-green-400 text-green-700 bg-green-50 hover:bg-green-100"
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

      {/* ✅ NOVO: Resumo por Setor (antes da Lista) */}
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

      {/* Lista de produtos */}
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[90px]">Tipo</TableHead>
                      <TableHead className="w-[110px]">SKU</TableHead>

                      {/* ✅ AJUSTE: Nome com largura mínima para quebrar linha */}
                      <TableHead className="min-w-[260px]">Nome</TableHead>

                      <TableHead className="w-[110px] text-center">Qtd</TableHead>
                      <TableHead className="w-[80px]">Unidade</TableHead>
                      <TableHead className="w-[160px] text-center">
                        Qtd. por Emb.
                      </TableHead>

                      {/* Categoria (armazenamento) */}
                      <TableHead>Categoria</TableHead>

                      {/* Setor */}
                      <TableHead>Setor</TableHead>

                      {/* ✅ NOVO: Shelf life */}
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
                        {/* Tipo */}
                        <TableCell>
                          <Badge variant="outline">
                            {getProductTypeLabel(product.product_type)}
                          </Badge>
                        </TableCell>

                        {/* SKU */}
                        <TableCell className="font-mono text-xs">
                          {product.sku ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* ✅ AJUSTE: Nome menor + quebra de linha (sem cortar) */}
                        <TableCell className="min-w-[260px] align-top">
                          <div className="text-xs font-medium leading-snug whitespace-normal break-words">
                            {product.name}
                          </div>
                        </TableCell>

                        {/* Qtd total da embalagem (NUMÉRICO) */}
                        <TableCell className="text-center">
                          {formatQty(product.package_qty)}
                        </TableCell>

                        {/* Unidade ✅ (força exibição em maiúsculo) */}
                        <TableCell>
                          {product.default_unit_label ? (
                            product.default_unit_label.toUpperCase()
                          ) : (
                            <span>-</span>
                          )}
                        </TableCell>

                        {/* Qtd. por embalagem (TEXTO) */}
                        <TableCell className="text-center">
                          {product.qty_per_package?.trim() ? (
                            product.qty_per_package
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Categoria (armazenamento) */}
                        <TableCell>
                          {product.category ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Setor */}
                        <TableCell>
                          {product.sector_category ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* ✅ Shelf life */}
                        <TableCell className="text-center">
                          {product.shelf_life_days ?? (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>

                        {/* Preço */}
                        <TableCell className="text-right">
                          {formatCurrency(product.price)}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center">
                          {product.is_active ? (
                            <Badge variant="secondary">Ativo</Badge>
                          ) : (
                            <Badge variant="outline">Inativo</Badge>
                          )}
                        </TableCell>

                        {/* Ações */}
                        <TableCell className="text-center">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-300 shadow-sm"
                              >
                                ✏️ Editar
                              </Button>
                            </DialogTrigger>

                            {/* Modal EDITAR PRODUTO */}
                            <DialogContent className="max-w-lg bg-white text-foreground">
                              <DialogHeader>
                                <DialogTitle>
                                  Editar produto — {product.name}
                                </DialogTitle>
                              </DialogHeader>

                              <form action={updateProduct} className="space-y-4">
                                {/* ID oculto */}
                                <input type="hidden" name="id" value={product.id} />

                                <div className="grid gap-4 md:grid-cols-2">
                                  {/* SKU */}
                                  <div className="space-y-2">
                                    <Label htmlFor={`sku-${product.id}`}>
                                      SKU / Código do item
                                    </Label>
                                    <Input
                                      id={`sku-${product.id}`}
                                      name="sku"
                                      defaultValue={product.sku ?? ""}
                                    />
                                  </div>

                                  {/* Tipo */}
                                  <div className="space-y-2">
                                    <Label htmlFor={`product_type-${product.id}`}>
                                      Tipo
                                    </Label>
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

                                  {/* Nome */}
                                  <div className="md:col-span-2 space-y-2">
                                    <Label htmlFor={`name-${product.id}`}>
                                      Nome do item
                                    </Label>
                                    <Input
                                      id={`name-${product.id}`}
                                      name="name"
                                      defaultValue={product.name}
                                      required
                                    />
                                  </div>

                                  {/* Qtd total da embalagem */}
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

                                  {/* ✅ Unidade (agora SELECT) */}
                                  <div className="space-y-2">
                                    <Label htmlFor={`default_unit_label-${product.id}`}>
                                      Unidade padrão
                                    </Label>
                                    <select
                                      id={`default_unit_label-${product.id}`}
                                      name="default_unit_label"
                                      defaultValue={
                                        (product.default_unit_label?.toUpperCase() as any) ??
                                        "UN"
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

                                  {/* Qtd por embalagem */}
                                  <div className="space-y-2">
                                    <Label htmlFor={`qty_per_package-${product.id}`}>
                                      Qtd. por Emb.
                                    </Label>
                                    <Input
                                      id={`qty_per_package-${product.id}`}
                                      name="qty_per_package"
                                      defaultValue={product.qty_per_package ?? ""}
                                      placeholder="Ex.: 12 unidades, BDJ C/ 30 UNID"
                                    />
                                  </div>

                                  {/* ✅ Categoria (armazenamento) (agora SELECT) */}
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

                                  {/* Setor (Categoria) */}
                                  <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor={`sector_category-${product.id}`}>
                                      Setor (Categoria)
                                    </Label>
                                    <select
                                      id={`sector_category-${product.id}`}
                                      name="sector_category"
                                      defaultValue={product.sector_category ?? ""}
                                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <option value="">— Selecione —</option>
                                      {SECTOR_CATEGORIES.map((c) => (
                                        <option key={c} value={c}>
                                          {c}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* ✅ NOVO: Shelf life */}
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

                                  {/* Preço */}
                                  <div className="space-y-2">
                                    <Label htmlFor={`price-${product.id}`}>
                                      Preço / Custo padrão
                                    </Label>
                                    <Input
                                      id={`price-${product.id}`}
                                      name="price"
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      defaultValue={product.price ?? undefined}
                                    />
                                  </div>

                                  {/* Fator de conversão */}
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
                                      placeholder="1"
                                    />
                                  </div>

                                  {/* Status */}
                                  <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor={`is_active-${product.id}`}>
                                      Status
                                    </Label>
                                    <div className="flex items-center gap-2">
                                      <input
                                        id={`is_active-${product.id}`}
                                        name="is_active"
                                        type="checkbox"
                                        defaultChecked={product.is_active ?? true}
                                      />
                                      <span className="text-sm text-muted-foreground">
                                        Ativo
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                  <Button type="submit">Gravar alterações</Button>
                                </div>
                              </form>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* INFO DE ÚLTIMO UPLOAD */}
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
