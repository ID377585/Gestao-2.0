// src/app/(dashboard)/dashboard/estoque/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

import { formatQty3 } from "@/lib/format/qty";

import {
  listCurrentStock,
  startInventorySession,
  addInventoryItem,
  getInventorySessionWithItems,
  finalizeInventory,
  seedInitialStockFromProducts,
  listProductsForInventory,
  updateStockThresholds,
  getLastClosedInventorySession,
  bulkUpdateStockMeta,
  type BulkStockMetaUpdateItem,
} from "./actions";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardStatGrid } from "@/components/dashboard/DashboardStatGrid";
import { DashboardTableShell } from "@/components/dashboard/DashboardTableShell";

// ===== Tipagens auxiliares =====

type StockRow = {
  id: string;
  quantity: number;
  unit_label: string | null;
  min_qty: number | null;
  med_qty: number | null;
  max_qty: number | null;
  location: string | null;
  product: {
    id: string;
    name: string;
    price: number | null;
    sku?: string | null;
    default_unit_label?: string | null;
  } | null;
};

type InventorySession = {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
};

type InventoryItem = {
  id: string;
  counted_quantity: number;
  unit_label: string | null;
  product: {
    id: string;
    name: string;
  } | null;
};

type StatusEstoque = "critico" | "baixo" | "normal";

type ProductOption = {
  id: string;
  name: string;
  default_unit_label: string | null;
  sku?: string | null;
};

type ThresholdDrafts = Record<
  string,
  {
    min: string;
    med: string;
    max: string;
  }
>;

const statusConfig: Record<
  StatusEstoque,
  { label: string; badgeClass: string }
> = {
  critico: { label: "Crítico", badgeClass: "bg-red-600 text-white" },
  baixo: { label: "Baixo", badgeClass: "bg-yellow-500 text-white" },
  normal: { label: "Normal", badgeClass: "bg-green-500 text-white" },
};

function getStatusFromRow(row: StockRow): StatusEstoque {
  const q = row.quantity ?? 0;
  const min = row.min_qty ?? 0;
  const med = row.med_qty ?? 0;

  if (q < min) return "critico";
  if (q < med) return "baixo";
  return "normal";
}

