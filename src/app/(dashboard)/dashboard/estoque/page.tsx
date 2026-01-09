// src/app/(dashboard)/dashboard/estoque/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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

import {
  listCurrentStock,
  startInventorySession,
  addInventoryItem,
  getInventorySessionWithItems,
  finalizeInventory,
  seedInitialStockFromProducts,
  listProductsForInventory,
  updateStockThresholds,
  getLastClosedInventorySession, // ✅ NOVO IMPORT
  bulkUpdateStockMeta, // ✅ NOVO IMPORT (upload CSV)
  type BulkStockMetaUpdateItem, // ✅ NOVO IMPORT (tipo)
} from "./actions";

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
    // alinhado com tabela products
    sku?: string | null;
    default_unit_label?: string | null;
  } | null;
};

type InventorySession = {
  id: string;
  status: string;
  started_at: string | null;
  finished_at: string | null; // ✅ alinhado com o backend
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
  // opcional: já deixa pronto pro futuro
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

// parser simples com suporte básico a aspas
function splitCsvLine(line: string, delimiter: string) {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // "" dentro de aspas vira "
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

  // ===== Estado principal de estoque =====
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);

  // drafts de Min/Méd/Máx por linha
  const [thresholdDrafts, setThresholdDrafts] = useState<ThresholdDrafts>({});
  const [savingThresholdRowId, setSavingThresholdRowId] =
    useState<string | null>(null);

  // ===== Produtos (tabela products) para o inventário =====
  const [products, setProducts] = useState<ProductOption[]>([]);

  // ===== Inventário =====
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [inventorySession, setInventorySession] =
    useState<InventorySession | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [finalizingInventory, setFinalizingInventory] = useState(false);

  // Data do último inventário encerrado (para mostrar em "Estoque Atual")
  const [lastInventoryDate, setLastInventoryDate] = useState<string | null>(
    null
  );

  // Upload CSV
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // Form do inventário
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [countedQuantity, setCountedQuantity] = useState<string>("");

  // ===== Carrega estoque atual =====
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

  // Helper para formatar datas (pt-BR)
  const formatDateTime = (value: string | Date | null | undefined) => {
    if (!value) return "";
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  };

  // 🚀 Bootstrap inicial: carrega produtos + estoque, cria saldos iniciais se necessário
  // e descobre a data do último inventário encerrado
  useEffect(() => {
    const bootstrap = async () => {
      try {
        // 1) Carrega produtos da tabela products
        const prods = (await listProductsForInventory()) as ProductOption[];
        setProducts(prods ?? []);

        // 2) Verifica se já existe saldo em stock_balances
        const current = (await listCurrentStock()) as StockRow[];

        if (!current || current.length === 0) {
          // Cria saldos iniciais a partir de products (quantidade 0)
          try {
            await seedInitialStockFromProducts();
          } catch (seedErr: any) {
            console.error("Falha ao criar estoque inicial:", seedErr);
          }
        }

        // 3) Carrega estoque atual para exibir tabela e KPIs
        await loadStock();

        // 4) Carrega última sessão de inventário encerrada
        try {
          const lastClosed = await getLastClosedInventorySession();
          if (lastClosed) {
            // usa finished_at; se não tiver, cai para started_at
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
          // não quebra a tela, só não mostra a data
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

  // Sempre que o estoque muda, atualizamos os drafts de Min/Méd/Máx
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

  // ===== Ordenação: Crítico no topo + A→Z por produto =====
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

      // fallback estável
      return String(a.id).localeCompare(String(b.id));
    });
  }, [stock]);

  // ===== Métricas / KPIs =====
  // se quiser, pode trocar para distinct product_id no futuro
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

  // ===== Inventário: abrir / carregar sessão =====
  const openInventoryModal = async () => {
    setLoadingInventory(true);
    try {
      // tenta obter sessão em andamento
      const existing = await getInventorySessionWithItems();

      if (existing) {
        setInventorySession(existing.session as InventorySession);
        setInventoryItems(existing.items as InventoryItem[]);
      } else {
        // se não existe, cria uma nova
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

  // ===== Inventário: adicionar item contado =====
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
    const unitLabel =
      unitLabelFromStock ?? productMeta?.default_unit_label ?? "un";

    try {
      setSavingItem(true);

      await addInventoryItem({
        session_id: inventorySession.id,
        product_id: selectedProductId,
        counted_quantity: qtyNumber,
        unit_label: unitLabel,
      });

      // recarrega itens da sessão
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

  // ===== Inventário: finalizar sessão =====
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

      // guarda a data da contagem (se tiver started_at, usa; senão, agora)
      const sessionDate =
        inventorySession.started_at ?? new Date().toISOString();
      setLastInventoryDate(sessionDate);

      toast({
        title: "Inventário encerrado",
        description:
          "Os saldos de estoque foram atualizados com base nas contagens.",
      });

      // fecha modal e recarrega estoque atual
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
  const selectedUnit =
    selectedProductRow?.unit_label ??
    selectedProductRow?.product?.default_unit_label ??
    productMeta?.default_unit_label ??
    "";

  // data que será exibida no modal (sempre somente leitura)
  const inventoryDateDisplay =
    inventorySession?.started_at ?? new Date().toISOString();

  // ===== Handlers de edição Min/Méd/Máx =====
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

    // nada pra salvar se estiver tudo igual a zero e já era zero
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

  // ===== Export CSV =====
  const buildCsvRows = (rows: StockRow[]) => {
    return rows.map((row) => {
      const status = getStatusFromRow(row);
      const unit = row.unit_label ?? row.product?.default_unit_label ?? "un";
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

    // CSV pt-BR costuma abrir melhor no Excel com ';'
    const delimiter = ";";

    const lines: string[] = [];
    lines.push(headers.join(delimiter));

    for (const r of data) {
      const line = headers.map((h) => escapeCsv((r as any)[h])).join(delimiter);
      lines.push(line);
    }

    const csvContent = "\uFEFF" + lines.join("\n"); // BOM p/ Excel
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
    const criticos = sortedStock.filter((r) => getStatusFromRow(r) === "critico");
    downloadCsv("estoque_comprar_criticos.csv", criticos);
  };

  const handleExportGeral = () => {
    downloadCsv("estoque_atual_geral.csv", sortedStock);
  };

  // ===== Upload CSV (metadados: unidade/local/min/med/max) =====
  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  const parseUploadCsvToUpdates = (csvText: string): BulkStockMetaUpdateItem[] => {
    const linesRaw = csvText
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (linesRaw.length < 2) return [];

    const delimiter = detectDelimiter(linesRaw[0]);
    const headerCells = splitCsvLine(linesRaw[0], delimiter).map(normalizeHeader);

    // Mapeia colunas aceitas (flexível)
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

    // Índices auxiliares para casar produto
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

      const rawBalanceId = idxBalanceId >= 0 ? String(cells[idxBalanceId] ?? "").trim() : "";
      const rawProductId = idxProductId >= 0 ? String(cells[idxProductId] ?? "").trim() : "";
      const rawSku = idxSku >= 0 ? String(cells[idxSku] ?? "").trim() : "";
      const rawNome = idxProduto >= 0 ? String(cells[idxProduto] ?? "").trim() : "";

      // tenta casar com estoque atual
      let matched: StockRow | undefined;

      if (rawProductId) matched = byProductId.get(rawProductId);
      if (!matched && rawSku) matched = bySku.get(rawSku.toLowerCase());
      if (!matched && rawNome) matched = byName.get(rawNome.toLowerCase());

      const balance_id =
        rawBalanceId ||
        (matched?.id ? String(matched.id) : "");

      const product_id =
        rawProductId ||
        (matched?.product?.id ? String(matched.product.id) : "");

      if (!balance_id && !product_id) {
        // não achou como aplicar
        continue;
      }

      const unit_label =
        idxUnidade >= 0 ? String(cells[idxUnidade] ?? "").trim() : "";
      const location =
        idxLocal >= 0 ? String(cells[idxLocal] ?? "").trim() : "";

      const min_qty = idxMin >= 0 ? toNumberOrNull(cells[idxMin]) : null;
      const med_qty = idxMed >= 0 ? toNumberOrNull(cells[idxMed]) : null;
      const max_qty = idxMax >= 0 ? toNumberOrNull(cells[idxMax]) : null;

      const payload: BulkStockMetaUpdateItem = {
        balance_id: balance_id || undefined,
        product_id: product_id || undefined,
      };

      // Só envia campos que existem no CSV (ou vieram preenchidos)
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

      // recarrega
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
      // permite escolher o mesmo arquivo de novo
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Estoque</h1>
          <p className="text-gray-600">Controle de estoque atual e inventário</p>
        </div>

        <div className="flex space-x-2">
          <Button variant="outline" disabled>
            <span className="mr-2">📥</span>
            Entrada
          </Button>
          <Button variant="outline" disabled>
            <span className="mr-2">📤</span>
            Saída
          </Button>
          <Button onClick={openInventoryModal} disabled={loadingInventory}>
            <span className="mr-2">📋</span>
            Iniciar Inventário
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <span className="text-2xl">📦</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loadingStock ? "…" : totalItens}</div>
            <p className="text-xs text-muted-foreground">Produtos cadastrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loadingStock ? "R$ 0,00" : formatCurrency(valorTotal)}
            </div>
            <p className="text-xs text-muted-foreground">Valor do estoque</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticos</CardTitle>
            <span className="text-2xl">🚨</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {loadingStock ? "…" : totalCriticos}
            </div>
            <p className="text-xs text-muted-foreground">Itens abaixo do mínimo</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baixos</CardTitle>
            <span className="text-2xl">⚠️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {loadingStock ? "…" : totalBaixos}
            </div>
            <p className="text-xs text-muted-foreground">Itens próximos ao mínimo</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela Estoque Atual */}
      <Card>
        <CardHeader>
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <CardTitle>Estoque Atual</CardTitle>
              <CardDescription>Valores após o último inventário</CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <p className="text-xs text-muted-foreground whitespace-nowrap">
                {lastInventoryDate
                  ? `Último inventário em ${formatDateTime(lastInventoryDate)}`
                  : "Nenhum inventário encerrado ainda."}
              </p>
            </div>
          </div>

          {/* ✅ Ações: Export + Upload */}
          <div className="flex flex-wrap gap-2 pt-3">
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
          </div>
        </CardHeader>

        <CardContent>
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
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : sortedStock.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-sm text-muted-foreground">
                    Nenhum item de estoque cadastrado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                sortedStock.map((row) => {
                  const status = getStatusFromRow(row);
                  const badgeCfg = statusConfig[status];

                  const unit =
                    row.unit_label ?? row.product?.default_unit_label ?? "un";
                  const price = row.product?.price ?? 0;

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
                        {row.quantity} {unit}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            className="h-7 w-16 text-xs"
                            value={draft.min}
                            disabled={disabled}
                            onChange={(e) =>
                              handleThresholdChange(row.id, "min", e.target.value)
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
                              handleThresholdChange(row.id, "med", e.target.value)
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
                              handleThresholdChange(row.id, "max", e.target.value)
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

                      <TableCell>
                        {formatCurrency(price * (row.quantity ?? 0))}
                      </TableCell>

                      <TableCell>{row.location ?? "—"}</TableCell>

                      <TableCell>
                        <Badge className={badgeCfg.badgeClass}>{badgeCfg.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal de Inventário */}
      {inventoryModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-y-auto shadow-lg">
            <div className="flex justify-between items-center mb-4">
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
                <div className="bg-blue-50 border border-blue-100 p-3 rounded-md text-sm text-blue-800">
                  Inventário iniciado! Adicione os itens contados abaixo. Ao encerrar o
                  inventário, os saldos de estoque serão atualizados com estas quantidades.
                </div>

                {/* Data do inventário (somente leitura) */}
                <div className="flex justify-between text-xs text-gray-600">
                  <span>
                    Data do inventário:{" "}
                    <span className="font-medium">{formatDateTime(inventoryDateDisplay)}</span>
                  </span>
                </div>

                {/* Form de contagem */}
                <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-4">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="produto">Produto</Label>
                    <select
                      id="produto"
                      className="border rounded-md px-2 py-2 text-sm"
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

                {/* Botão ADICIONAR ITEM mais destacado */}
                <Button
                  className="w-full mt-2 bg-emerald-600 text-white hover:bg-emerald-700 font-semibold shadow-sm"
                  onClick={handleAddInventoryItem}
                  disabled={savingItem}
                >
                  {savingItem ? "Salvando..." : "Adicionar Item"}
                </Button>

                {/* Lista de itens contados */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">Itens Contados ({inventoryItems.length})</h4>

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
                            <TableCell>{item.unit_label ?? "un"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Botões do rodapé */}
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
                    {finalizingInventory ? "Encerrando..." : "Encerrar Inventário"}
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
