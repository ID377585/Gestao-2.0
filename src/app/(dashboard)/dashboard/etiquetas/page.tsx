"use client";

// src/app/(dashboard)/dashboard/etiquetas/page.tsx

import { useCallback, useEffect, useMemo, useState } from "react";

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

// ✅ Combo (shadcn)
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ✅ impressão isolada (em src/lib/etiquetas)
import { imprimirBatchNoBrowser } from "@/lib/etiquetas/print";

// ✅ helpers isolados (em src/lib/etiquetas)
import {
  type EtiquetaGerada,
  type LinhaErro,
  type LinhaPorcao,
  type TipoSel,
  gerarSufixoRandomico,
  getInsumoCode2,
  getTodayISO,
  isoToDDMMYY,
  makeLinhaId,
  safeJsonParse,
} from "@/lib/etiquetas/helpers";

/* =========================
  TIPOS DO BACK (route handler /api/inventory-labels)
========================= */
type InventoryLabelRow = {
  id: string;
  label_code: string;
  qty: number;
  unit_label: string;
  notes: string | null;
  created_at: string;
};

/* =========================
  Produtos (GET /api/products)
========================= */
type ProductOption = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
  shelf_life_days?: number | null;
};

/* =========================
  MOCKS (depois troca por auth real)
========================= */
const USUARIO_LOGADO_NOME = "Admin User";
const ESTABELECIMENTO_NOME = "Matriz";

/* =========================
  Labels / Dados fixos
========================= */
interface TipoEtiqueta {
  id: string;
  nome: TipoSel;
  descricao: string;
}

interface TamanhoEtiqueta {
  id: string;
  nome: string;
  largura: number;
  altura: number;
}

const TIPO_LABEL: Record<TipoSel, string> = {
  MANIPULACAO: "MANIPULAÇÃO",
  REVALIDAR: "FABRICANTE",
};

const TIPO_LABEL_LONG: Record<TipoSel, string> = {
  MANIPULACAO: "MANIPULAÇÃO",
  REVALIDAR: "FABRICANTE",
};

const tiposEtiqueta: TipoEtiqueta[] = [
  { id: "1", nome: "MANIPULACAO", descricao: "Etiqueta de manipulação padrão" },
  { id: "2", nome: "REVALIDAR", descricao: "Etiqueta com dados do fabricante" },
];

const tamanhosEtiqueta: TamanhoEtiqueta[] = [
  { id: "1", nome: "Pequena", largura: 5.0, altura: 3.0 },
  { id: "2", nome: "Média", largura: 10.0, altura: 6.0 },
  { id: "3", nome: "Grande", largura: 15.0, altura: 10.0 },
];

/* =========================
  EXTENSÃO: adiciona "marca"
========================= */
type EtiquetaGeradaWithMarca = EtiquetaGerada & {
  marca?: string;
  revalidatedAt?: string;
  revalidationNotes?: string;

  // ✅ blindagem p/ revalidação e recálculo
  notes?: string | null;
  productId?: string | null;
  shelfLifeDays?: number | null;
};

/* =========================
  Form default
========================= */
const createDefaultForm = () => ({
  insumo: "",
  qtd: "",
  umd: "",
  dataManip: "",
  dataVenc: "",
  responsavel: USUARIO_LOGADO_NOME,

  alergenico: "",
  armazenamento: "",
  ingredientes: "",

  dataFabricante: "",
  dataVencimento: "",
  sif: "",
  loteFab: "",
  marca: "",

  localEnvio: ESTABELECIMENTO_NOME,
  localArmazenado: "",
});

