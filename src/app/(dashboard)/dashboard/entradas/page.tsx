"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createInvoiceEntry,
  listInvoiceEntries,
  reverseInvoiceEntry,
  type InvoiceEntryInput,
} from "./actions";

type ProductOption = {
  id: string;
  name: string;
  price?: number | null;
  default_unit_label?: string | null;
};

type EntryItemDraft = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitLabel: string;
  unitCost: number;
  totalCost: number;
};

type InvoiceEntryRow = {
  id: string;
  supplier_name: string;
  invoice_number: string;
  invoice_series: string | null;
  invoice_key: string | null;
  issue_date: string;
  entry_date: string;
  total_amount: number;
  notes: string | null;
  status: "active" | "cancelled";
  created_at: string;
  items: Array<{
    id: string;
    product_id: string;
    product_name_snapshot: string;
    quantity: number;
    unit_label: string;
    unit_cost: number;
    total_cost: number;
    sort_order: number;
  }>;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toNumber(value: unknown, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function normalizeEntry(raw: any): InvoiceEntryRow {
  return {
    id: String(raw.id),
    supplier_name: String(raw.supplier_name ?? ""),
    invoice_number: String(raw.invoice_number ?? ""),
    invoice_series: raw.invoice_series ? String(raw.invoice_series) : null,
    invoice_key: raw.invoice_key ? String(raw.invoice_key) : null,
    issue_date: String(raw.issue_date ?? ""),
    entry_date: String(raw.entry_date ?? ""),
    total_amount: Number(raw.total_amount ?? 0),
    notes: raw.notes ? String(raw.notes) : null,
    status: String(raw.status ?? "active") as "active" | "cancelled",
    created_at: String(raw.created_at ?? ""),
    items: Array.isArray(raw.items)
      ? raw.items
          .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item: any) => ({
            id: String(item.id),
            product_id: String(item.product_id),
            product_name_snapshot: String(item.product_name_snapshot ?? ""),
            quantity: Number(item.quantity ?? 0),
            unit_label: String(item.unit_label ?? "UN").toUpperCase(),
            unit_cost: Number(item.unit_cost ?? 0),
            total_cost: Number(item.total_cost ?? 0),
            sort_order: Number(item.sort_order ?? 0),
          }))
      : [],
  };
}

