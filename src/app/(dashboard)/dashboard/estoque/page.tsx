// src/app/(dashboard)/dashboard/estoque/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
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
  createStockMovementAction,
  zeroStockBalanceAction,
  updateInventoryItem,
  deleteInventoryItem,
  listRecentStockMovements,
  type BulkStockMetaUpdateItem,
  type RecentStockMovementRow,
} from "./actions";

import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DashboardStatGrid } from "@/components/dashboard/DashboardStatGrid";
import { DashboardTableShell } from "@/components/dashboard/DashboardTableShell";

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
type StatusFilter = "todos" | StatusEstoque;
type AdjustmentType = "IN" | "OUT";

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

type LocationDrafts = Record<
  string,
  {
    location: string;
  }
>;

type InventoryItemDrafts = Record<string, string>;

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

function normalizeTextSearch(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizeUnit(value: string | null | undefined) {
  const v = String(value ?? "").trim().toUpperCase();
  return v || "UN";
}

function formatMovementDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

function getMovementLabel(mv?: RecentStockMovementRow) {
  if (!mv) return "—";
  const dir = String(mv.direction ?? "").toUpperCase();
  const qty = Number(mv.qty ?? 0);
  const unit = String(mv.unit_label ?? "UN").toUpperCase();
  const sign = dir === "OUT" ? "-" : "+";
  return `${sign}${qty} ${unit}`;
}

function getMovementReason(mv?: RecentStockMovementRow) {
  if (!mv) return "—";
  return mv.reason ?? mv.movement_type ?? "—";
}

function formatThresholdInputValue(value: number | null | undefined) {
  if (value === null || value === undefined || Number(value) === 0) return "";
  return String(value);
}

function formatThresholdDisplayValue(value: number | null | undefined) {
  if (value === null || value === undefined || Number(value) === 0) return "—";
  return String(value);
}

function parseOptionalNumberInput(value: string) {
  const raw = String(value ?? "").trim().replace(",", ".");
  if (!raw) return null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeThresholdForCompare(value: number | null | undefined) {
  return value === null || value === undefined ? null : Number(value);
}

export default function EstoquePage() {
  const { toast } = useToast();

  const [stock, setStock] = useState<StockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [syncingStock, setSyncingStock] = useState(false);

  const [thresholdDrafts, setThresholdDrafts] = useState<ThresholdDrafts>({});
  const [locationDrafts, setLocationDrafts] = useState<LocationDrafts>({});
  const [inventoryItemDrafts, setInventoryItemDrafts] =
    useState<InventoryItemDrafts>({});

  const [recentMovementsByProduct, setRecentMovementsByProduct] = useState<
    Record<string, RecentStockMovementRow>
  >({});

  const [savingThresholdRowId, setSavingThresholdRowId] =
    useState<string | null>(null);
  const [savingLocationRowId, setSavingLocationRowId] = useState<string | null>(
    null
  );
  const [savingInventoryItemId, setSavingInventoryItemId] = useState<
    string | null
  >(null);
  const [deletingInventoryItemId, setDeletingInventoryItemId] = useState<
    string | null
  >(null);

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

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [onlyWithQty, setOnlyWithQty] = useState(false);
  const [locationFilter, setLocationFilter] = useState("todos");

  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false);
  const [adjustmentProductId, setAdjustmentProductId] = useState("");
  const [adjustmentBalanceId, setAdjustmentBalanceId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("IN");
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("AJUSTE_MANUAL");
  const [adjustmentMin, setAdjustmentMin] = useState("");
  const [adjustmentMed, setAdjustmentMed] = useState("");
  const [adjustmentMax, setAdjustmentMax] = useState("");
  const [savingAdjustment, setSavingAdjustment] = useState(false);
  const [zeroStockBalance, setZeroStockBalance] = useState(false);

  const loadRecentMovements = async () => {
    try {
      const rows = await listRecentStockMovements();
      const map: Record<string, RecentStockMovementRow> = {};

      for (const mv of rows) {
        const pid = String(mv.product_id ?? "");
        if (!pid) continue;
        if (!map[pid]) {
          map[pid] = mv;
        }
      }

      setRecentMovementsByProduct(map);
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao carregar movimentações",
        description:
          e?.message ?? "Não foi possível carregar a última movimentação.",
        variant: "destructive",
      });
    }
  };

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

  const refreshMainData = async () => {
    await Promise.all([loadStock(), loadRecentMovements()]);
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

  const refreshInventorySession = async () => {
    const refreshed = await getInventorySessionWithItems();
    if (refreshed) {
      setInventorySession(refreshed.session as InventorySession);
      setInventoryItems(refreshed.items as InventoryItem[]);
    } else {
      setInventorySession(null);
      setInventoryItems([]);
    }
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

        await refreshMainData();

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
    const thresholds: ThresholdDrafts = {};
    const locations: LocationDrafts = {};

    stock.forEach((row) => {
      thresholds[row.id] = {
        min: formatThresholdInputValue(row.min_qty),
        med: formatThresholdInputValue(row.med_qty),
        max: formatThresholdInputValue(row.max_qty),
      };

      locations[row.id] = {
        location: row.location ?? "",
      };
    });

    setThresholdDrafts(thresholds);
    setLocationDrafts(locations);
  }, [stock]);

  useEffect(() => {
    const drafts: InventoryItemDrafts = {};
    inventoryItems.forEach((item) => {
      drafts[item.id] = String(item.counted_quantity ?? "");
    });
    setInventoryItemDrafts(drafts);
  }, [inventoryItems]);

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

  const locationOptions = useMemo(() => {
    const values = Array.from(
      new Set(
        stock
          .map((row) => String(row.location ?? "").trim())
          .filter((v) => v.length > 0)
      )
    ).sort((a, b) =>
      a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true })
    );

    return values;
  }, [stock]);

  const filteredStock = useMemo(() => {
    const term = normalizeTextSearch(searchTerm);

    return sortedStock.filter((row) => {
      const status = getStatusFromRow(row);
      const name = normalizeTextSearch(row.product?.name);
      const sku = normalizeTextSearch(row.product?.sku);
      const location = normalizeTextSearch(row.location);
      const reason = normalizeTextSearch(
        getMovementReason(recentMovementsByProduct[row.product?.id ?? ""])
      );

      const matchesSearch =
        !term ||
        name.includes(term) ||
        sku.includes(term) ||
        location.includes(term) ||
        reason.includes(term);

      const matchesStatus =
        statusFilter === "todos" ? true : status === statusFilter;

      const matchesQty = onlyWithQty ? (row.quantity ?? 0) > 0 : true;

      const matchesLocation =
        locationFilter === "todos"
          ? true
          : normalizeTextSearch(row.location) ===
            normalizeTextSearch(locationFilter);

      return matchesSearch && matchesStatus && matchesQty && matchesLocation;
    });
  }, [
    sortedStock,
    searchTerm,
    statusFilter,
    onlyWithQty,
    locationFilter,
    recentMovementsByProduct,
  ]);

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

  const openAdjustmentModal = (preset?: {
    productId?: string;
    balanceId?: string;
    reason?: string;
  }) => {
    const selectedRow = stock.find(
      (row) =>
        row.id === preset?.balanceId ||
        row.product?.id === preset?.productId
    );

    if (selectedRow?.product?.id) {
      setAdjustmentProductId(selectedRow.product.id);
    } else {
      setAdjustmentProductId(preset?.productId ?? "");
    }

    setAdjustmentBalanceId(selectedRow?.id ?? preset?.balanceId ?? "");
    setAdjustmentReason(preset?.reason ?? "AJUSTE_MANUAL");
    setAdjustmentMin(formatThresholdInputValue(selectedRow?.min_qty));
    setAdjustmentMed(formatThresholdInputValue(selectedRow?.med_qty));
    setAdjustmentMax(formatThresholdInputValue(selectedRow?.max_qty));
    setAdjustmentModalOpen(true);
  };

  const closeAdjustmentModal = () => {
    setAdjustmentModalOpen(false);
    setAdjustmentProductId("");
    setAdjustmentBalanceId("");
    setAdjustmentType("IN");
    setAdjustmentQty("");
    setAdjustmentReason("AJUSTE_MANUAL");
    setAdjustmentMin("");
    setAdjustmentMed("");
    setAdjustmentMax("");
    setZeroStockBalance(false);
  };

  const handleSyncStock = async () => {
    try {
      setSyncingStock(true);
      await seedInitialStockFromProducts();
      await refreshMainData();

      toast({
        title: "Estoque sincronizado",
        description:
          "Produtos sem estrutura de estoque foram vinculados com sucesso.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao sincronizar estoque",
        description:
          e?.message ??
          "Não foi possível sincronizar produtos faltantes no estoque.",
        variant: "destructive",
      });
    } finally {
      setSyncingStock(false);
    }
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
    const productMeta = products.find((p) => p.id === selectedProductId);
    const unitLabel = String(
      productMeta?.default_unit_label ??
        stockRow?.product?.default_unit_label ??
        stockRow?.unit_label ??
        "UN"
    ).toUpperCase();

    try {
      setSavingItem(true);

      await addInventoryItem({
        session_id: inventorySession.id,
        product_id: selectedProductId,
        counted_quantity: qtyNumber,
        unit_label: unitLabel,
      });

      await refreshInventorySession();

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

  const handleSaveInventoryItem = async (item: InventoryItem) => {
    const raw = inventoryItemDrafts[item.id];
    const qty = Number(String(raw ?? "").replace(",", "."));

    if (!Number.isFinite(qty) || qty < 0) {
      toast({
        title: "Quantidade inválida",
        description: "Informe zero ou um valor maior.",
        variant: "destructive",
      });
      return;
    }

    if (qty === Number(item.counted_quantity ?? 0)) {
      return;
    }

    try {
      setSavingInventoryItemId(item.id);
      await updateInventoryItem(item.id, qty);
      await refreshInventorySession();

      toast({
        title: "Item atualizado",
        description: "A contagem do item foi atualizada.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao atualizar item",
        description: e?.message ?? "Não foi possível atualizar o item contado.",
        variant: "destructive",
      });
    } finally {
      setSavingInventoryItemId(null);
    }
  };

  const handleDeleteInventoryItem = async (item: InventoryItem) => {
    const confirmed = confirm(
      `Deseja remover o item contado "${item.product?.name ?? "sem nome"}"?`
    );
    if (!confirmed) return;

    try {
      setDeletingInventoryItemId(item.id);
      await deleteInventoryItem(item.id);
      await refreshInventorySession();

      toast({
        title: "Item removido",
        description: "O item foi removido do inventário em andamento.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao remover item",
        description: e?.message ?? "Não foi possível remover o item contado.",
        variant: "destructive",
      });
    } finally {
      setDeletingInventoryItemId(null);
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

      const sessionDate =
        inventorySession.started_at ?? new Date().toISOString();
      setLastInventoryDate(sessionDate);

      toast({
        title: "Inventário encerrado",
        description:
          "Os saldos de estoque foram atualizados com base nas contagens.",
      });

      closeInventoryModal();
      await refreshMainData();
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
    productMeta?.default_unit_label ??
    selectedProductRow?.product?.default_unit_label ??
    selectedProductRow?.unit_label ??
    "";
  const selectedUnit = rawSelectedUnit
    ? rawSelectedUnit.toString().toUpperCase()
    : "";

  const inventoryDateDisplay =
    inventorySession?.started_at ?? new Date().toISOString();

  const adjustmentSelectedRow = stock.find(
    (s) => s.product?.id === adjustmentProductId
  );
  const adjustmentSelectedProduct = products.find(
    (p) => p.id === adjustmentProductId
  );
  const currentAdjustmentUnit = normalizeUnit(
    adjustmentSelectedProduct?.default_unit_label ??
      adjustmentSelectedRow?.product?.default_unit_label ??
      adjustmentSelectedRow?.unit_label ??
      "UN"
  );

  const handleCreateManualAdjustment = async () => {
    if (!adjustmentProductId) {
      toast({
        title: "Selecione um produto",
        description: "Escolha o produto que terá ajuste manual.",
        variant: "destructive",
      });
      return;
    }

    const selectedRow = stock.find((s) => s.product?.id === adjustmentProductId);

    if (!selectedRow?.id) {
      toast({
        title: "Produto sem vínculo de estoque",
        description:
          "Não foi possível localizar a linha de estoque desse produto.",
        variant: "destructive",
      });
      return;
    }

    const parsedMin = parseOptionalNumberInput(adjustmentMin);
    const parsedMed = parseOptionalNumberInput(adjustmentMed);
    const parsedMax = parseOptionalNumberInput(adjustmentMax);

    if (
      Number.isNaN(parsedMin) ||
      Number.isNaN(parsedMed) ||
      Number.isNaN(parsedMax)
    ) {
      toast({
        title: "Valores inválidos",
        description: "Preencha Min/Méd/Máx somente com números válidos.",
        variant: "destructive",
      });
      return;
    }

    const minForValidation = parsedMin ?? 0;
    const medForValidation = parsedMed ?? 0;
    const maxForValidation = parsedMax ?? 0;

    if (minForValidation < 0 || medForValidation < 0 || maxForValidation < 0) {
      toast({
        title: "Valores inválidos",
        description: "Min/Méd/Máx não podem ser negativos.",
        variant: "destructive",
      });
      return;
    }

    if (medForValidation < minForValidation) {
      toast({
        title: "Valores inválidos",
        description: "O valor médio não pode ser menor que o mínimo.",
        variant: "destructive",
      });
      return;
    }

    if (maxForValidation < medForValidation) {
      toast({
        title: "Valores inválidos",
        description: "O valor máximo não pode ser menor que o médio.",
        variant: "destructive",
      });
      return;
    }

    const thresholdChanged =
      normalizeThresholdForCompare(selectedRow.min_qty) !==
        normalizeThresholdForCompare(parsedMin) ||
      normalizeThresholdForCompare(selectedRow.med_qty) !==
        normalizeThresholdForCompare(parsedMed) ||
      normalizeThresholdForCompare(selectedRow.max_qty) !==
        normalizeThresholdForCompare(parsedMax);

    try {
      setSavingAdjustment(true);

      if (thresholdChanged) {
        setSavingThresholdRowId(selectedRow.id);
        await updateStockThresholds(
          selectedRow.id,
          parsedMin,
          parsedMed,
          parsedMax
        );
      }

      if (zeroStockBalance) {
        await zeroStockBalanceAction({
          product_id: adjustmentProductId,
          reason: adjustmentReason || "ZERAR_SALDO_ESTOQUE",
        });

        toast({
          title: "Ajuste aplicado",
          description: thresholdChanged
            ? "Saldo zerado e limites Min/Méd/Máx atualizados com sucesso."
            : "O saldo do produto foi ajustado para 0,000.",
        });

        closeAdjustmentModal();
        await refreshMainData();
        return;
      }

      const rawQty = String(adjustmentQty ?? "").trim();
      const hasMovement = rawQty.length > 0;
      const qty = Number(rawQty.replace(",", "."));

      if (hasMovement) {
        if (!Number.isFinite(qty) || qty <= 0) {
          toast({
            title: "Quantidade inválida",
            description: "Informe uma quantidade maior que zero.",
            variant: "destructive",
          });
          return;
        }

        const signedQty = adjustmentType === "OUT" ? -qty : qty;

        await createStockMovementAction({
          product_id: adjustmentProductId,
          unit_label: currentAdjustmentUnit,
          qty_delta: signedQty,
          reason: adjustmentReason || "AJUSTE_MANUAL",
          source: "manual_adjustment_modal",
        });
      }

      if (!thresholdChanged && !hasMovement) {
        toast({
          title: "Nada para aplicar",
          description:
            "Altere Min/Méd/Máx ou informe uma quantidade para ajuste.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Ajuste aplicado",
        description:
          thresholdChanged && hasMovement
            ? "Movimentação e limites Min/Méd/Máx atualizados com sucesso."
            : thresholdChanged
              ? "Limites Min/Méd/Máx atualizados com sucesso."
              : adjustmentType === "IN"
                ? "Entrada manual registrada com sucesso."
                : "Saída manual registrada com sucesso.",
      });

      closeAdjustmentModal();
      await refreshMainData();
    } catch (e: any) {
      console.error(e);
      toast({
        title: zeroStockBalance ? "Erro ao zerar saldo" : "Erro no ajuste manual",
        description:
          e?.message ?? "Não foi possível registrar o ajuste manual.",
        variant: "destructive",
      });
    } finally {
      setSavingAdjustment(false);
      setSavingThresholdRowId(null);
    }
  };

  const handleLocationDraftChange = (balanceId: string, value: string) => {
    setLocationDrafts((prev) => ({
      ...prev,
      [balanceId]: {
        location: value,
      },
    }));
  };

  const handleLocationBlur = async (row: StockRow) => {
    const draft = locationDrafts[row.id];
    if (!draft) return;

    const nextLocation = String(draft.location ?? "").trim();
    const currentLocation = String(row.location ?? "").trim();

    if (nextLocation === currentLocation) {
      return;
    }

    try {
      setSavingLocationRowId(row.id);

      const payload: BulkStockMetaUpdateItem = {
        balance_id: row.id,
        product_id: row.product?.id ?? undefined,
        location: nextLocation || null,
      };

      await bulkUpdateStockMeta([payload]);
      await refreshMainData();

      toast({
        title: "Local atualizado",
        description: "Local do item atualizado com sucesso.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao atualizar local",
        description:
          e?.message ?? "Não foi possível atualizar o local deste item.",
        variant: "destructive",
      });
    } finally {
      setSavingLocationRowId(null);
    }
  };

  const buildCsvRows = (rows: StockRow[]) => {
    return rows.map((row) => {
      const status = getStatusFromRow(row);
      const unit = String(
        row.product?.default_unit_label ?? row.unit_label ?? "UN"
      ).toUpperCase();
      const price = row.product?.price ?? 0;
      const total = price * (row.quantity ?? 0);
      const mv = recentMovementsByProduct[row.product?.id ?? ""];

      return {
        produto: row.product?.name ?? "",
        sku: row.product?.sku ?? "",
        quantidade: row.quantity ?? 0,
        unidade: unit,
        min: row.min_qty ?? "",
        med: row.med_qty ?? "",
        max: row.max_qty ?? "",
        local: row.location ?? "",
        status: statusConfig[status].label,
        valor_unit: price,
        total: total,
        ultima_movimentacao: getMovementLabel(mv),
        motivo_recente: getMovementReason(mv),
        data_movimentacao: mv?.created_at ?? "",
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
      "ultima_movimentacao",
      "motivo_recente",
      "data_movimentacao",
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
    const criticos = filteredStock.filter(
      (r) => getStatusFromRow(r) === "critico"
    );
    downloadCsv("estoque_comprar_criticos.csv", criticos);
  };

  const handleExportGeral = () => {
    downloadCsv("estoque_atual_geral.csv", filteredStock);
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
    const headerCells = splitCsvLine(linesRaw[0], delimiter).map(
      normalizeHeader
    );

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
        rawProductId || (matched?.product?.id ? String(matched.product.id) : "");

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
      if (idxMin >= 0) payload.min_qty = min_qty;
      if (idxMed >= 0) payload.med_qty = med_qty;
      if (idxMax >= 0) payload.max_qty = max_qty;

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

      await refreshMainData();
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

  const activeFiltersCount =
    (searchTerm.trim() ? 1 : 0) +
    (statusFilter !== "todos" ? 1 : 0) +
    (onlyWithQty ? 1 : 0) +
    (locationFilter !== "todos" ? 1 : 0);

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
            description: "Produtos estruturados no estoque",
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
        description={`Exibindo ${filteredStock.length} de ${sortedStock.length} itens${
          activeFiltersCount > 0 ? ` • ${activeFiltersCount} filtro(s) ativo(s)` : ""
        }.`}
        toolbar={
          <>
            <Button onClick={openInventoryModal} disabled={loadingInventory}>
              {loadingInventory ? "Abrindo..." : "Inventário"}
            </Button>

            <Button onClick={() => openAdjustmentModal()} variant="outline">
              Ajuste Manual
            </Button>

            <Button
              variant="outline"
              onClick={handleSyncStock}
              disabled={syncingStock || loadingStock}
            >
              {syncingStock ? "Sincronizando..." : "Sincronizar Estoque"}
            </Button>

            <Button
              variant="outline"
              onClick={handleExportComprar}
              disabled={loadingStock || filteredStock.length === 0}
            >
              Exportar Comprar (CSV)
            </Button>

            <Button
              variant="outline"
              onClick={handleExportGeral}
              disabled={loadingStock || filteredStock.length === 0}
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
        empty={!loadingStock && filteredStock.length === 0}
        emptyState={
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Nenhum item encontrado para os filtros atuais.
            </p>
            {activeFiltersCount > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("todos");
                  setOnlyWithQty(false);
                  setLocationFilter("todos");
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        }
      >
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_auto_auto] md:items-end">
          <div className="flex flex-col gap-1">
            <Label htmlFor="search" className="min-h-5 text-xs font-medium leading-5">
              Buscar por produto, SKU, local ou motivo
            </Label>
            <Input
              id="search"
              className="h-10"
              placeholder="Ex.: farinha, 1001711, estoque principal, avaria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label
              htmlFor="status-filter"
              className="min-h-5 text-xs font-medium leading-5"
            >
              Status
            </Label>
            <select
              id="status-filter"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="todos">Todos</option>
              <option value="critico">Crítico</option>
              <option value="baixo">Baixo</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <Label
              htmlFor="location-filter"
              className="min-h-5 text-xs font-medium leading-5"
            >
              Local
            </Label>
            <select
              id="location-filter"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
            >
              <option value="todos">Todos</option>
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex h-10 items-center gap-2 rounded-md border px-3 text-sm whitespace-nowrap">
              <input
                type="checkbox"
                checked={onlyWithQty}
                onChange={(e) => setOnlyWithQty(e.target.checked)}
              />
              <span>Somente com saldo</span>
            </label>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("todos");
                setOnlyWithQty(false);
                setLocationFilter("todos");
              }}
              disabled={activeFiltersCount === 0}
            >
              Limpar filtros
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-30 min-w-[360px] bg-white shadow-[4px_0_8px_-6px_rgba(0,0,0,0.18)] dark:bg-slate-950">
                  Produto
                </TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Min/Méd/Máx</TableHead>
                <TableHead>Valor Unit.</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Últ. mov.</TableHead>
                <TableHead>Motivo recente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loadingStock ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="text-sm text-muted-foreground"
                  >
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : (
                filteredStock.map((row) => {
                  const status = getStatusFromRow(row);
                  const badgeCfg = statusConfig[status];
                  const movement =
                    recentMovementsByProduct[row.product?.id ?? ""] ?? undefined;

                  const unit = String(
                    row.product?.default_unit_label ?? row.unit_label ?? "UN"
                  ).toUpperCase();
                  const price = row.product?.price ?? 0;

                  const qtyRounded =
                    Math.round(((row.quantity ?? 0) + Number.EPSILON) * 1000) /
                    1000;

                  const locationDraft = locationDrafts[row.id] ?? {
                    location: row.location ?? "",
                  };

                  const locationDisabled = savingLocationRowId === row.id;

                  return (
                    <TableRow key={row.id}>
                      <TableCell className="sticky left-0 z-20 min-w-[360px] bg-white font-medium shadow-[4px_0_8px_-6px_rgba(0,0,0,0.18)] dark:bg-slate-950">
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
                        <div className="font-medium text-foreground">
                          {formatThresholdDisplayValue(row.min_qty)} /{" "}
                          {formatThresholdDisplayValue(row.med_qty)} /{" "}
                          {formatThresholdDisplayValue(row.max_qty)}
                        </div>
                      </TableCell>

                      <TableCell>{formatCurrency(price)}</TableCell>
                      <TableCell>{formatCurrency(price * qtyRounded)}</TableCell>

                      <TableCell>
                        <Input
                          className="h-8 min-w-[150px] text-xs"
                          value={locationDraft.location}
                          disabled={locationDisabled}
                          placeholder="Ex.: Estoque Principal"
                          onChange={(e) =>
                            handleLocationDraftChange(row.id, e.target.value)
                          }
                          onBlur={() => handleLocationBlur(row)}
                        />
                      </TableCell>

                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span>{getMovementLabel(movement)}</span>
                          <span className="text-muted-foreground">
                            {formatMovementDate(movement?.created_at)}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="max-w-[180px] text-xs">
                        <span className="line-clamp-2">
                          {getMovementReason(movement)}
                        </span>
                      </TableCell>

                      <TableCell>
                        <Badge className={badgeCfg.badgeClass}>
                          {badgeCfg.label}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openAdjustmentModal({
                              productId: row.product?.id,
                              balanceId: row.id,
                              reason: "AJUSTE_POR_LINHA",
                            })
                          }
                        >
                          Ajustar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </DashboardTableShell>

      {inventoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg dark:bg-slate-950">
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
                  Inventário iniciado. Adicione, edite ou remova itens contados
                  abaixo. Ao encerrar o inventário, os saldos serão reconciliados
                  com base nas contagens.
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
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventoryItems.map((item) => {
                          const isSaving = savingInventoryItemId === item.id;
                          const isDeleting = deletingInventoryItemId === item.id;

                          return (
                            <TableRow key={item.id}>
                              <TableCell>{item.product?.name ?? "—"}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  className="h-8 w-28"
                                  value={inventoryItemDrafts[item.id] ?? ""}
                                  disabled={isSaving || isDeleting}
                                  onChange={(e) =>
                                    setInventoryItemDrafts((prev) => ({
                                      ...prev,
                                      [item.id]: e.target.value,
                                    }))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                {String(item.unit_label ?? "UN").toUpperCase()}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={isSaving || isDeleting}
                                    onClick={() => handleSaveInventoryItem(item)}
                                  >
                                    {isSaving ? "Salvando..." : "Salvar"}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    disabled={isSaving || isDeleting}
                                    onClick={() => handleDeleteInventoryItem(item)}
                                  >
                                    {isDeleting ? "Removendo..." : "Remover"}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
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

      {adjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Ajuste Manual de Estoque</h3>
              <Button variant="ghost" onClick={closeAdjustmentModal}>
                ✕
              </Button>
            </div>

            <div className="space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                Use este recurso para correções rápidas de saldo e para editar
                os limites de Min/Méd/Máx do produto selecionado.
              </div>

              <label className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={zeroStockBalance}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setZeroStockBalance(checked);

                    if (checked) {
                      setAdjustmentQty("");
                      setAdjustmentType("OUT");
                      setAdjustmentReason("ZERAR_SALDO_ESTOQUE");
                    } else {
                      setAdjustmentReason("AJUSTE_MANUAL");
                    }
                  }}
                />
                <span>Zerar saldo do estoque deste produto ao aplicar ajuste</span>
              </label>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1 md:col-span-2">
                  <Label htmlFor="adjustment-product">Produto</Label>
                  <select
                    id="adjustment-product"
                    className="rounded-md border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    value={adjustmentProductId}
                    onChange={(e) => {
                      const nextProductId = e.target.value;
                      setAdjustmentProductId(nextProductId);

                      const nextRow = stock.find(
                        (row) => row.product?.id === nextProductId
                      );

                      setAdjustmentBalanceId(nextRow?.id ?? "");
                      setAdjustmentMin(formatThresholdInputValue(nextRow?.min_qty));
                      setAdjustmentMed(formatThresholdInputValue(nextRow?.med_qty));
                      setAdjustmentMax(formatThresholdInputValue(nextRow?.max_qty));
                    }}
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
                  <Label htmlFor="adjustment-type">Tipo de ajuste</Label>
                  <select
                    id="adjustment-type"
                    className="rounded-md border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    value={adjustmentType}
                    disabled={zeroStockBalance}
                    onChange={(e) =>
                      setAdjustmentType(e.target.value as AdjustmentType)
                    }
                  >
                    <option value="IN">Entrada</option>
                    <option value="OUT">Saída</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="adjustment-qty">Quantidade</Label>
                  <Input
                    id="adjustment-qty"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="Deixe em branco se quiser só editar Min/Méd/Máx"
                    value={adjustmentQty}
                    disabled={zeroStockBalance}
                    onChange={(e) => setAdjustmentQty(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="adjustment-unit">Unidade do produto</Label>
                  <Input
                    id="adjustment-unit"
                    readOnly
                    value={adjustmentProductId ? currentAdjustmentUnit : ""}
                    placeholder="Unidade"
                  />
                  {adjustmentProductId && (
                    <span className="text-xs text-muted-foreground">
                      A unidade é definida no cadastro do produto e não pode ser
                      alterada por esta tela.
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="adjustment-reason">Motivo</Label>
                  <Input
                    id="adjustment-reason"
                    placeholder="Ex.: AVARIA, PERDA, ENTRADA_MANUAL..."
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                  />
                </div>

                <div className="md:col-span-2 rounded-md border p-4">
                  <div className="mb-3">
                    <h4 className="text-sm font-semibold">Limites do estoque</h4>
                    <p className="text-xs text-muted-foreground">
                      Estes campos só podem ser alterados por aqui ao clicar em
                      Aplicar Ajuste.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <div className="flex flex-col gap-1">
                      <Label htmlFor="adjustment-min">Mínimo</Label>
                      <Input
                        id="adjustment-min"
                        type="number"
                        min={0}
                        step="0.001"
                        placeholder="Em branco"
                        value={adjustmentMin}
                        onChange={(e) => setAdjustmentMin(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="adjustment-med">Médio</Label>
                      <Input
                        id="adjustment-med"
                        type="number"
                        min={0}
                        step="0.001"
                        placeholder="Em branco"
                        value={adjustmentMed}
                        onChange={(e) => setAdjustmentMed(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <Label htmlFor="adjustment-max">Máximo</Label>
                      <Input
                        id="adjustment-max"
                        type="number"
                        min={0}
                        step="0.001"
                        placeholder="Em branco"
                        value={adjustmentMax}
                        onChange={(e) => setAdjustmentMax(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeAdjustmentModal}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateManualAdjustment}
                  disabled={savingAdjustment || savingThresholdRowId === adjustmentBalanceId}
                >
                  {savingAdjustment ? "Salvando..." : "Aplicar Ajuste"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}