/* =========================
  Helpers (datas)
========================= */
function addDaysISO(baseISO: string, days: number) {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

/* =========================
  ✅ CORREÇÃO DEFINITIVA DO "VENCE EM"
========================= */
function startOfDayLocal(dateLike: string | Date) {
  const d = typeof dateLike === "string" ? new Date(dateLike) : dateLike;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function diffDays(from: string | Date, to: string | Date) {
  const a = startOfDayLocal(from).getTime();
  const b = startOfDayLocal(to).getTime();
  const ms = b - a;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * ✅ REGRA FINAL
 * - Usa Data de Manipulação como base
 * - Revalidação NÃO consome dias (porque vamos "resetar" dataManip/dataVenc no notes)
 */
function getDiasParaVencer(dataManipISO: string, dataVencISO: string) {
  if (!dataManipISO || !dataVencISO) return null;

  const dataManip = new Date(`${dataManipISO}T00:00:00`);
  const dataVenc = new Date(`${dataVencISO}T00:00:00`);

  if (
    Number.isNaN(dataManip.getTime()) ||
    Number.isNaN(dataVenc.getTime())
  ) {
    return null;
  }

  const shelfLife = diffDays(dataManip, dataVenc);
  return shelfLife < 0 ? 0 : shelfLife;
}

/* =========================
  API helpers
========================= */
async function apiListInventoryLabels(): Promise<InventoryLabelRow[]> {
  const res = await fetch("/api/inventory-labels", { method: "GET" });
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = `Erro ao carregar histórico de etiquetas (HTTP ${res.status}).`;
    try {
      if (contentType.includes("application/json")) {
        const j = await res.json();
        message = (j as any)?.error || message;
      } else {
        const t = await res.text();
        if (t) message = t;
      }
    } catch {}
    throw new Error(message);
  }

  const data = (await res.json()) as InventoryLabelRow[];
  return Array.isArray(data) ? data : [];
}

async function apiCreateInventoryLabel(payload: {
  productId: string;
  productName: string;
  qty: number;
  unitLabel: string;
  labelCode: string;
  extraPayload: any;
}) {
  const res = await fetch("/api/inventory-labels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = `Falha ao salvar etiqueta (HTTP ${res.status}).`;
    try {
      if (contentType.includes("application/json")) {
        const j = await res.json();
        message = (j as any)?.error || message;
      } else {
        const t = await res.text();
        if (t) message = t;
      }
    } catch {}
    throw new Error(message);
  }

  return await res.json();
}

async function apiRevalidateInventoryLabel(payload: {
  labelId: string;
  newNotes: any;
}) {
  const res = await fetch("/api/inventory-labels/revalidate", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = `Falha ao revalidar etiqueta (HTTP ${res.status}).`;
    try {
      if (contentType.includes("application/json")) {
        const j = await res.json();
        message = (j as any)?.error || message;
      } else {
        const t = await res.text();
        if (t) message = t;
      }
    } catch {}
    throw new Error(message);
  }

  return await res.json();
}

/* =========================
  COMPONENTE
========================= */
export default function EtiquetasPage() {
  const [etiquetasGeradas, setEtiquetasGeradas] = useState<
    EtiquetaGeradaWithMarca[]
  >([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  const [showNovaEtiqueta, setShowNovaEtiqueta] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] =
    useState<TipoSel>("MANIPULACAO");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("Grande");

  // ✅ produtos pro combo
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState<string>("");
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null
  );

  const [formData, setFormData] = useState(createDefaultForm());
  const [linhasPorcao, setLinhasPorcao] = useState<LinhaPorcao[]>([]);
  const [erros, setErros] = useState<LinhaErro>({ baseQtd: false, porcoes: {} });

  // ✅ NOVO: UI revalidação
  const [showRevalidarModal, setShowRevalidarModal] = useState(false);
  const [revalidarTarget, setRevalidarTarget] =
    useState<EtiquetaGeradaWithMarca | null>(null);
  const [revalidarNotes, setRevalidarNotes] = useState("");
  const [revalidando, setRevalidando] = useState(false);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("pt-BR");
  }, []);

  const formatDateTime = useCallback((dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString("pt-BR");
  }, []);

  // ✅ melhoria: sem dependência de formData
  const handleInputChange = useCallback(
    (field: keyof typeof formData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId) ?? null;
  }, [products, selectedProductId]);

  // ✅ atualiza automaticamente insumo, unidade, dataManip e dataVenc ao selecionar o produto
  useEffect(() => {
    if (selectedProduct) {
      const hojeISO = getTodayISO();
      const shelf = Number(selectedProduct.shelf_life_days ?? 0);
      const dataVencISO =
        !isNaN(shelf) && shelf > 0 ? addDaysISO(hojeISO, shelf) : hojeISO;

      setFormData((prev) => ({
        ...prev,
        insumo: selectedProduct.name ?? "",
        umd: selectedProduct.unit ? String(selectedProduct.unit) : "",
        dataManip: hojeISO,
        dataVenc: dataVencISO,
      }));
    }
  }, [selectedProduct]);

  const displayInsumoLabel = useMemo(() => {
    const manual = String(formData.insumo || "").trim();
    if (manual) return manual;
    if (productsLoading) return "Carregando produtos...";
    return "Selecionar produto...";
  }, [formData.insumo, productsLoading]);

  // ✅ carregar produtos
  useEffect(() => {
    let mounted = true;

    const loadProducts = async () => {
      setProductsLoading(true);
      setProductsError("");

      try {
        const res = await fetch("/api/products", { method: "GET" });
        const contentType = res.headers.get("content-type") || "";

        if (!res.ok) {
          let msg = `Erro ao listar produtos (HTTP ${res.status}).`;
          try {
            if (contentType.includes("application/json")) {
              const j = await res.json();
              msg = (j as any)?.error || msg;
            } else {
              const t = await res.text();
              if (t) msg = t;
            }
          } catch {}
          throw new Error(msg);
        }

        const rows = (await res.json()) as ProductOption[];
        const list = Array.isArray(rows) ? rows : [];
        const sorted = [...list].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "pt-BR", {
            sensitivity: "base",
          })
        );

        if (mounted) setProducts(sorted);
      } catch (e: any) {
        console.error("Erro ao carregar produtos:", e);
        if (mounted) {
          setProducts([]);
          setProductsError(e?.message ?? "Falha ao carregar produtos.");
        }
      } finally {
        if (mounted) setProductsLoading(false);
      }
    };

    void loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  const mapRowsToEtiquetas = useCallback((rows: InventoryLabelRow[]) => {
    const mapped: EtiquetaGeradaWithMarca[] = (rows ?? []).map((row) => {
      const extra = row.notes
        ? safeJsonParse<Partial<EtiquetaGeradaWithMarca>>(row.notes)
        : null;

      const createdAt = row.created_at;
      const createdDateISO = createdAt?.slice(0, 10) ?? getTodayISO();

      return {
        id: row.id,
        tipo: (extra?.tipo as TipoSel) ?? "MANIPULACAO",
        tamanho: extra?.tamanho ?? "",
        insumo: extra?.insumo ?? "",
        qtd: typeof extra?.qtd === "number" ? extra.qtd : row.qty,
        umd: extra?.umd ?? row.unit_label,
        dataManip: extra?.dataManip ?? createdDateISO,
        dataVenc: extra?.dataVenc ?? createdDateISO,
        loteMan: extra?.loteMan ?? row.label_code,
        responsavel: extra?.responsavel ?? USUARIO_LOGADO_NOME,

        alergenico: (extra as any)?.alergenico,
        armazenamento: (extra as any)?.armazenamento,
        ingredientes: (extra as any)?.ingredientes,
        dataFabricante: (extra as any)?.dataFabricante,
        dataVencimento: (extra as any)?.dataVencimento,
        sif: (extra as any)?.sif,
        loteFab: (extra as any)?.loteFab,

        // ✅ marca (fabricante)
        marca: (extra as any)?.marca,

        // ✅ revalidação
        revalidatedAt: (extra as any)?.revalidatedAt,
        revalidationNotes: (extra as any)?.revalidationNotes,

        localEnvio: (extra as any)?.localEnvio,
        localArmazenado: (extra as any)?.localArmazenado,

        createdAt: (extra as any)?.createdAt ?? createdAt,

        // ✅ blindagens p/ revalidação e recálculo
        notes: row.notes ?? null,
        productId:
          ((extra as any)?.productId as string | undefined) ??
          ((extra as any)?.product_id as string | undefined) ??
          null,
        shelfLifeDays:
          typeof (extra as any)?.shelfLifeDays === "number"
            ? (extra as any).shelfLifeDays
            : typeof (extra as any)?.shelf_life_days === "number"
              ? (extra as any).shelf_life_days
              : null,
      } as EtiquetaGeradaWithMarca;
    });

    return mapped;
  }, []);

  const refreshHistorico = useCallback(async () => {
    const rows = await apiListInventoryLabels();
    const mapped = mapRowsToEtiquetas(rows);
    setEtiquetasGeradas(mapped);
  }, [mapRowsToEtiquetas]);

  // ✅ carregar histórico
  useEffect(() => {
    let mounted = true;

    const carregarDoBanco = async () => {
      try {
        const rows = await apiListInventoryLabels();
        if (!mounted) return;

        if (!rows || rows.length === 0) {
          setEtiquetasGeradas([]);
          return;
        }

        const mapped = mapRowsToEtiquetas(rows);
        setEtiquetasGeradas(mapped);
      } catch (e) {
        console.error("Erro ao carregar etiquetas do banco:", e);
        if (mounted) setEtiquetasGeradas([]);
      } finally {
        if (mounted) setCarregandoHistorico(false);
      }
    };

    void carregarDoBanco();
    return () => {
      mounted = false;
    };
  }, [mapRowsToEtiquetas]);

  // ✅ reset ao abrir modal
  useEffect(() => {
    if (showNovaEtiqueta) {
      const hojeISO = getTodayISO();

      setFormData({
        ...createDefaultForm(),
        dataManip: hojeISO,
        dataVenc: hojeISO,
        responsavel: USUARIO_LOGADO_NOME,
        localEnvio: ESTABELECIMENTO_NOME,
      });

      setTamanhoSelecionado("Grande");
      setLinhasPorcao([]);
      setErros({ baseQtd: false, porcoes: {} });

      setSelectedProductId(null);
      setProductOpen(false);
    }
  }, [showNovaEtiqueta]);

  const handleAddLinha = useCallback(() => {
    if (!String(formData.insumo || "").trim()) return;
    if (!String(formData.umd || "").trim()) return;
    setLinhasPorcao((prev) => [...prev, { id: makeLinhaId(), qtd: "" }]);
  }, [formData.insumo, formData.umd]);

  const handleRemoveLinha = useCallback((id: string) => {
    setLinhasPorcao((prev) => prev.filter((l) => l.id !== id));
    setErros((prev) => {
      const next = { ...prev, porcoes: { ...prev.porcoes } };
      delete next.porcoes[id];
      return next;
    });
  }, []);

  const handleChangeLinhaQtd = useCallback((id: string, qtd: string) => {
    setLinhasPorcao((prev) =>
      prev.map((l) => (l.id === id ? { ...l, qtd } : l))
    );
    setErros((prev) => ({
      ...prev,
      porcoes: { ...prev.porcoes, [id]: false },
    }));
  }, []);

  // ✅ LOTE: IE-XX-DDMMAA-0D-XXX
  const gerarLoteVigilancia = useCallback(() => {
    const ie = "IE";
    const cod = getInsumoCode2(formData.insumo);
    const dt = isoToDDMMYY(formData.dataManip);
    const shelfPart = `0D`;
    const base = `${ie}-${cod}-${dt}-${shelfPart}`;
    const sufixo = gerarSufixoRandomico(3);
    return `${base}-${sufixo}`;
  }, [formData.insumo, formData.dataManip]);

  const validarQuantidades = useCallback(() => {
    const baseVazia = !String(formData.qtd || "").trim();
    const porcoesErros: Record<string, boolean> = {};

    for (const l of linhasPorcao) {
      const vazia = !String(l.qtd || "").trim();
      if (vazia) porcoesErros[l.id] = true;
    }

    setErros({ baseQtd: baseVazia, porcoes: porcoesErros });
    return !(baseVazia || Object.keys(porcoesErros).length > 0);
  }, [formData.qtd, linhasPorcao]);

  const handleGerarEImprimir = useCallback(async () => {
    const ok = validarQuantidades();
    if (!ok) return;

    if (!String(formData.insumo || "").trim()) {
      alert("Preencha o campo Insumo/Produto.");
      return;
    }

    if (!selectedProductId) {
      alert("Selecione um produto na lista (não digite manualmente).");
      return;
    }

    if (!String(formData.umd || "").trim()) {
      alert("Preencha a Unidade para imprimir (ex: KG, G, UN).");
      return;
    }
    if (!String(formData.dataManip || "").trim()) {
      alert("Preencha a Data de Manipulação.");
      return;
    }
    if (!String(formData.dataVenc || "").trim()) {
      alert("Preencha a Data de Vencimento.");
      return;
    }

    const nowISO = new Date().toISOString();

    const qtds = [
      { id: "base", qtd: formData.qtd },
      ...linhasPorcao.map((l) => ({ id: l.id, qtd: l.qtd })),
    ]
      .map((x) => String(x.qtd ?? "").trim())
      .filter((v) => v.length > 0);

    const shelfFromSelected = selectedProduct
      ? Number(selectedProduct.shelf_life_days ?? 0)
      : 0;

    const novas: EtiquetaGeradaWithMarca[] = qtds.map((qtdStr, idx) => {
      const loteUnico = gerarLoteVigilancia();
      return {
        id: `${nowISO}-${idx}-${Math.random().toString(16).slice(2)}`,
        tipo: tipoSelecionado,
        tamanho: tamanhoSelecionado,
        insumo: formData.insumo,
        qtd: Number(qtdStr),
        umd: String(formData.umd || ""),
        dataManip: formData.dataManip,
        dataVenc: formData.dataVenc,
        loteMan: loteUnico,
        responsavel: formData.responsavel,

        alergenico: formData.alergenico || undefined,
        armazenamento: formData.armazenamento || undefined,
        ingredientes: formData.ingredientes || undefined,

        dataFabricante: formData.dataFabricante || undefined,
        dataVencimento: formData.dataVencimento || undefined,
        sif: formData.sif || undefined,
        loteFab: formData.loteFab || undefined,

        // ✅ marca do produto (fabricante)
        marca: formData.marca || undefined,

        localEnvio: formData.localEnvio || undefined,
        localArmazenado: formData.localArmazenado || undefined,
        createdAt: nowISO,

        // ✅ CRÍTICO p/ recálculo no futuro (sem depender de backend)
        productId: selectedProductId,
        shelfLifeDays: Number.isFinite(shelfFromSelected) ? shelfFromSelected : 0,
      } as EtiquetaGeradaWithMarca;
    });

    // ✅ log adicional para correlacionar o erro do banco com o produto selecionado
    console.log("[Etiquetas] selectedProductId:", selectedProductId);
    console.log("[Etiquetas] formData:", {
      insumo: formData.insumo,
      umd: formData.umd,
      qtd: formData.qtd,
      dataManip: formData.dataManip,
      dataVenc: formData.dataVenc,
      tipoSelecionado,
      tamanhoSelecionado,
      porcoes: linhasPorcao,
      marca: formData.marca,
    });

    try {
      /**
       * ✅ CORREÇÃO DO ERRO uq_stock_balances_*:
       * Antes: Promise.all(...) => múltiplos POSTs concorrentes => corrida no trigger do saldo.
       * Agora: grava em SEQUÊNCIA (1 por vez) => elimina a corrida.
       */
      for (const et of novas) {
        await apiCreateInventoryLabel({
          productId: selectedProductId,
          productName: et.insumo,
          qty: et.qtd,

          // ✅ PASSO 3: BLINDAGEM — normaliza unidade SEM alterar o resto do fluxo validado
          unitLabel: String(et.umd || "").trim().toUpperCase().replace(/\s+/g, ""),

          labelCode: et.loteMan,
          extraPayload: et,
        });
      }
    } catch (e: any) {
      console.error("Erro ao salvar etiquetas no banco:", e);
      alert(e?.message ?? "Falha ao salvar etiqueta no banco.");
      return;
    }

    await refreshHistorico();

    await imprimirBatchNoBrowser(novas as unknown as EtiquetaGerada[]);

    setShowNovaEtiqueta(false);
  }, [
    validarQuantidades,
    formData,
    linhasPorcao,
    gerarLoteVigilancia,
    tipoSelecionado,
    tamanhoSelecionado,
    selectedProductId,
    selectedProduct,
    refreshHistorico,
  ]);

  const tiposVisiveis = useMemo(
    () => tiposEtiqueta.filter((t) => t.nome === "MANIPULACAO"),
    []
  );

  const hojeISO = useMemo(() => getTodayISO(), []);
  const etiquetasHoje = useMemo(
    () =>
      etiquetasGeradas.filter((e) => (e.createdAt || "").startsWith(hojeISO))
        .length,
    [etiquetasGeradas, hojeISO]
  );

  // ✅ NOVO: abrir modal de revalidação preservando notes já existentes
  const openRevalidar = useCallback((et: EtiquetaGeradaWithMarca) => {
    setRevalidarTarget(et);
    setRevalidarNotes(String(et.revalidationNotes || "").trim());
    setShowRevalidarModal(true);
  }, []);

  /**
   * ✅ PASSO 3 (correção do "Vence em" na revalidação)
   * - Sempre recalcula: dataManip = hoje
   * - dataVenc = hoje + shelfLifeDays do produto
   * - Salva isso NO NOTES (JSON) junto com revalidatedAt / revalidationNotes
   */
  const handleConfirmRevalidar = useCallback(async () => {
    if (!revalidarTarget) return;

    const labelId = revalidarTarget.id;
    const nowISO = new Date().toISOString();
    const hojeISO = getTodayISO();

    // ✅ pega notes atual (se existir) sem quebrar
    const previousNotes =
      typeof revalidarTarget.notes === "string"
        ? safeJsonParse<Record<string, any>>(revalidarTarget.notes)
        : null;

    // ✅ tenta resolver shelf life:
    // 1) do notes (se já gravado)
    // 2) do productId (notes/obj)
    // 3) fallback: bater por nome
    // 4) fallback final: diff(dataManip, dataVenc) atual
    const productIdFromNotes =
      (previousNotes?.productId as string | undefined) ??
      (previousNotes?.product_id as string | undefined) ??
      (revalidarTarget.productId ?? null) ??
      null;

    let shelfLifeDays: number | null =
      typeof previousNotes?.shelfLifeDays === "number"
        ? previousNotes.shelfLifeDays
        : typeof previousNotes?.shelf_life_days === "number"
          ? previousNotes.shelf_life_days
          : typeof revalidarTarget.shelfLifeDays === "number"
            ? revalidarTarget.shelfLifeDays
            : null;

    if (shelfLifeDays == null && productIdFromNotes) {
      const p = products.find((x) => x.id === productIdFromNotes) ?? null;
      if (p && typeof p.shelf_life_days === "number") shelfLifeDays = p.shelf_life_days;
    }

    if (shelfLifeDays == null) {
      const nameNorm = String(revalidarTarget.insumo || "")
        .trim()
        .toLowerCase();
      const p =
        products.find(
          (x) => String(x.name || "").trim().toLowerCase() === nameNorm
        ) ?? null;
      if (p && typeof p.shelf_life_days === "number") shelfLifeDays = p.shelf_life_days;
    }

    if (shelfLifeDays == null) {
      const dm =
        (previousNotes?.dataManip as string | undefined) ??
        (revalidarTarget.dataManip as string | undefined) ??
        "";
      const dv =
        (previousNotes?.dataVenc as string | undefined) ??
        (revalidarTarget.dataVenc as string | undefined) ??
        "";
      const inferred = getDiasParaVencer(dm, dv);
      shelfLifeDays = typeof inferred === "number" ? inferred : null;
    }

    const shelf = Number(shelfLifeDays ?? 0);
    const vencISO = shelf > 0 ? addDaysISO(hojeISO, shelf) : hojeISO;

    // ✅ Monta newNotes como "objeto completo" da etiqueta
    // - Mantém tudo que já estava
    // - Reseta dataManip/dataVenc para hoje + shelfLife (regra solicitada)
    // - Acrescenta revalidatedAt + revalidationNotes
    const newNotesObj = {
      ...(previousNotes ?? {}),
      productId: productIdFromNotes ?? previousNotes?.productId ?? null,
      shelfLifeDays: Number.isFinite(shelf) ? shelf : null,
      dataManip: hojeISO,
      dataVenc: vencISO,
      revalidatedAt: nowISO,
      revalidationNotes: String(revalidarNotes || "").trim() || "",
    };

    setRevalidando(true);
    try {
      await apiRevalidateInventoryLabel({ labelId, newNotes: newNotesObj });

      // ✅ atualiza a lista com fonte de verdade do banco
      await refreshHistorico();
      alert("Etiqueta revalidada com sucesso.");

      setShowRevalidarModal(false);
      setRevalidarTarget(null);
      setRevalidarNotes("");
    } catch (e: any) {
      console.error("Erro ao revalidar etiqueta:", e);
      alert(e?.message ?? "Falha ao revalidar etiqueta.");
    } finally {
      setRevalidando(false);
    }
  }, [products, refreshHistorico, revalidarNotes, revalidarTarget]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Sistema de Etiquetas
          </h1>
          <p className="text-gray-600">
            Impressão térmica de etiquetas de manipulação
          </p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => void refreshHistorico()}
            disabled={carregandoHistorico}
            title="Recarregar histórico"
          >
            <span className="mr-2">🔄</span>
            Recarregar
          </Button>

          <Button variant="outline">
            <span className="mr-2">📊</span>
            Relatório de Etiquetas
          </Button>

          <Button
            onClick={() => {
              setTipoSelecionado("MANIPULACAO");
              setShowNovaEtiqueta(true);
            }}
          >
            <span className="mr-2">🏷️</span>
            Nova Etiqueta
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Etiquetas
            </CardTitle>
            <span className="text-2xl">🏷️</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{etiquetasGeradas.length}</div>
            <p className="text-xs text-muted-foreground">Etiquetas geradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Manipulação</CardTitle>
            <span className="text-2xl">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {etiquetasGeradas.filter((e) => e.tipo === "MANIPULACAO").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Etiquetas de manipulação
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fabricante</CardTitle>
            <span className="text-2xl">🏭</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {etiquetasGeradas.filter((e) => e.tipo === "REVALIDAR").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Etiquetas com dados do fabricante
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <span className="text-2xl">📅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{etiquetasHoje}</div>
            <p className="text-xs text-muted-foreground">
              Etiquetas geradas hoje
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tipos */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        {tiposVisiveis.map((tipo) => (
          <Card key={tipo.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="mr-2">📝</span>
                {TIPO_LABEL_LONG[tipo.nome]}
              </CardTitle>
              <CardDescription>{tipo.descricao}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Campos obrigatórios:</strong>
                </p>
                <ul className="list-disc list-inside text-gray-600">
                  <li>Insumo, Quantidade, Unidade</li>
                  <li>Data de Manipulação, Data de Vencimento</li>
                  <li>Lote de Manipulação, Responsável</li>
                </ul>
              </div>

              <Button
                className="w-full mt-4"
                onClick={() => {
                  setTipoSelecionado("MANIPULACAO");
                  setShowNovaEtiqueta(true);
                }}
              >
                Criar Etiqueta {TIPO_LABEL[tipo.nome]}
              </Button>

              <div className="mt-3 text-xs text-muted-foreground">
                Precisa de dados do fabricante (Marca/SIF/Lote original)? Abra
                “Nova Etiqueta” e selecione{" "}
                <strong>{TIPO_LABEL.REVALIDAR}</strong> no formulário.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Etiquetas Geradas</CardTitle>
          <CardDescription>
            Todas as etiquetas geradas com opção de reimpressão
          </CardDescription>
        </CardHeader>
        <CardContent>
          {carregandoHistorico ? (
            <div className="text-sm text-muted-foreground">
              Carregando histórico de etiquetas...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Insumo</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead>Lote</TableHead>
                  <TableHead>Vence em</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Data Criação</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {etiquetasGeradas.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="text-sm text-muted-foreground text-center"
                    >
                      Nenhuma etiqueta gerada ainda.
                    </TableCell>
                  </TableRow>
                ) : (
                  etiquetasGeradas.map((etiqueta) => (
                    <TableRow key={`${etiqueta.id}-${etiqueta.loteMan}`}>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            etiqueta.tipo === "MANIPULACAO"
                              ? "bg-blue-500 text-white"
                              : "bg-green-500 text-white"
                          }
                          title={
                            etiqueta.revalidatedAt
                              ? `Revalidada em: ${formatDateTime(
                                  etiqueta.revalidatedAt
                                )}`
                              : undefined
                          }
                        >
                          {TIPO_LABEL[etiqueta.tipo]}
                          {etiqueta.revalidatedAt ? " • ♻️" : ""}
                        </Badge>
                      </TableCell>

                      <TableCell className="font-medium">
                        {etiqueta.insumo}
                      </TableCell>

                      <TableCell>
                        {etiqueta.qtd} {etiqueta.umd}
                      </TableCell>

                      <TableCell className="font-mono text-sm">
                        {etiqueta.loteMan}
                      </TableCell>

                      {(() => {
                        // ✅ AJUSTE: Vence em deve usar dataManip + dataVenc (não createdAt)
                        const dias = getDiasParaVencer(
                          etiqueta.dataManip,
                          etiqueta.dataVenc
                        );
                        const isOneDayLeft = dias === 1;

                        return (
                          <TableCell
                            className={
                              isOneDayLeft ? "font-bold text-red-600" : ""
                            }
                            title={
                              dias === null
                                ? "Sem dados suficientes para calcular"
                                : `${dias} dia(s) para vencer`
                            }
                          >
                            {dias === null ? "—" : `${dias} dia(s)`}
                          </TableCell>
                        );
                      })()}

                      <TableCell>{etiqueta.responsavel}</TableCell>

                      <TableCell>{formatDateTime(etiqueta.createdAt)}</TableCell>

                      <TableCell>{formatDate(etiqueta.dataVenc)}</TableCell>

                      <TableCell>
                        <div className="text-sm">
                          <p>
                            <strong>Envio:</strong>{" "}
                            {etiqueta.localEnvio || "-"}
                          </p>
                          <p>
                            <strong>Armazenado:</strong>{" "}
                            {etiqueta.localArmazenado || "-"}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void imprimirBatchNoBrowser([
                                etiqueta as unknown as EtiquetaGerada,
                              ])
                            }
                            title="Reimprimir"
                          >
                            🖨️
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openRevalidar(etiqueta)}
                            title="Revalidar / adicionar observação"
                          >
                            ♻️
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            title="Visualizar"
                            disabled
                          >
                            👁️
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            title="Copiar"
                            disabled
                          >
                            📋
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showNovaEtiqueta && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[90dvh] overflow-visible flex flex-col">
            {/* Header fixo do modal */}
            <div className="flex justify-between items-center mb-6 gap-3 shrink-0">
              <h3 className="text-lg sm:text-xl font-semibold">
                Nova Etiqueta - {TIPO_LABEL_LONG[tipoSelecionado]}
              </h3>
              <Button variant="ghost" onClick={() => setShowNovaEtiqueta(false)}>
                ✕
              </Button>
            </div>

            {/* ✅ Área scrollável do formulário */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
              <div className="space-y-6 pb-8">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="min-w-0">
                    <Label>Tipo de Etiqueta</Label>
                    <select
                      value={tipoSelecionado}
                      onChange={(e) =>
                        setTipoSelecionado(e.target.value as TipoSel)
                      }
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="MANIPULACAO">MANIPULAÇÃO</option>
                      <option value="REVALIDAR">FABRICANTE</option>
                    </select>
                  </div>

                  <div className="min-w-0">
                    <Label>Tamanho da Etiqueta</Label>
                    <select
                      value={tamanhoSelecionado}
                      onChange={(e) => setTamanhoSelecionado(e.target.value)}
                      className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {tamanhosEtiqueta.map((tamanho) => (
                        <option key={tamanho.id} value={tamanho.nome}>
                          {tamanho.nome} ({tamanho.largura}×{tamanho.altura}cm)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Insumo/Produto */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
                    <div className="min-w-0 md:col-span-6">
                      <Label>Insumo/Produto *</Label>

                      <Popover
                        modal={false}
                        open={productOpen}
                        onOpenChange={(open) => {
                          setProductOpen(open);
                          if (open) {
                            requestAnimationFrame(() => {
                              window.dispatchEvent(new Event("resize"));
                            });
                          }
                        }}
                      >
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            role="combobox"
                            aria-expanded={productOpen}
                            aria-controls="product-combobox-list"
                            aria-haspopup="listbox"
                            className={cn(
                              "w-full inline-flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm",
                              !selectedProductId && "text-muted-foreground"
                            )}
                          >
                            {displayInsumoLabel}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </button>
                        </PopoverTrigger>

                        <PopoverContent
                          className={cn(
                            "p-0 z-[99999] border shadow-md",
                            "bg-white text-gray-900",
                            "min-w-[520px] w-auto max-w-[90vw]"
                          )}
                          align="start"
                          side="bottom"
                          sideOffset={6}
                          avoidCollisions
                          collisionPadding={12}
                          updatePositionStrategy="always"
                          sticky="always"
                        >
                          <Command className="bg-white text-gray-900">
                            <CommandInput
                              placeholder="Buscar produto..."
                              className="bg-white text-gray-900"
                            />

                            <div className="px-3 py-2 text-xs text-muted-foreground border-b bg-white">
                              {productsLoading ? (
                                <>Carregando produtos...</>
                              ) : productsError ? (
                                <span className="text-red-600">
                                  {productsError}
                                </span>
                              ) : (
                                <>
                                  Produtos carregados:{" "}
                                  <strong>{products.length}</strong>
                                </>
                              )}
                            </div>

                            <CommandList
                              id="product-combobox-list"
                              className="max-h-[360px] overflow-auto bg-white"
                            >
                              <CommandEmpty className="text-gray-600">
                                {productsLoading
                                  ? "Carregando..."
                                  : "Nenhum produto encontrado."}
                              </CommandEmpty>

                              <CommandGroup className="bg-white">
                                {products.map((p) => (
                                  <CommandItem
                                    key={p.id}
                                    value={`${p.name} ${p.category ?? ""}`}
                                    onSelect={() => {
                                      const hojeISO = getTodayISO();

                                      setSelectedProductId(p.id);
                                      handleInputChange("insumo", p.name);
                                      handleInputChange(
                                        "umd",
                                        p.unit ? String(p.unit) : ""
                                      );
                                      handleInputChange("dataManip", hojeISO);

                                      const shelf = Number(p.shelf_life_days ?? 0);
                                      const vencISO =
                                        shelf > 0
                                          ? addDaysISO(hojeISO, shelf)
                                          : hojeISO;
                                      handleInputChange("dataVenc", vencISO);

                                      setProductOpen(false);
                                    }}
                                    className={cn(
                                      "bg-white text-gray-900",
                                      "data-[selected=true]:bg-gray-100 data-[selected=true]:text-gray-900"
                                    )}
                                  >
                                    <Check
                                      className={cn(
                                        "mr-2 h-4 w-4",
                                        selectedProductId === p.id
                                          ? "opacity-100"
                                          : "opacity-0"
                                      )}
                                    />

                                    <div className="flex flex-col">
                                      <span className="whitespace-normal break-words leading-snug">
                                        {p.name}
                                      </span>
                                      {p.category ? (
                                        <span className="text-xs text-gray-500 whitespace-normal break-words">
                                          {p.category}
                                        </span>
                                      ) : null}
                                    </div>
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>

                      {selectedProduct ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Selecionado: <strong>{selectedProduct.name}</strong>
                          {selectedProduct.unit
                            ? ` • Unidade: ${selectedProduct.unit}`
                            : ""}
                          {typeof selectedProduct.shelf_life_days === "number" &&
                          selectedProduct.shelf_life_days !== null
                            ? ` • Shelf life: ${selectedProduct.shelf_life_days} dia(s)`
                            : ""}
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 md:col-span-3">
                      <Label htmlFor="qtd">Quantidade *</Label>
                      <Input
                        id="qtd"
                        type="number"
                        value={formData.qtd}
                        onChange={(e) => {
                          handleInputChange("qtd", e.target.value);
                          setErros((prev) => ({ ...prev, baseQtd: false }));
                        }}
                        placeholder="0"
                        className={
                          erros.baseQtd
                            ? "border-red-500 focus-visible:ring-red-500 w-full min-w-0"
                            : "w-full min-w-0"
                        }
                      />
                      {erros.baseQtd && (
                        <p className="text-xs text-red-600 mt-1">
                          Preencha a quantidade desta linha.
                        </p>
                      )}
                    </div>

                    <div className="min-w-0 md:col-span-2">
                      <Label>Unidade *</Label>
                      <Input
                        className="w-full min-w-0"
                        value={formData.umd}
                        onChange={(e) => handleInputChange("umd", e.target.value)}
                        placeholder="Ex:KG, G, UN"
                        autoComplete="off"
                      />
                    </div>

                    <div className="min-w-0 md:col-span-1 md:flex md:items-end">
                      <Button
                        type="button"
                        onClick={handleAddLinha}
                        disabled={
                          !String(formData.insumo || "").trim() ||
                          !String(formData.umd || "").trim()
                        }
                        className="w-full md:w-auto"
                      >
                        Add +
                      </Button>
                    </div>
                  </div>

                  {linhasPorcao.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm text-muted-foreground">
                        Porcionamento: mesmo produto/unidade (travados). Só a
                        quantidade muda.
                      </div>

                      {linhasPorcao.map((linha) => {
                        const hasErr = !!erros.porcoes[linha.id];
                        return (
                          <div
                            key={linha.id}
                            className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end"
                          >
                            <div className="min-w-0 md:col-span-6">
                              <Label>Insumo/Produto</Label>
                              <Input
                                className="w-full min-w-0"
                                value={formData.insumo}
                                disabled
                                readOnly
                              />
                            </div>

                            <div className="min-w-0 md:col-span-3">
                              <Label>Quantidade *</Label>
                              <Input
                                type="number"
                                value={linha.qtd}
                                onChange={(e) =>
                                  handleChangeLinhaQtd(linha.id, e.target.value)
                                }
                                placeholder="0"
                                className={
                                  hasErr
                                    ? "border-red-500 focus-visible:ring-red-500 w-full min-w-0"
                                    : "w-full min-w-0"
                                }
                              />
                              {hasErr && (
                                <p className="text-xs text-red-600 mt-1">
                                  Preencha a quantidade desta linha.
                                </p>
                              )}
                            </div>

                            <div className="min-w-0 md:col-span-1">
                              <Label>Unidade</Label>
                              <Input
                                className="w-full min-w-0"
                                value={formData.umd}
                                disabled
                                readOnly
                              />
                            </div>

                            <div className="min-w-0 md:col-span-2 md:flex md:items-end">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => handleRemoveLinha(linha.id)}
                                className="w-full"
                              >
                                Remover
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Datas */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="min-w-0">
                    <Label>Data de Manipulação *</Label>
                    <Input
                      className="w-full min-w-0"
                      value={formData.dataManip}
                      type="date"
                      disabled
                      readOnly
                    />
                  </div>

                  <div className="min-w-0">
                    <Label>Data de Vencimento *</Label>
                    <Input
                      className="w-full min-w-0"
                      type="date"
                      value={formData.dataVenc}
                      disabled
                      readOnly
                    />
                  </div>
                </div>

                {/* Lote Preview */}
                {String(formData.insumo || "").trim() && formData.dataManip && (
                  <div className="p-3 bg-gray-50 rounded border">
                    <div className="text-sm">
                      <strong>Lote (automático):</strong>{" "}
                      <span className="font-mono">{gerarLoteVigilancia()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Formato: IE-XX-DDMMAA-0D-XXX
                    </p>
                  </div>
                )}

                {/* Campos REVALIDAR */}
                {tipoSelecionado === "REVALIDAR" && (
                  <div className="p-4 bg-green-50 rounded-lg space-y-4">
                    <h4 className="font-semibold text-green-800">
                      Dados do Fabricante
                    </h4>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="min-w-0">
                        <Label>Marca</Label>
                        <Input
                          className="w-full min-w-0"
                          value={formData.marca}
                          onChange={(e) =>
                            handleInputChange("marca", e.target.value)
                          }
                          placeholder="Ex: Sadia, Perdigão, Aurora..."
                        />
                      </div>

                      <div className="min-w-0">
                        <Label>Data de Fabricação</Label>
                        <Input
                          className="w-full min-w-0"
                          type="date"
                          value={formData.dataFabricante}
                          onChange={(e) =>
                            handleInputChange("dataFabricante", e.target.value)
                          }
                        />
                      </div>

                      <div className="min-w-0">
                        <Label>Validade Original (Fabricante)</Label>
                        <Input
                          className="w-full min-w-0"
                          type="date"
                          value={formData.dataVencimento}
                          onChange={(e) =>
                            handleInputChange("dataVencimento", e.target.value)
                          }
                        />
                      </div>

                      <div className="min-w-0">
                        <Label>SIF</Label>
                        <Input
                          className="w-full min-w-0"
                          value={formData.sif}
                          onChange={(e) => handleInputChange("sif", e.target.value)}
                          placeholder="Ex: SIF 123"
                        />
                      </div>

                      <div className="min-w-0">
                        <Label>Lote do Fabricante</Label>
                        <Input
                          className="w-full min-w-0"
                          value={formData.loteFab}
                          onChange={(e) =>
                            handleInputChange("loteFab", e.target.value)
                          }
                          placeholder="Lote original"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Infos adicionais */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="min-w-0">
                    <Label>Responsável *</Label>
                    <Input
                      className="w-full min-w-0"
                      value={formData.responsavel}
                      disabled
                      readOnly
                    />
                  </div>

                  <div className="min-w-0">
                    <Label>Alergênico</Label>
                    <Input
                      className="w-full min-w-0"
                      value={formData.alergenico}
                      onChange={(e) =>
                        handleInputChange("alergenico", e.target.value)
                      }
                      placeholder="Ex: Contém leite"
                    />
                  </div>
                </div>

                <div className="min-w-0">
                  <Label>Condições de Armazenamento</Label>
                  <Input
                    className="w-full min-w-0"
                    value={formData.armazenamento}
                    onChange={(e) =>
                      handleInputChange("armazenamento", e.target.value)
                    }
                    placeholder="Ex: Refrigerado 0-4°C"
                  />
                </div>

                <div className="min-w-0">
                  <Label>Ingredientes</Label>
                  <Textarea
                    className="w-full min-w-0"
                    value={formData.ingredientes}
                    onChange={(e) =>
                      handleInputChange("ingredientes", e.target.value)
                    }
                    placeholder="Lista de ingredientes..."
                    rows={3}
                  />
                </div>

                {/* Localização */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="min-w-0">
                    <Label>Local de Envio</Label>
                    <Input
                      className="w-full min-w-0"
                      value={formData.localEnvio}
                      onChange={(e) =>
                        handleInputChange("localEnvio", e.target.value)
                      }
                      placeholder="Para onde será enviado"
                    />
                  </div>
                  <div className="min-w-0">
                    <Label>Local de Armazenamento</Label>
                    <Input
                      className="w-full min-w-0"
                      value={formData.localArmazenado}
                      onChange={(e) =>
                        handleInputChange("localArmazenado", e.target.value)
                      }
                      placeholder="Onde está armazenado"
                    />
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2 sm:gap-0">
                  <Button
                    variant="outline"
                    onClick={() => setShowNovaEtiqueta(false)}
                  >
                    Cancelar
                  </Button>

                  <Button
                    onClick={handleGerarEImprimir}
                    disabled={
                      !tipoSelecionado ||
                      !tamanhoSelecionado ||
                      !String(formData.insumo || "").trim() ||
                      !String(formData.qtd || "").trim() ||
                      !String(formData.umd || "").trim() ||
                      !String(formData.dataManip || "").trim() ||
                      !String(formData.dataVenc || "").trim()
                    }
                  >
                    <span className="mr-2">🖨️</span>
                    Gerar e Imprimir Etiqueta(s)
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ NOVO: Modal Revalidar */}
      {showRevalidarModal && revalidarTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-2xl max-h-[90dvh] overflow-visible flex flex-col">
            <div className="flex justify-between items-center mb-4 gap-3 shrink-0">
              <div className="min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold">
                  Revalidar etiqueta
                </h3>
                <div className="text-xs text-muted-foreground mt-1">
                  <strong>Produto:</strong> {revalidarTarget.insumo} •{" "}
                  <strong>Lote:</strong>{" "}
                  <span className="font-mono">{revalidarTarget.loteMan}</span>
                </div>
              </div>

              <Button
                variant="ghost"
                onClick={() => {
                  if (revalidando) return;
                  setShowRevalidarModal(false);
                  setRevalidarTarget(null);
                  setRevalidarNotes("");
                }}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-3">
              <div className="min-w-0">
                <Label>Observações da revalidação</Label>
                <Textarea
                  value={revalidarNotes}
                  onChange={(e) => setRevalidarNotes(e.target.value)}
                  placeholder="Ex: conferido validade, ajustado armazenamento, lote original verificado..."
                  rows={4}
                  className="w-full"
                  disabled={revalidando}
                />
                <div className="text-xs text-muted-foreground mt-1">
                  Isso será salvo no <code>notes</code> da etiqueta (JSON) junto
                  com data/hora da revalidação. A data de manipulação/validade
                  será recalculada com base no shelf-life do produto.
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2 sm:gap-0 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (revalidando) return;
                    setShowRevalidarModal(false);
                    setRevalidarTarget(null);
                    setRevalidarNotes("");
                  }}
                  disabled={revalidando}
                >
                  Cancelar
                </Button>

                <Button
                  onClick={() => void handleConfirmRevalidar()}
                  disabled={revalidando}
                  title="Salvar revalidação"
                >
                  {revalidando ? "Salvando..." : "Salvar revalidação"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