function escapeCsv(val: unknown) {
  const s = String(val ?? "");
  if (/[",;\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function EntradasPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [entries, setEntries] = useState<InvoiceEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceSeries, setInvoiceSeries] = useState("");
  const [invoiceKey, setInvoiceKey] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [entryDate, setEntryDate] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<EntryItemDraft[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<InvoiceEntryRow | null>(null);

  const [draftProductId, setDraftProductId] = useState("");
  const [draftProductName, setDraftProductName] = useState("");
  const [draftQuantity, setDraftQuantity] = useState<number>(0);
  const [draftUnitLabel, setDraftUnitLabel] = useState("UN");
  const [draftUnitCost, setDraftUnitCost] = useState<number>(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "cancelled">("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);

      const [productsRes, entriesRes] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        listInvoiceEntries(),
      ]);

      if (productsRes.ok) {
        const productsData = await productsRes.json();
        const normalizedProducts = Array.isArray(productsData)
          ? productsData.map((product: any) => ({
              id: String(product.id),
              name: String(product.name ?? ""),
              price: Number(product.price ?? 0),
              default_unit_label: product.default_unit_label ?? "UN",
            }))
          : [];
        setProducts(normalizedProducts);
      } else {
        setProducts([]);
      }

      const normalizedEntries = Array.isArray(entriesRes)
        ? entriesRes.map(normalizeEntry)
        : [];

      setEntries(normalizedEntries);
      setSelectedEntry((prev) => {
        if (!normalizedEntries.length) return null;
        if (!prev) return normalizedEntries[0];
        return normalizedEntries.find((entry) => entry.id === prev.id) ?? normalizedEntries[0];
      });
    } catch (error) {
      console.error("Erro ao carregar entradas:", error);
      alert("Erro ao carregar a sessão de entradas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setSupplierName("");
    setInvoiceNumber("");
    setInvoiceSeries("");
    setInvoiceKey("");
    setIssueDate("");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setNotes("");
    setItems([]);
    setDraftProductId("");
    setDraftProductName("");
    setDraftQuantity(0);
    setDraftUnitLabel("UN");
    setDraftUnitCost(0);
  };

  const totalItemsDraft = useMemo(() => items.length, [items]);

  const totalAmountDraft = useMemo(() => {
    return Number(
      items.reduce((acc, item) => acc + item.totalCost, 0).toFixed(2)
    );
  }, [items]);

  const onSelectProduct = (productId: string) => {
    setDraftProductId(productId);
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    setDraftProductName(product.name);
    setDraftUnitLabel(String(product.default_unit_label || "UN").toUpperCase());
    setDraftUnitCost(Number(product.price ?? 0));
  };

  const addItem = () => {
    const quantity = toNumber(draftQuantity, 0);
    const unitCost = toNumber(draftUnitCost, 0);

    if (!draftProductId) {
      alert("Selecione um produto.");
      return;
    }

    if (quantity <= 0) {
      alert("Informe uma quantidade válida.");
      return;
    }

    if (unitCost < 0) {
      alert("Informe um custo unitário válido.");
      return;
    }

    const totalCost = Number((quantity * unitCost).toFixed(2));

    const item: EntryItemDraft = {
      id: uid(),
      productId: draftProductId,
      productName: draftProductName,
      quantity,
      unitLabel: String(draftUnitLabel || "UN").toUpperCase(),
      unitCost,
      totalCost,
    };

    setItems((prev) => [...prev, item]);

    setDraftProductId("");
    setDraftProductName("");
    setDraftQuantity(0);
    setDraftUnitLabel("UN");
    setDraftUnitCost(0);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const saveEntry = () => {
    if (!supplierName.trim()) {
      alert("Informe o fornecedor.");
      return;
    }

    if (!invoiceNumber.trim()) {
      alert("Informe o número da nota.");
      return;
    }

    if (!issueDate) {
      alert("Informe a data de emissão.");
      return;
    }

    if (!entryDate) {
      alert("Informe a data de entrada.");
      return;
    }

    if (!items.length) {
      alert("Adicione pelo menos um item.");
      return;
    }

    const payload: InvoiceEntryInput = {
      supplier_name: supplierName.trim(),
      invoice_number: invoiceNumber.trim(),
      invoice_series: invoiceSeries.trim() || null,
      invoice_key: invoiceKey.trim() || null,
      issue_date: issueDate,
      entry_date: entryDate,
      notes: notes.trim() || null,
      items: items.map((item, index) => ({
        product_id: item.productId,
        product_name_snapshot: item.productName,
        quantity: item.quantity,
        unit_label: item.unitLabel,
        unit_cost: item.unitCost,
        total_cost: item.totalCost,
        sort_order: index,
      })),
    };

    startTransition(async () => {
      try {
        await createInvoiceEntry(payload);
        resetForm();
        await loadData();
        alert("Entrada lançada com sucesso e estoque atualizado.");
      } catch (error: any) {
        console.error(error);
        alert(error?.message ?? "Não foi possível gravar a entrada.");
      }
    });
  };

  const handleReverse = (entryId: string) => {
    if (!confirm("Deseja estornar esta entrada? O saldo do estoque será revertido.")) {
      return;
    }

    startTransition(async () => {
      try {
        await reverseInvoiceEntry(entryId);
        await loadData();
        alert("Entrada estornada com sucesso.");
      } catch (error: any) {
        console.error(error);
        alert(error?.message ?? "Não foi possível estornar a entrada.");
      }
    });
  };

  const supplierOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        entries
          .map((entry) => entry.supplier_name.trim())
          .filter((value) => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    return ["all", ...unique];
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();

    return entries.filter((entry) => {
      const matchesSearch =
        !q ||
        entry.invoice_number.toLowerCase().includes(q) ||
        (entry.invoice_series ?? "").toLowerCase().includes(q) ||
        (entry.invoice_key ?? "").toLowerCase().includes(q) ||
        entry.supplier_name.toLowerCase().includes(q) ||
        (entry.notes ?? "").toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" || entry.status === statusFilter;

      const matchesSupplier =
        supplierFilter === "all" || entry.supplier_name === supplierFilter;

      const matchesStart = !periodStart || entry.entry_date >= periodStart;
      const matchesEnd = !periodEnd || entry.entry_date <= periodEnd;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesSupplier &&
        matchesStart &&
        matchesEnd
      );
    });
  }, [entries, searchTerm, statusFilter, supplierFilter, periodStart, periodEnd]);

  const selectedFilteredEntry = useMemo(() => {
    if (!selectedEntry) return null;
    return filteredEntries.find((entry) => entry.id === selectedEntry.id) ?? null;
  }, [selectedEntry, filteredEntries]);

  useEffect(() => {
    if (!filteredEntries.length) {
      setSelectedEntry(null);
      return;
    }

    if (!selectedFilteredEntry) {
      setSelectedEntry(filteredEntries[0]);
    }
  }, [filteredEntries, selectedFilteredEntry]);

  const totalFilteredEntries = filteredEntries.length;

  const activeEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.status === "active").length,
    [filteredEntries]
  );

  const cancelledEntries = useMemo(
    () => filteredEntries.filter((entry) => entry.status === "cancelled").length,
    [filteredEntries]
  );

  const totalHistoryAmount = useMemo(() => {
    return filteredEntries
      .filter((entry) => entry.status === "active")
      .reduce((acc, entry) => acc + entry.total_amount, 0);
  }, [filteredEntries]);

  const totalHistoryItems = useMemo(() => {
    return filteredEntries
      .filter((entry) => entry.status === "active")
      .reduce((acc, entry) => {
        const qty = entry.items.reduce((sum, item) => sum + item.quantity, 0);
        return acc + qty;
      }, 0);
  }, [filteredEntries]);

  const chartData = useMemo(() => {
    const grouped = new Map<string, { date: string; total: number; notes: number }>();

    filteredEntries
      .filter((entry) => entry.status === "active")
      .forEach((entry) => {
        const key = entry.entry_date;
        const current = grouped.get(key);

        if (!current) {
          grouped.set(key, {
            date: key,
            total: entry.total_amount,
            notes: 1,
          });
        } else {
          grouped.set(key, {
            date: key,
            total: Number((current.total + entry.total_amount).toFixed(2)),
            notes: current.notes + 1,
          });
        }
      });

    return Array.from(grouped.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        label: formatDate(item.date),
      }));
  }, [filteredEntries]);

  const exportFilteredCsv = () => {
    if (!filteredEntries.length) {
      alert("Nenhuma entrada encontrada para exportar.");
      return;
    }

    const headers = [
      "fornecedor",
      "numero_nota",
      "serie",
      "chave_nfe",
      "data_emissao",
      "data_entrada",
      "status",
      "valor_total",
      "qtd_itens",
      "observacoes",
      "criado_em",
    ];

    const lines = [headers.join(";")];

    filteredEntries.forEach((entry) => {
      const row = [
        escapeCsv(entry.supplier_name),
        escapeCsv(entry.invoice_number),
        escapeCsv(entry.invoice_series ?? ""),
        escapeCsv(entry.invoice_key ?? ""),
        escapeCsv(entry.issue_date),
        escapeCsv(entry.entry_date),
        escapeCsv(entry.status),
        escapeCsv(entry.total_amount.toFixed(2)),
        escapeCsv(entry.items.length),
        escapeCsv(entry.notes ?? ""),
        escapeCsv(entry.created_at),
      ];

      lines.push(row.join(";"));
    });

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "historico_entradas_filtrado.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSupplierFilter("all");
    setPeriodStart("");
    setPeriodEnd("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Entradas</h1>
          <p className="text-gray-600">
            Lançamento de notas fiscais de entrada com filtros, histórico, indicadores e gráfico.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportFilteredCsv}>
            Exportar CSV
          </Button>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Limpar filtros
          </Button>
        </div>
      </div>

      {loading && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          Carregando entradas...
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Notas filtradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFilteredEntries}</div>
            <p className="text-xs text-muted-foreground">Histórico visível</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeEntries}</div>
            <p className="text-xs text-muted-foreground">Notas válidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estornadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{cancelledEntries}</div>
            <p className="text-xs text-muted-foreground">Notas canceladas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Valor total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalHistoryAmount)}</div>
            <p className="text-xs text-muted-foreground">Entradas ativas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Qtd total recebida</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalHistoryItems.toFixed(3)}</div>
            <p className="text-xs text-muted-foreground">Soma das quantidades</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros e pesquisa</CardTitle>
          <CardDescription>
            Busque por número da nota, fornecedor, chave NF-e e período.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <Label htmlFor="search_term">Pesquisa</Label>
            <Input
              id="search_term"
              placeholder="Número da nota, fornecedor, chave, observações..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="status_filter">Status</Label>
            <select
              id="status_filter"
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "cancelled")
              }
            >
              <option value="all">Todos</option>
              <option value="active">Ativas</option>
              <option value="cancelled">Estornadas</option>
            </select>
          </div>

          <div>
            <Label htmlFor="supplier_filter">Fornecedor</Label>
            <select
              id="supplier_filter"
              className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
            >
              {supplierOptions.map((supplier) => (
                <option key={supplier} value={supplier}>
                  {supplier === "all" ? "Todos os fornecedores" : supplier}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 xl:col-span-5">
            <div>
              <Label htmlFor="period_start">Data inicial</Label>
              <Input
                id="period_start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="period_end">Data final</Label>
              <Input
                id="period_end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Gráfico de entradas por dia</CardTitle>
          <CardDescription>
            Volume financeiro diário das notas filtradas ativas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Não há dados suficientes para montar o gráfico com os filtros atuais.
            </div>
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "total") return [formatCurrency(value), "Valor total"];
                      return [value, "Notas"];
                    }}
                  />
                  <Bar dataKey="total" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Nova entrada</CardTitle>
            <CardDescription>
              Lance a nota fiscal e aumente o saldo do estoque automaticamente.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="supplier_name">Fornecedor</Label>
                <Input
                  id="supplier_name"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Ex.: Distribuidora Central"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invoice_number">Número da nota</Label>
                  <Input
                    id="invoice_number"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Ex.: 12345"
                  />
                </div>

                <div>
                  <Label htmlFor="invoice_series">Série</Label>
                  <Input
                    id="invoice_series"
                    value={invoiceSeries}
                    onChange={(e) => setInvoiceSeries(e.target.value)}
                    placeholder="Ex.: 1"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="invoice_key">Chave da NF-e</Label>
                <Input
                  id="invoice_key"
                  value={invoiceKey}
                  onChange={(e) => setInvoiceKey(e.target.value)}
                  placeholder="Ex.: 3526..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="issue_date">Data de emissão</Label>
                  <Input
                    id="issue_date"
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="entry_date">Data de entrada</Label>
                  <Input
                    id="entry_date"
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observações da nota fiscal..."
                />
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <h3 className="mb-4 text-base font-semibold">Itens da entrada</h3>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                <div className="md:col-span-5">
                  <Label>Produto</Label>
                  <select
                    className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={draftProductId}
                    onChange={(e) => onSelectProduct(e.target.value)}
                  >
                    <option value="">— Selecionar produto —</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={draftQuantity}
                    onChange={(e) => setDraftQuantity(toNumber(e.target.value, 0))}
                  />
                </div>

                <div className="md:col-span-2">
                  <Label>Unidade</Label>
                  <Input
                    value={draftUnitLabel}
                    onChange={(e) => setDraftUnitLabel(e.target.value.toUpperCase())}
                  />
                </div>

                <div className="md:col-span-3">
                  <Label>Custo unitário</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={draftUnitCost}
                    onChange={(e) => setDraftUnitCost(toNumber(e.target.value, 0))}
                  />
                </div>
              </div>

              <div className="mt-4">
                <Button type="button" onClick={addItem}>
                  Adicionar item
                </Button>
              </div>

              <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-600">Total de itens</p>
                    <p className="font-bold">{totalItemsDraft}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Valor total da entrada</p>
                    <p className="font-bold">{formatCurrency(totalAmountDraft)}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nenhum item adicionado ainda.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead>Qtd</TableHead>
                        <TableHead>Un.</TableHead>
                        <TableHead>Custo unit.</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.productName}</TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>{item.unitLabel}</TableCell>
                          <TableCell>{formatCurrency(item.unitCost)}</TableCell>
                          <TableCell>{formatCurrency(item.totalCost)}</TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeItem(item.id)}
                            >
                              Remover
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Limpar
              </Button>
              <Button type="button" onClick={saveEntry} disabled={isPending}>
                {isPending ? "Gravando..." : "Salvar entrada"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de notas lançadas</CardTitle>
            <CardDescription>
              Consulte as entradas registradas, filtre os dados e faça estorno quando necessário.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma entrada encontrada com os filtros atuais.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nota</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>Entrada</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEntries.map((entry) => (
                        <TableRow
                          key={entry.id}
                          className={
                            selectedEntry?.id === entry.id ? "bg-slate-50" : ""
                          }
                        >
                          <TableCell className="font-medium">
                            NF {entry.invoice_number}
                            {entry.invoice_series ? ` / ${entry.invoice_series}` : ""}
                          </TableCell>
                          <TableCell>{entry.supplier_name}</TableCell>
                          <TableCell>{formatDate(entry.entry_date)}</TableCell>
                          <TableCell>{formatCurrency(entry.total_amount)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                entry.status === "active" ? "default" : "secondary"
                              }
                            >
                              {entry.status === "active" ? "Ativa" : "Estornada"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedEntry(entry)}
                              >
                                Ver detalhes
                              </Button>

                              {entry.status === "active" && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReverse(entry.id)}
                                  disabled={isPending}
                                >
                                  Estornar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {selectedFilteredEntry && (
                  <div className="rounded-xl border p-4">
                    <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          NF {selectedFilteredEntry.invoice_number}
                          {selectedFilteredEntry.invoice_series
                            ? ` / ${selectedFilteredEntry.invoice_series}`
                            : ""}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Fornecedor: {selectedFilteredEntry.supplier_name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Lançada em: {formatDateTime(selectedFilteredEntry.created_at)}
                        </p>
                      </div>

                      <Badge
                        variant={
                          selectedFilteredEntry.status === "active"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {selectedFilteredEntry.status === "active"
                          ? "Ativa"
                          : "Estornada"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Emissão</p>
                        <p className="font-semibold">
                          {formatDate(selectedFilteredEntry.issue_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Entrada</p>
                        <p className="font-semibold">
                          {formatDate(selectedFilteredEntry.entry_date)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Itens</p>
                        <p className="font-semibold">
                          {selectedFilteredEntry.items.length}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-semibold">
                          {formatCurrency(selectedFilteredEntry.total_amount)}
                        </p>
                      </div>
                    </div>

                    {selectedFilteredEntry.invoice_key && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground">Chave NF-e</p>
                        <p className="text-sm font-medium break-all">
                          {selectedFilteredEntry.invoice_key}
                        </p>
                      </div>
                    )}

                    {selectedFilteredEntry.notes && (
                      <div className="mt-4">
                        <p className="text-xs text-muted-foreground">Observações</p>
                        <p className="text-sm whitespace-pre-wrap">
                          {selectedFilteredEntry.notes}
                        </p>
                      </div>
                    )}

                    <div className="mt-4">
                      <h4 className="mb-2 font-semibold">Itens da nota</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead>Qtd</TableHead>
                            <TableHead>Un.</TableHead>
                            <TableHead>Custo unit.</TableHead>
                            <TableHead>Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedFilteredEntry.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.product_name_snapshot}</TableCell>
                              <TableCell>{item.quantity}</TableCell>
                              <TableCell>{item.unit_label}</TableCell>
                              <TableCell>{formatCurrency(item.unit_cost)}</TableCell>
                              <TableCell>{formatCurrency(item.total_cost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}