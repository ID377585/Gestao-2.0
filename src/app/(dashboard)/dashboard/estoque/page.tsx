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

type MetaDrafts = Record<
  string,
  {
    unit_label: string;
    location: string;
  }
>;

type InventoryItemDrafts = Record<string, string>;

const UNIT_OPTIONS = ["UN", "KG", "G", "L", "ML"] as const;

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

export default function EstoquePage() {
  const { toast } = useToast();

  const [stock, setStock] = useState<StockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [syncingStock, setSyncingStock] = useState(false);

  const [thresholdDrafts, setThresholdDrafts] = useState<ThresholdDrafts>({});
  const [metaDrafts, setMetaDrafts] = useState<MetaDrafts>({});
  const [inventoryItemDrafts, setInventoryItemDrafts] =
    useState<InventoryItemDrafts>({});

  const [recentMovementsByProduct, setRecentMovementsByProduct] = useState<
    Record<string, RecentStockMovementRow>
  >({});

  const [savingThresholdRowId, setSavingThresholdRowId] =
    useState<string | null>(null);
  const [savingMetaRowId, setSavingMetaRowId] = useState<string | null>(null);
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
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("IN");
  const [adjustmentQty, setAdjustmentQty] = useState("");
  const [adjustmentUnit, setAdjustmentUnit] = useState("UN");
  const [adjustmentReason, setAdjustmentReason] = useState("AJUSTE_MANUAL");
  const [savingAdjustment, setSavingAdjustment] = useState(false);

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
    const metas: MetaDrafts = {};

    stock.forEach((row) => {
      thresholds[row.id] = {
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

      metas[row.id] = {
        unit_label: normalizeUnit(
          row.unit_label ?? row.product?.default_unit_label ?? "UN"
        ),
        location: row.location ?? "",
      };
    });

    setThresholdDrafts(thresholds);
    setMetaDrafts(metas);
  }, [stock]);

  useEffect(() => {
    const drafts: InventoryItemDrafts = {};
    inventoryItems.forEach((item) => {
      drafts[item.id] = String(item.counted_quantity ?? "");
    });
    setInventoryItemDrafts(drafts);
  }, [inventoryItems]);

  useEffect(() => {
    const selectedRow = stock.find((s) => s.product?.id === adjustmentProductId);
    const selectedProduct = products.find((p) => p.id === adjustmentProductId);

    const suggestedUnit = normalizeUnit(
      selectedRow?.unit_label ??
        selectedRow?.product?.default_unit_label ??
        selectedProduct?.default_unit_label ??
        "UN"
    );

    setAdjustmentUnit(suggestedUnit);
  }, [adjustmentProductId, stock, products]);

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
    unitLabel?: string | null;
    reason?: string;
  }) => {
    if (preset?.productId) {
      setAdjustmentProductId(preset.productId);
    }
    if (preset?.unitLabel) {
      setAdjustmentUnit(normalizeUnit(preset.unitLabel));
    }
    if (preset?.reason) {
      setAdjustmentReason(preset.reason);
    }
    setAdjustmentModalOpen(true);
  };

  const closeAdjustmentModal = () => {
    setAdjustmentModalOpen(false);
    setAdjustmentProductId("");
    setAdjustmentType("IN");
    setAdjustmentQty("");
    setAdjustmentUnit("UN");
    setAdjustmentReason("AJUSTE_MANUAL");
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

  const handleCreateManualAdjustment = async () => {
    if (!adjustmentProductId) {
      toast({
        title: "Selecione um produto",
        description: "Escolha o produto que terá ajuste manual.",
        variant: "destructive",
      });
      return;
    }

    const qty = Number(adjustmentQty.replace(",", "."));

    if (!Number.isFinite(qty) || qty <= 0) {
      toast({
        title: "Quantidade inválida",
        description: "Informe uma quantidade maior que zero.",
        variant: "destructive",
      });
      return;
    }

    const unit = normalizeUnit(adjustmentUnit);
    const signedQty = adjustmentType === "OUT" ? -qty : qty;

    try {
      setSavingAdjustment(true);

      await createStockMovementAction({
        product_id: adjustmentProductId,
        unit_label: unit,
        qty_delta: signedQty,
        reason: adjustmentReason || "AJUSTE_MANUAL",
        source: "manual_adjustment_modal",
      });

      toast({
        title: "Ajuste aplicado",
        description:
          adjustmentType === "IN"
            ? "Entrada manual registrada com sucesso."
            : "Saída manual registrada com sucesso.",
      });

      closeAdjustmentModal();
      await refreshMainData();
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro no ajuste manual",
        description:
          e?.message ?? "Não foi possível registrar o ajuste manual.",
        variant: "destructive",
      });
    } finally {
      setSavingAdjustment(false);
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

  const adjustmentSelectedRow = stock.find(
    (s) => s.product?.id === adjustmentProductId
  );
  const adjustmentSelectedProduct = products.find(
    (p) => p.id === adjustmentProductId
  );
  const currentAdjustmentUnit = normalizeUnit(
    adjustmentSelectedRow?.unit_label ??
      adjustmentSelectedRow?.product?.default_unit_label ??
      adjustmentSelectedProduct?.default_unit_label ??
      adjustmentUnit
  );

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

    if (min < 0 || med < 0 || max < 0) {
      toast({
        title: "Valores inválidos",
        description: "Min/Méd/Máx não podem ser negativos.",
        variant: "destructive",
      });
      return;
    }

    if (med < min) {
      toast({
        title: "Valores inválidos",
        description: "O valor médio não pode ser menor que o mínimo.",
        variant: "destructive",
      });
      return;
    }

    if (max < med) {
      toast({
        title: "Valores inválidos",
        description: "O valor máximo não pode ser menor que o médio.",
        variant: "destructive",
      });
      return;
    }

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
      await refreshMainData();
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

  const handleMetaDraftChange = (
    balanceId: string,
    field: "unit_label" | "location",
    value: string
  ) => {
    setMetaDrafts((prev) => ({
      ...prev,
      [balanceId]: {
        ...(prev[balanceId] ?? { unit_label: "UN", location: "" }),
        [field]: value,
      },
    }));
  };

  const handleMetaBlur = async (row: StockRow) => {
    const draft = metaDrafts[row.id];
    if (!draft) return;

    const nextUnit = normalizeUnit(draft.unit_label);
    const nextLocation = String(draft.location ?? "").trim();

    const currentUnit = normalizeUnit(
      row.unit_label ?? row.product?.default_unit_label ?? "UN"
    );
    const currentLocation = String(row.location ?? "").trim();

    if (nextUnit === currentUnit && nextLocation === currentLocation) {
      return;
    }

    try {
      setSavingMetaRowId(row.id);

      const payload: BulkStockMetaUpdateItem = {
        balance_id: row.id,
        product_id: row.product?.id ?? undefined,
        unit_label: nextUnit,
        location: nextLocation || null,
      };

      await bulkUpdateStockMeta([payload]);
      await refreshMainData();

      toast({
        title: "Metadados atualizados",
        description: "Local e unidade foram atualizados com sucesso.",
      });
    } catch (e: any) {
      console.error(e);
      toast({
        title: "Erro ao atualizar metadados",
        description:
          e?.message ?? "Não foi possível atualizar local/unidade deste item.",
        variant: "destructive",
      });
    } finally {
      setSavingMetaRowId(null);
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
      const mv = recentMovementsByProduct[row.product?.id ?? ""];

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
        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_1fr_auto_auto]">
          <div className="space-y-1">
            <Label htmlFor="search">Buscar por produto, SKU, local ou motivo</Label>
            <Input
              id="search"
              placeholder="Ex.: farinha, 1001711, estoque principal, avaria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="status-filter">Status</Label>
            <select
              id="status-filter"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="todos">Todos</option>
              <option value="critico">Crítico</option>
              <option value="baixo">Baixo</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="location-filter">Local</Label>
            <select
              id="location-filter"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
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
            <label className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
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

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Qtd</TableHead>
              <TableHead>Min/Méd/Máx</TableHead>
              <TableHead>Valor Unit.</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Unidade</TableHead>
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
                  colSpan={11}
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
                  row.unit_label ?? row.product?.default_unit_label ?? "UN"
                ).toUpperCase();
                const price = row.product?.price ?? 0;

                const qtyRounded =
                  Math.round(((row.quantity ?? 0) + Number.EPSILON) * 1000) /
                  1000;

                const thresholdDraft = thresholdDrafts[row.id] ?? {
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

                const metaDraft = metaDrafts[row.id] ?? {
                  unit_label: unit,
                  location: row.location ?? "",
                };

                const thresholdDisabled = savingThresholdRowId === row.id;
                const metaDisabled = savingMetaRowId === row.id;

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
                          min={0}
                          className="h-7 w-16 text-xs"
                          value={thresholdDraft.min}
                          disabled={thresholdDisabled}
                          onChange={(e) =>
                            handleThresholdChange(row.id, "min", e.target.value)
                          }
                          onBlur={() => handleThresholdBlur(row.id)}
                        />
                        <span className="text-[10px] text-gray-400">/</span>
                        <Input
                          type="number"
                          min={0}
                          className="h-7 w-16 text-xs"
                          value={thresholdDraft.med}
                          disabled={thresholdDisabled}
                          onChange={(e) =>
                            handleThresholdChange(row.id, "med", e.target.value)
                          }
                          onBlur={() => handleThresholdBlur(row.id)}
                        />
                        <span className="text-[10px] text-gray-400">/</span>
                        <Input
                          type="number"
                          min={0}
                          className="h-7 w-16 text-xs"
                          value={thresholdDraft.max}
                          disabled={thresholdDisabled}
                          onChange={(e) =>
                            handleThresholdChange(row.id, "max", e.target.value)
                          }
                          onBlur={() => handleThresholdBlur(row.id)}
                        />
                      </div>
                    </TableCell>

                    <TableCell>{formatCurrency(price)}</TableCell>
                    <TableCell>{formatCurrency(price * qtyRounded)}</TableCell>

                    <TableCell>
                      <select
                        className="h-8 rounded-md border px-2 text-xs"
                        value={metaDraft.unit_label}
                        disabled={metaDisabled}
                        onChange={(e) =>
                          handleMetaDraftChange(
                            row.id,
                            "unit_label",
                            e.target.value
                          )
                        }
                        onBlur={() => handleMetaBlur(row)}
                      >
                        {UNIT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </TableCell>

                    <TableCell>
                      <Input
                        className="h-8 min-w-[150px] text-xs"
                        value={metaDraft.location}
                        disabled={metaDisabled}
                        placeholder="Ex.: Estoque Principal"
                        onChange={(e) =>
                          handleMetaDraftChange(
                            row.id,
                            "location",
                            e.target.value
                          )
                        }
                        onBlur={() => handleMetaBlur(row)}
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
                            unitLabel: row.unit_label ?? unit,
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
                Use este recurso para correções rápidas de saldo sem abrir um
                inventário completo.
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1 md:col-span-2">
                  <Label htmlFor="adjustment-product">Produto</Label>
                  <select
                    id="adjustment-product"
                    className="rounded-md border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    value={adjustmentProductId}
                    onChange={(e) => setAdjustmentProductId(e.target.value)}
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
                    placeholder="0"
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label htmlFor="adjustment-unit">Unidade</Label>
                  <select
                    id="adjustment-unit"
                    className="rounded-md border px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                    value={adjustmentUnit}
                    onChange={(e) => setAdjustmentUnit(e.target.value)}
                  >
                    {UNIT_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  {adjustmentProductId && (
                    <span className="text-xs text-muted-foreground">
                      Unidade sugerida atual: {currentAdjustmentUnit}
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
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={closeAdjustmentModal}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateManualAdjustment}
                  disabled={savingAdjustment}
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