// ===== CSV helpers =====
function normalizeHeader(h: string) {
  return String(h || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function detectDelimiter(headerLine: string) {
  const commas = (headerLine.match(/,/g) ?? []).length;
  const semis = (headerLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

function splitCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === delimiter && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out.map((s) => s.trim());
}

function toNumberOrNull(v: any) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function escapeCsv(val: any) {
  const s = String(val ?? "");
  if (/[",\n;]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function EstoquePage() {
  const { toast } = useToast();

  const [stock, setStock] = useState<StockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);

  const [thresholdDrafts, setThresholdDrafts] = useState<ThresholdDrafts>({});
  const [savingThresholdRowId, setSavingThresholdRowId] =
    useState<string | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);

  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventorySession, setInventorySession] =
    useState<InventorySession | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [finalizingInventory, setFinalizingInventory] = useState(false);

  const [lastInventoryDate, setLastInventoryDate] = useState<string | null>(
    null
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [countedQuantity, setCountedQuantity] = useState<string>("");

  const loadStock = async () => {
    setLoadingStock(true);
    try {
      const data = (await listCurrentStock()) as StockRow[];
      setStock(data ?? []);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao carregar estoque",
        description: e?.message ?? "Não foi possível carregar os dados.",
        variant: "destructive",
      });
    } finally {
      setLoadingStock(false);
    }
  };

  const formatDateTime = (value: string | Date | null | undefined) => {
    if (!value) return "";
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const prods = (await listProductsForInventory()) as ProductOption[];
        setProducts(prods ?? []);

        const current = (await listCurrentStock()) as StockRow[];

        if (!current || current.length === 0) {
          try {
            await seedInitialStockFromProducts();
          } catch (seedErr: any) {
            console.error("Falha ao criar estoque inicial:", seedErr);
          }
        }

        await loadStock();

        try {
          const lastClosed = await getLastClosedInventorySession();
          if (lastClosed) {
            const date =
              (lastClosed as any).finished_at ??
              (lastClosed as any).started_at ??
              null;
            if (date) {
              setLastInventoryDate(date);
            }
          }
        } catch (err) {
          console.error("Erro ao buscar último inventário encerrado:", err);
        }
      } catch (e: any) {
        console.error(e);
        toast({
          title: "Erro ao carregar estoque",
          description: e?.message ?? "Não foi possível carregar os dados.",
          variant: "destructive",
        });
      }
    };

    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const drafts: ThresholdDrafts = {};
    stock.forEach((row) => {
      drafts[row.id] = {
        min:
          row.min_qty !== null && row.min_qty !== undefined
            ? String(row.min_qty)
            : "",
        med:
          row.med_qty !== null && row.med_qty !== undefined
            ? String(row.med_qty)
            : "",
        max:
          row.max_qty !== null && row.max_qty !== undefined
            ? String(row.max_qty)
            : "",
      };
    });
    setThresholdDrafts(drafts);
  }, [stock]);

  const sortedStock = useMemo(() => {
    const rank: Record<StatusEstoque, number> = {
      critico: 0,
      baixo: 1,
      normal: 2,
    };

    return [...stock].sort((a, b) => {
      const sa = getStatusFromRow(a);
      const sb = getStatusFromRow(b);

      if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];

      const na = (a.product?.name ?? "").trim();
      const nb = (b.product?.name ?? "").trim();

      const cmp = na.localeCompare(nb, "pt-BR", {
        sensitivity: "base",
        numeric: true,
      });
      if (cmp !== 0) return cmp;

      return String(a.id).localeCompare(String(b.id));
    });
  }, [stock]);

  const totalItens = stock.length;

  const valorTotal = useMemo(() => {
    return stock.reduce((acc, row) => {
      const price = row.product?.price ?? 0;
      return acc + row.quantity * price;
    }, 0);
  }, [stock]);

  const totalCriticos = useMemo(
    () => stock.filter((row) => getStatusFromRow(row) === "critico").length,
    [stock]
  );

  const totalBaixos = useMemo(
    () => stock.filter((row) => getStatusFromRow(row) === "baixo").length,
    [stock]
  );

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  const openInventoryModal = async () => {
    setLoadingInventory(true);
    try {
      const existing = await getInventorySessionWithItems();

      if (existing) {
        setInventorySession(existing.session as InventorySession);
        setInventoryItems(existing.items as InventoryItem[]);
      } else {
        const created = (await startInventorySession()) as InventorySession;
        setInventorySession(created);
        setInventoryItems([]);
      }

      setInventoryModalOpen(true);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao iniciar inventário",
        description: e?.message ?? "Não foi possível iniciar a sessão.",
        variant: "destructive",
      });
    } finally {
      setLoadingInventory(false);
    }
  };

  const closeInventoryModal = () => {
    setInventoryModalOpen(false);
    setSelectedProductId("");
    setCountedQuantity("");
  };

  const handleAddInventoryItem = async () => {
    if (!inventorySession) {
      toast({
        title: "Inventário não iniciado",
        description: "Inicie o inventário antes de adicionar itens.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedProductId) {
      toast({
        title: "Selecione um produto",
        description: "Escolha um produto para registrar a contagem.",
        variant: "destructive",
      });
      return;
    }

    const qtyNumber = Number(countedQuantity.replace(",", "."));

    if (!qtyNumber || qtyNumber <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "Informe uma quantidade maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const stockRow = stock.find((s) => s.product?.id === selectedProductId);
    const unitLabelFromStock = stockRow?.unit_label ?? null;
    const productMeta = products.find((p) => p.id === selectedProductId);
    const unitLabel = String(
      unitLabelFromStock ?? productMeta?.default_unit_label ?? "UN"
    ).toUpperCase();

    try {
      setSavingItem(true);

      await addInventoryItem({
        session_id: inventorySession.id,
        product_id: selectedProductId,
        counted_quantity: qtyNumber,
        unit_label: unitLabel,
      });

      const refreshed = await getInventorySessionWithItems();
      if (refreshed) {
        setInventorySession(refreshed.session as InventorySession);
        setInventoryItems(refreshed.items as InventoryItem[]);
      }

      setSelectedProductId("");
      setCountedQuantity("");

      toast({
        title: "Item adicionado",
        description: "A contagem foi registrada para este produto.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao adicionar item",
        description: e?.message ?? "Não foi possível registrar a contagem.",
        variant: "destructive",
      });
    } finally {
      setSavingItem(false);
    }
  };

  const handleFinalizeInventory = async () => {
    if (!inventorySession) return;

    if (
      !confirm(
        "Tem certeza que deseja encerrar este inventário? Os saldos do estoque serão recalculados."
      )
    ) {
      return;
    }

    try {
      setFinalizingInventory(true);
      await finalizeInventory(inventorySession.id);

      const sessionDate = inventorySession.started_at ?? new Date().toISOString();
      setLastInventoryDate(sessionDate);

      toast({
        title: "Inventário encerrado",
        description:
          "Os saldos de estoque foram atualizados com base nas contagens.",
      });

      closeInventoryModal();
      await loadStock();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao encerrar inventário",
        description: e?.message ?? "Não foi possível finalizar o inventário.",
        variant: "destructive",
      });
    } finally {
      setFinalizingInventory(false);
    }
  };

  const selectedProductRow = stock.find(
    (s) => s.product?.id === selectedProductId
  );
  const productMeta = products.find((p) => p.id === selectedProductId);
  const rawSelectedUnit =
    selectedProductRow?.unit_label ??
    selectedProductRow?.product?.default_unit_label ??
    productMeta?.default_unit_label ??
    "";
  const selectedUnit = rawSelectedUnit
    ? rawSelectedUnit.toString().toUpperCase()
    : "";

  const inventoryDateDisplay =
    inventorySession?.started_at ?? new Date().toISOString();

  const handleThresholdChange = (
    balanceId: string,
    field: "min" | "med" | "max",
    value: string
  ) => {
    setThresholdDrafts((prev) => ({
      ...prev,
      [balanceId]: {
        ...(prev[balanceId] ?? { min: "", med: "", max: "" }),
        [field]: value,
      },
    }));
  };

  const handleThresholdBlur = async (balanceId: string) => {
    const draft = thresholdDrafts[balanceId];
    if (!draft) return;

    const min = Number(draft.min || "0");
    const med = Number(draft.med || "0");
    const max = Number(draft.max || "0");

    const row = stock.find((s) => s.id === balanceId);
    if (
      row &&
      row.min_qty === min &&
      row.med_qty === med &&
      row.max_qty === max
    ) {
      return;
    }

    try {
      setSavingThresholdRowId(balanceId);
      await updateStockThresholds(balanceId, min, med, max);
      await loadStock();
      toast({
        title: "Limites atualizados",
        description: "Min/Méd/Máx atualizados com sucesso para este produto.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao atualizar limites",
        description:
          e?.message ?? "Não foi possível atualizar Min/Méd/Máx deste item.",
        variant: "destructive",
      });
    } finally {
      setSavingThresholdRowId(null);
    }
  };

  const buildCsvRows = (rows: StockRow[]) => {
    return rows.map((row) => {
      const status = getStatusFromRow(row);
      const unit = String(
        row.unit_label ?? row.product?.default_unit_label ?? "UN"
      ).toUpperCase();
      const price = row.product?.price ?? 0;
      const total = price * (row.quantity ?? 0);

      return {
        produto: row.product?.name ?? "",
        sku: row.product?.sku ?? "",
        quantidade: row.quantity ?? 0,
        unidade: unit,
        min: row.min_qty ?? 0,
        med: row.med_qty ?? 0,
        max: row.max_qty ?? 0,
        local: row.location ?? "",
        status: statusConfig[status].label,
        valor_unit: price,
        total: total,
      };
    });
  };

  const downloadCsv = (filename: string, rows: StockRow[]) => {
    const data = buildCsvRows(rows);

    const headers = [
      "produto",
      "sku",
      "quantidade",
      "unidade",
      "min",
      "med",
      "max",
      "local",
      "status",
      "valor_unit",
      "total",
    ];

    const delimiter = ";";

    const lines: string[] = [];
    lines.push(headers.join(delimiter));

    for (const r of data) {
      const line = headers.map((h) => escapeCsv((r as any)[h])).join(delimiter);
      lines.push(line);
    }

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportComprar = () => {
    const criticos = sortedStock.filter(
      (r) => getStatusFromRow(r) === "critico"
    );
    downloadCsv("estoque_comprar_criticos.csv", criticos);
  };

  const handleExportGeral = () => {
    downloadCsv("estoque_atual_geral.csv", sortedStock);
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const parseUploadCsvToUpdates = (
    csvText: string
  ): BulkStockMetaUpdateItem[] => {
    const linesRaw = csvText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (linesRaw.length < 2) return [];

    const delimiter = detectDelimiter(linesRaw[0]);
    const headerCells = splitCsvLine(linesRaw[0], delimiter).map(normalizeHeader);

    const colIndex = (nameVariants: string[]) => {
      for (const v of nameVariants) {
        const idx = headerCells.indexOf(normalizeHeader(v));
        if (idx >= 0) return idx;
      }
      return -1;
    };

    const idxBalanceId = colIndex(["balance_id", "id", "stock_balance_id"]);
    const idxProductId = colIndex(["product_id", "produto_id"]);
    const idxSku = colIndex(["sku"]);
    const idxProduto = colIndex(["produto", "product", "name", "nome"]);
    const idxUnidade = colIndex(["unidade", "unit", "unit_label"]);
    const idxLocal = colIndex(["local", "location"]);
    const idxMin = colIndex(["min", "min_qty", "minimo"]);
    const idxMed = colIndex(["med", "med_qty", "medio"]);
    const idxMax = colIndex(["max", "max_qty", "maximo"]);

    const updates: BulkStockMetaUpdateItem[] = [];

    const byProductId = new Map<string, StockRow>();
    const bySku = new Map<string, StockRow>();
    const byName = new Map<string, StockRow>();

    for (const r of stock) {
      const pid = r.product?.id ? String(r.product.id) : "";
      if (pid) byProductId.set(pid, r);

      const sku = r.product?.sku ? String(r.product.sku).trim() : "";
      if (sku) bySku.set(sku.toLowerCase(), r);

      const nm = r.product?.name ? String(r.product.name).trim() : "";
      if (nm) byName.set(nm.toLowerCase(), r);
    }

    for (let i = 1; i < linesRaw.length; i++) {
      const cells = splitCsvLine(linesRaw[i], delimiter);

      const rawBalanceId =
        idxBalanceId >= 0 ? String(cells[idxBalanceId] ?? "").trim() : "";
      const rawProductId =
        idxProductId >= 0 ? String(cells[idxProductId] ?? "").trim() : "";
      const rawSku = idxSku >= 0 ? String(cells[idxSku] ?? "").trim() : "";
      const rawNome =
        idxProduto >= 0 ? String(cells[idxProduto] ?? "").trim() : "";

      let matched: StockRow | undefined;

      if (rawProductId) matched = byProductId.get(rawProductId);
      if (!matched && rawSku) matched = bySku.get(rawSku.toLowerCase());
      if (!matched && rawNome) matched = byName.get(rawNome.toLowerCase());

      const balance_id = rawBalanceId || (matched?.id ? String(matched.id) : "");

      const product_id =
        rawProductId ||
        (matched?.product?.id ? String(matched.product.id) : "");

      if (!balance_id && !product_id) {
        continue;
      }

      let unit_label = "";
      if (idxUnidade >= 0) {
        unit_label = String(cells[idxUnidade] ?? "").trim().toUpperCase();
      }
      const location =
        idxLocal >= 0 ? String(cells[idxLocal] ?? "").trim() : "";

      const min_qty = idxMin >= 0 ? toNumberOrNull(cells[idxMin]) : null;
      const med_qty = idxMed >= 0 ? toNumberOrNull(cells[idxMed]) : null;
      const max_qty = idxMax >= 0 ? toNumberOrNull(cells[idxMax]) : null;

      const payload: BulkStockMetaUpdateItem = {
        balance_id: balance_id || undefined,
        product_id: product_id || undefined,
      };

      if (idxUnidade >= 0) payload.unit_label = unit_label || null;
      if (idxLocal >= 0) payload.location = location || null;
      if (idxMin >= 0) payload.min_qty = min_qty ?? 0;
      if (idxMed >= 0) payload.med_qty = med_qty ?? 0;
      if (idxMax >= 0) payload.max_qty = max_qty ?? 0;

      updates.push(payload);
    }

    return updates;
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;

    try {
      setUploadingCsv(true);

      const text = await file.text();
      const updates = parseUploadCsvToUpdates(text);

      if (!updates || updates.length === 0) {
        toast({
          title: "CSV sem itens válidos",
          description:
            "Não encontrei linhas aplicáveis. Garanta colunas como produto/nome ou product_id/balance_id, e min/med/max/local/unidade.",
          variant: "destructive",
        });
        return;
      }

      await bulkUpdateStockMeta(updates);

      toast({
        title: "Upload aplicado",
        description:
          "Atualizamos Min/Méd/Máx, Local e Unidade em Estoque Atual. (O saldo exibido vem de movimentos/inventário.)",
      });

      await loadStock();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro no upload",
        description: e?.message ?? "Não foi possível processar o CSV.",
        variant: "destructive",
      });
    } finally {
      setUploadingCsv(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Estoque"
        description="Controle de estoque atual, inventário, exportações e atualização de metadados."
      >
        <p className="text-xs text-muted-foreground">
          {lastInventoryDate
            ? `Último inventário encerrado em ${formatDateTime(lastInventoryDate)}`
            : "Nenhum inventário encerrado ainda."}
        </p>
      </DashboardPageHeader>

      <DashboardStatGrid
        items={[
          {
            title: "Total de Itens",
            value: loadingStock ? "…" : totalItens,
            description: "Produtos cadastrados",
            icon: <span className="text-xl">📦</span>,
          },
          {
            title: "Valor Total",
            value: loadingStock ? "R$ 0,00" : formatCurrency(valorTotal),
            description: "Valor do estoque",
            icon: <span className="text-xl">💰</span>,
          },
          {
            title: "Críticos",
            value: loadingStock ? "…" : totalCriticos,
            description: "Abaixo do mínimo",
            icon: <span className="text-xl">🚨</span>,
            valueClassName: "text-red-600",
          },
          {
            title: "Baixos",
            value: loadingStock ? "…" : totalBaixos,
            description: "Próximos ao mínimo",
            icon: <span className="text-xl">⚠️</span>,
            valueClassName: "text-yellow-600",
          },
        ]}
      />

      <DashboardTableShell
        title="Estoque Atual"
        description="Valores após o último inventário."
        toolbar={
          <>
            <Button onClick={openInventoryModal} disabled={loadingInventory}>
              {loadingInventory ? "Abrindo..." : "Inventário"}
            </Button>

            <Button
              variant="outline"
              onClick={handleExportComprar}
              disabled={loadingStock || sortedStock.length === 0}
            >
              Exportar Comprar (CSV)
            </Button>

            <Button
              variant="outline"
              onClick={handleExportGeral}
              disabled={loadingStock || sortedStock.length === 0}
            >
              Exportar Geral (CSV)
            </Button>

            <Button
              onClick={handleClickUpload}
              disabled={uploadingCsv || loadingStock}
            >
              {uploadingCsv ? "Enviando..." : "Upload (CSV)"}
            </Button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => handleFileSelected(e.target.files?.[0] ?? null)}
            />
          </>
        }
        empty={!loadingStock && sortedStock.length === 0}
        emptyState={
          <p className="text-sm text-muted-foreground">
            Nenhum item de estoque cadastrado ainda.
          </p>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Min/Méd/Máx</TableHead>
              <TableHead>Valor Unit.</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loadingStock ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-sm text-muted-foreground"
                >
                  Carregando...
                </TableCell>
              </TableRow>
            ) : (
              sortedStock.map((row) => {
                const status = getStatusFromRow(row);
                const badgeCfg = statusConfig[status];

                const unit = String(
                  row.unit_label ?? row.product?.default_unit_label ?? "UN"
                ).toUpperCase();
                const price = row.product?.price ?? 0;

                const qtyRounded =
                  Math.round(((row.quantity ?? 0) + Number.EPSILON) * 1000) /
                  1000;

                const draft = thresholdDrafts[row.id] ?? {
                  min:
                    row.min_qty !== null && row.min_qty !== undefined
                      ? String(row.min_qty)
                      : "",
                  med:
                    row.med_qty !== null && row.med_qty !== undefined
                      ? String(row.med_qty)
                      : "",
                  max:
                    row.max_qty !== null && row.max_qty !== undefined
                      ? String(row.max_qty)
                      : "",
                };

                const disabled = savingThresholdRowId === row.id;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{row.product?.name ?? "—"}</span>
                        {row.product?.sku && (
                          <span className="text-xs text-muted-foreground">
                            SKU: {row.product.sku}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      {formatQty3(qtyRounded)} {unit}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          className="h-7 w-16 text-xs"
                          value={draft.min}
                          disabled={disabled}
                          onChange={(e) =>
                            handleThresholdChange(
                              row.id,
                              "min",
                              e.target.value
                            )
                          }
                          onBlur={() => handleThresholdBlur(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                        />
                        <span className="text-[10px] text-gray-400">/</span>
                        <Input
                          type="number"
                          className="h-7 w-16 text-xs"
                          value={draft.med}
                          disabled={disabled}
                          onChange={(e) =>
                            handleThresholdChange(
                              row.id,
                              "med",
                              e.target.value
                            )
                          }
                          onBlur={() => handleThresholdBlur(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                        />
                        <span className="text-[10px] text-gray-400">/</span>
                        <Input
                          type="number"
                          className="h-7 w-16 text-xs"
                          value={draft.max}
                          disabled={disabled}
                          onChange={(e) =>
                            handleThresholdChange(
                              row.id,
                              "max",
                              e.target.value
                            )
                          }
                          onBlur={() => handleThresholdBlur(row.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              (e.currentTarget as HTMLInputElement).blur();
                            }
                          }}
                        />
                      </div>
                    </TableCell>

                    <TableCell>{formatCurrency(price)}</TableCell>

                    <TableCell>{formatCurrency(price * qtyRounded)}</TableCell>

                    <TableCell>{row.location ?? "—"}</TableCell>

                    <TableCell>
                      <Badge className={badgeCfg.badgeClass}>
                        {badgeCfg.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </DashboardTableShell>

      {inventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[80vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Inventário em Andamento</h3>
              <Button variant="ghost" onClick={closeInventoryModal}>
                ✕
              </Button>
            </div>

            {loadingInventory ? (
              <p className="text-sm text-muted-foreground">
                Carregando sessão de inventário...
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  Inventário iniciado! Adicione os itens contados abaixo. Ao
                  encerrar o inventário, os saldos de estoque serão atualizados
                  com estas quantidades.
                </div>

                <div className="flex justify-between text-xs text-gray-600 dark:text-slate-400">
                  <span>
                    Data do inventário:{" "}
                    <span className="font-medium">
                      {formatDateTime(inventoryDateDisplay)}
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr_1fr]">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="produto">Produto</Label>
                    <select
                      id="produto"
                      className="rounded-md border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                    >
                      <option value="">Selecione um produto</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="quantidade">Quantidade</Label>
                    <Input
                      id="quantidade"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0"
                      value={countedQuantity}
                      onChange={(e) => setCountedQuantity(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <Label htmlFor="unidade">Unidade</Label>
                    <Input
                      id="unidade"
                      readOnly
                      value={selectedUnit || ""}
                      placeholder="Unidade"
                    />
                  </div>
                </div>

                <Button
                  className="mt-2 w-full bg-emerald-600 font-semibold text-white shadow-sm hover:bg-emerald-700"
                  onClick={handleAddInventoryItem}
                  disabled={savingItem}
                >
                  {savingItem ? "Salvando..." : "Adicionar Item"}
                </Button>

                <div className="border-t pt-4 dark:border-slate-800">
                  <h4 className="mb-2 font-medium">
                    Itens Contados ({inventoryItems.length})
                  </h4>

                  {inventoryItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum item foi contado ainda.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead>Qtd.</TableHead>
                          <TableHead>Un.</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventoryItems.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.product?.name ?? "—"}</TableCell>
                            <TableCell>{item.counted_quantity}</TableCell>
                            <TableCell>
                              {String(item.unit_label ?? "UN").toUpperCase()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={closeInventoryModal}>
                    Fechar
                  </Button>
                  <Button
                    variant="destructive"
                    className="bg-red-600 text-white hover:bg-red-700"
                    onClick={handleFinalizeInventory}
                    disabled={finalizingInventory}
                  >
                    {finalizingInventory
                      ? "Encerrando..."
                      : "Encerrar Inventário"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}