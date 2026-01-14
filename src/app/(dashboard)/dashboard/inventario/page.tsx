"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";

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
} from "@/components/ui/dialog";

import {
  aplicarInventario,
  type InventoryResumoInput,
  type InventoryApplyResult,
} from "./actions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Scanner de QR Code (camera) – import dinâmico para evitar problemas no SSR
 */
const QrScanner = dynamic(
  () =>
    import("@yudiel/react-qr-scanner").then((mod) => {
      // a lib exporta { Scanner }
      return mod.Scanner;
    }),
  { ssr: false }
);

/* =========================
   ✅ Tipos & helpers locais
========================= */

type InventarioItem = {
  key: string; // chave única (produto + qtd + umd + (opcional) lote)
  payload: any;
  scannedAt: string;
};

type InventarioResumoItem = {
  key: string;
  produto: string;
  unidade: string;
  totalQtd: number;
  lotes: string[];
};

type InventarioHistorico = {
  id: string;
  startedAt: string;
  endedAt: string;
  totalItens: number;
  resumo: InventarioResumoItem[];
};

type EntryMode = "qr" | "insumo";

type ProductOption = {
  id: string;
  name: string;
  default_unit_label: string | null;
};

const HISTORY_KEY = "gestao2_inventario_history";
// 🔥 Inventário ativo (em andamento) – persiste mesmo se sair da tela
const ACTIVE_KEY = "gestao2_inventario_atual";

const formatDate = (dateString: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("pt-BR");
};

const formatDateTime = (dateString: string) => {
  if (!dateString) return "";
  return new Date(dateString).toLocaleString("pt-BR");
};

/**
 * Tenta interpretar o texto do QR como JSON.
 * Se não for JSON válido, retorna null.
 */
const parseQrPayload = (raw: string) => {
  const cleaned = String(raw || "").trim();
  if (!cleaned) return null;

  try {
    const obj = JSON.parse(cleaned);
    return obj;
  } catch {
    return null;
  }
};

/**
 * Gera uma chave única para evitar que o mesmo item
 * seja contado mais de uma vez no mesmo inventário.
 *
 * Para etiquetas, a chave inclui também o lote (lt),
 * garantindo que cada etiqueta só conte 1x.
 */
const makeInventarioKey = (payload: any) => {
  const p = String(payload?.p || payload?.ins || payload?.insumo || "");
  const q = String(payload?.q || payload?.qtd || "");
  const u = String(payload?.u || payload?.umd || "");
  const lt = String(payload?.lt || ""); // se tiver lote, entra na chave
  return `${p}__${q}__${u}__${lt}`;
};

/**
 * Constrói um resumo da contagem:
 * soma quantidades por produto + unidade e agrega lotes lidos.
 */
const buildResumoFromItens = (
  itens: InventarioItem[]
): InventarioResumoItem[] => {
  const map = new Map<string, InventarioResumoItem>();

  for (const it of itens) {
    const payload = it.payload || {};
    const produto = String(payload?.p || payload?.ins || payload?.insumo || "");
    const unidade = String(payload?.u || payload?.umd || "");
    const qtdNum = Number(payload?.q ?? payload?.qtd ?? 0) || 0;
    const lote = String(payload?.lt || "").trim();

    const key = `${produto}__${unidade}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        produto,
        unidade,
        totalQtd: 0,
        lotes: [],
      });
    }

    const ref = map.get(key)!;
    ref.totalQtd += qtdNum;
    if (lote && !ref.lotes.includes(lote)) {
      ref.lotes.push(lote);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.produto.localeCompare(b.produto, "pt-BR")
  );
};

/**
 * Extrai texto retornado pelo Scanner (@yudiel/react-qr-scanner),
 * independente se vem como string, array ou objetos com rawValue.
 */
const extractTextFromScannerResult = (result: any): string | null => {
  if (!result) return null;

  // string simples
  if (typeof result === "string") {
    return result.trim();
  }

  // array (vários resultados)
  if (Array.isArray(result) && result.length > 0) {
    const first = result[0];
    if (typeof first === "string") return first.trim();
    if (first && typeof (first as any).rawValue === "string") {
      return (first as any).rawValue.trim();
    }
  }

  // objeto único com rawValue
  if (typeof result === "object" && "rawValue" in result) {
    const value = (result as any).rawValue;
    if (typeof value === "string") return value.trim();
  }

  return null;
};

export default function InventarioPage() {
  /* =========================
     ✅ Estado do Inventário
  ========================== */
  const [inventarioAtivo, setInventarioAtivo] = useState(false);
  const [inventarioId, setInventarioId] = useState<string>("");
  const [inventarioStartedAt, setInventarioStartedAt] = useState<string>("");
  const [inventarioItens, setInventarioItens] = useState<InventarioItem[]>([]);
  const [inventarioScannedKeys, setInventarioScannedKeys] = useState<
    Record<string, true>
  >({});
  const [qrInput, setQrInput] = useState("");
  const [toastMsg, setToastMsg] = useState<string>("");

  const [entryMode, setEntryMode] = useState<EntryMode>("qr");

  // Modal do scanner de câmera
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Campos para INSUMOS (lançamento manual)
  const [manualProduto, setManualProduto] = useState("");
  const [manualQtd, setManualQtd] = useState("");
  const [manualUmd, setManualUmd] = useState("");

  // Produtos vindos da tabela products (Supabase)
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductOption[]>([]);
  const [isProductListOpen, setIsProductListOpen] = useState(false);

  // Resumo da última contagem (lado cliente)
  const [ultimoResumo, setUltimoResumo] = useState<InventarioResumoItem[] | null>(
    null
  );

  // Histórico de inventários (localStorage por enquanto)
  const [historico, setHistorico] = useState<InventarioHistorico[]>([]);

  // Resultado da aplicação no backend (Supabase)
  const [applyResult, setApplyResult] = useState<InventoryApplyResult | null>(
    null
  );

  const [isApplying, startApplying] = useTransition();

  const toastTimerRef = useRef<number | null>(null);
  const qrInputRef = useRef<HTMLInputElement | null>(null);
  const productFieldRef = useRef<HTMLDivElement | null>(null);

  /* =========================
     🔥 Restaurar inventário não finalizado
  ========================== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(ACTIVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);

      if (!saved?.inventarioAtivo) return;

      setInventarioAtivo(true);
      setInventarioId(saved.inventarioId || "");
      setInventarioStartedAt(saved.inventarioStartedAt || "");
      setInventarioItens(saved.inventarioItens || []);
      setInventarioScannedKeys(saved.inventarioScannedKeys || {});
      if (saved.entryMode === "qr" || saved.entryMode === "insumo") {
        setEntryMode(saved.entryMode);
      }
    } catch (e) {
      console.error("Erro ao restaurar inventário ativo:", e);
    }
  }, []);

  /* =========================
     💾 Persistir inventário ativo a cada mudança relevante
  ========================== */
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      if (!inventarioAtivo || !inventarioId) {
        window.localStorage.removeItem(ACTIVE_KEY);
        return;
      }

      const payload = {
        inventarioAtivo,
        inventarioId,
        inventarioStartedAt,
        inventarioItens,
        inventarioScannedKeys,
        entryMode,
      };

      window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(payload));
    } catch (e) {
      console.error("Erro ao salvar inventário ativo:", e);
    }
  }, [
    inventarioAtivo,
    inventarioId,
    inventarioStartedAt,
    inventarioItens,
    inventarioScannedKeys,
    entryMode,
  ]);

  /* =========================
     ✅ Carregar / salvar histórico
  ========================== */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as InventarioHistorico[];
      if (Array.isArray(parsed)) {
        setHistorico(parsed);
      }
    } catch (e) {
      console.error("Erro ao carregar histórico de inventário:", e);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(historico));
    } catch (e) {
      console.error("Erro ao salvar histórico de inventário:", e);
    }
  }, [historico]);

  /* =========================
     ✅ Carregar produtos do Supabase
  ========================== */
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data, error } = await supabase
          .from("products")
          .select("id, name, default_unit_label")
          .eq("is_active", true)
          .order("name", { ascending: true });

        if (error) {
          console.error("Erro ao carregar produtos:", error);
          showToast("Erro ao carregar lista de insumos.");
          return;
        }

        const list = (data || []) as ProductOption[];
        setProducts(list);
        setFilteredProducts(list);
      } catch (err) {
        console.error("Erro inesperado ao carregar produtos:", err);
        showToast("Erro inesperado ao carregar insumos.");
      }
    };

    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
     ✅ Fechar lista ao clicar fora
  ========================== */
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        productFieldRef.current &&
        !productFieldRef.current.contains(event.target as Node)
      ) {
        setIsProductListOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* =========================
     ✅ Toast
  ========================== */
  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    // deixa 5 segundos para leitura tranquila
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg("");
    }, 5000);
  };

  /* =========================
     ✅ Fluxo de inventário
  ========================== */

  const iniciarInventario = () => {
    const id = `inv-${Date.now()}`;
    const nowISO = new Date().toISOString();

    setInventarioAtivo(true);
    setInventarioId(id);
    setInventarioStartedAt(nowISO);
    setInventarioItens([]);
    setInventarioScannedKeys({});
    setQrInput("");
    setManualProduto("");
    setManualQtd("");
    setManualUmd("");
    setUltimoResumo(null);
    setApplyResult(null);

    showToast("Inventário iniciado!");

    setTimeout(() => {
      if (entryMode === "qr") {
        qrInputRef.current?.focus();
      }
    }, 50);
  };

  const registrarLeituraInventario = (payload: any) => {
    const key = makeInventarioKey(payload);

    if (inventarioScannedKeys[key]) {
      showToast("Esta etiqueta já foi contada neste inventário!");
      return;
    }

    const newKeys: Record<string, true> = {
      ...inventarioScannedKeys,
      [key]: true,
    };

    const newItem: InventarioItem = {
      key,
      payload,
      scannedAt: new Date().toISOString(),
    };

    const newItens = [newItem, ...inventarioItens];

    setInventarioScannedKeys(newKeys);
    setInventarioItens(newItens);
  };

  /**
   * Chamado quando o scanner de câmera lê um QR
   */
  const handleQrDetected = (rawText: string) => {
    if (!inventarioAtivo) {
      showToast("Inicie um inventário primeiro.");
      return;
    }

    const text = String(rawText || "").trim();
    if (!text) return;

    setQrInput(text); // só para exibir o último lido no campo

    const payload = parseQrPayload(text);
    if (!payload) {
      showToast("QR inválido: o conteúdo não é um JSON esperado.");
      return;
    }

    registrarLeituraInventario(payload);
  };

  /**
   * Fallback: se algum leitor colar texto e der Enter
   */
  const handleQrSubmit = () => {
    if (!inventarioAtivo) {
      showToast("Inicie um inventário primeiro.");
      return;
    }
    if (!qrInput.trim()) {
      showToast("Nenhum QR lido ainda.");
      return;
    }
    handleQrDetected(qrInput);
  };

  const handleManualSubmit = () => {
    if (!inventarioAtivo) {
      showToast("Inicie um inventário primeiro.");
      return;
    }

    if (!manualProduto.trim() || !manualQtd.trim() || !manualUmd.trim()) {
      showToast("Preencha Produto, Quantidade e Unidade.");
      return;
    }

    const qtdNum = Number(manualQtd.replace(",", "."));
    if (!Number.isFinite(qtdNum) || qtdNum <= 0) {
      showToast("Quantidade inválida.");
      return;
    }

    const payload = {
      p: manualProduto.trim(),
      q: qtdNum,
      u: manualUmd.trim(),
      // Não há lote nem data de vencimento aqui
      lt: null,
      dv: null,
      source: "manual",
    };

    registrarLeituraInventario(payload);

    // Mantém produto/unidade, só zera quantidade
    setManualQtd("");
  };

  const limparItensInventarioAtual = () => {
    setInventarioItens([]);
    setInventarioScannedKeys({});
    setUltimoResumo(null);
    setApplyResult(null);
    showToast("Itens do inventário atual foram limpos.");
  };

  const finalizarInventario = () => {
    if (!inventarioAtivo) {
      showToast("Nenhum inventário ativo.");
      return;
    }

    const endedAt = new Date().toISOString();
    const resumo = buildResumoFromItens(inventarioItens);

    setUltimoResumo(resumo);

    if (inventarioItens.length === 0) {
      showToast("Inventário finalizado (nenhum item contado).");
    } else {
      showToast("Inventário finalizado! Aplicando ajustes no estoque...");
    }

    // Salva no histórico local (lado client)
    const histItem: InventarioHistorico = {
      id: inventarioId || `inv-${Date.now()}`,
      startedAt: inventarioStartedAt || endedAt,
      endedAt,
      totalItens: inventarioItens.length,
      resumo,
    };

    setHistorico((prev) => [histItem, ...prev]);

    // ✅ Envia o resumo para o backend aplicar no estoque (transição)
    const payload: InventoryResumoInput[] = resumo.map((r) => ({
      produto: r.produto,
      unidade: r.unidade,
      totalQtd: r.totalQtd,
    }));

    startApplying(async () => {
      try {
        const result = await aplicarInventario(payload);
        setApplyResult(result);

        if (!result.ok) {
          showToast(
            "Inventário finalizado, mas houve erros ao aplicar no estoque."
          );
          console.error("aplicarInventario result:", result);
        } else {
          showToast("Inventário aplicado com sucesso no estoque!");
          console.log("Inventory apply result:", result);
        }
      } catch (e) {
        console.error("Erro ao aplicar inventário no backend:", e);
        showToast("Erro ao aplicar inventário no backend.");
      }
    });

    // Limpa estado do inventário atual
    setInventarioAtivo(false);
    setInventarioId("");
    setInventarioStartedAt("");
    setInventarioItens([]);
    setInventarioScannedKeys({});
    setQrInput("");
    setManualProduto("");
    setManualQtd("");
    setManualUmd("");
  };

  /* =========================
     ✅ Handlers do autocomplete de produto
  ========================== */

  const handleProdutoChange = (value: string) => {
    setManualProduto(value);

    if (!value) {
      setFilteredProducts(products);
      setIsProductListOpen(true);
      return;
    }

    const term = value.toLowerCase();
    const filtered = products.filter((p) =>
      p.name.toLowerCase().includes(term)
    );
    setFilteredProducts(filtered);
    setIsProductListOpen(true);
  };

  const handleProdutoFocus = () => {
    setFilteredProducts(products);
    if (products.length > 0) {
      setIsProductListOpen(true);
    }
  };

  const handleSelectProduct = (product: ProductOption) => {
    setManualProduto(product.name);
    if (product.default_unit_label) {
      setManualUmd(product.default_unit_label);
    }
    setIsProductListOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* ✅ Toast flutuante centralizado (desktop e mobile) */}
      {toastMsg && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none">
          <div className="w-[90%] max-w-md rounded-lg bg-red-600 text-white px-4 py-3 shadow-xl text-sm sm:text-base font-semibold break-words flex items-start gap-3 pointer-events-auto">
            <span className="flex-1">{toastMsg}</span>
            <button
              type="button"
              onClick={() => setToastMsg("")}
              className="ml-2 text-white/80 hover:text-white text-lg leading-none"
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Header da página */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventário</h1>
          <p className="text-gray-600">
            Contagem de estoque via leitura de QR Code das etiquetas e
            lançamento de insumos, com ajuste automático do Estoque Atual.
          </p>
        </div>
      </div>

      {/* Card principal de inventário */}
      <Card>
        <CardHeader>
          <CardTitle>Inventário / Contagem</CardTitle>
          <CardDescription>
            Cada etiqueta pode ser lida apenas 1 vez por inventário. Você pode
            lançar insumos (produtos primários) e também ler QR das etiquetas
            geradas na sessão de Etiquetas. Ao finalizar, a contagem é enviada
            ao backend para ajustar o Estoque Atual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Controles principais */}
          <div className="flex flex-wrap gap-3 items-center">
            {!inventarioAtivo ? (
              <Button onClick={iniciarInventario}>
                ▶️ Iniciar Inventário
              </Button>
            ) : (
              <>
                <Button
                  onClick={finalizarInventario}
                  disabled={isApplying}
                  // 🔴 Força fundo vermelho e texto branco
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  {isApplying
                    ? "Aplicando ajustes..."
                    : "⏹️ Finalizar & Aplicar Estoque"}
                </Button>
                <Button
                  variant="outline"
                  onClick={limparItensInventarioAtual}
                  disabled={isApplying}
                >
                  🧹 Limpar Itens
                </Button>
              </>
            )}

            <div className="text-sm text-muted-foreground">
              Status:{" "}
              <strong>{inventarioAtivo ? "ATIVO" : "INATIVO"}</strong>{" "}
              {inventarioAtivo ? `(${inventarioId})` : ""}
            </div>

            {inventarioStartedAt && (
              <div className="text-xs text-muted-foreground">
                Iniciado em: {formatDateTime(inventarioStartedAt)}
              </div>
            )}
          </div>

          {/* Seletor de modo de entrada */}
          <div className="space-y-2">
            <Label>Modo de entrada</Label>
            <div className="inline-flex rounded-md border overflow-hidden">
              <button
                type="button"
                onClick={() => setEntryMode("insumo")}
                className={`px-4 py-2 text-sm font-medium ${
                  entryMode === "insumo"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                1️⃣ Insumos (produtos primários)
              </button>
              <button
                type="button"
                onClick={() => {
                  setEntryMode("qr");
                  setTimeout(() => qrInputRef.current?.focus(), 50);
                }}
                className={`px-4 py-2 text-sm font-medium border-l ${
                  entryMode === "qr"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                2️⃣ Ler QR das Etiquetas
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Você pode alternar entre os modos a qualquer momento durante o
              inventário.
            </p>
          </div>

          {/* Formulários de entrada */}
          {entryMode === "insumo" ? (
            // =========================
            //  MODO: INSUMOS
            // =========================
            <div className="space-y-3 border rounded-md p-4 bg-slate-50/60">
              <div className="text-sm font-semibold mb-1">
                Lançamento de Insumos (produtos primários)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                {/* Campo Produto / Insumo com autocomplete */}
                <div className="md:col-span-2 relative" ref={productFieldRef}>
                  <Label>Produto / Insumo</Label>
                  <Input
                    value={manualProduto}
                    onChange={(e) => handleProdutoChange(e.target.value)}
                    onFocus={handleProdutoFocus}
                    placeholder="Ex.: Farinha de trigo, Leite integral..."
                    disabled={!inventarioAtivo || isApplying}
                    autoComplete="off"
                  />
                  {isProductListOpen && (
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white shadow-lg text-sm">
                      {filteredProducts.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Nenhum produto encontrado.
                        </div>
                      ) : (
                        filteredProducts.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-100"
                            onClick={() => handleSelectProduct(p)}
                          >
                            <span>{p.name}</span>
                            {p.default_unit_label && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                {p.default_unit_label}
                              </span>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <Label>Quantidade</Label>
                  <Input
                    value={manualQtd}
                    onChange={(e) => setManualQtd(e.target.value)}
                    placeholder="Ex.: 10"
                    disabled={!inventarioAtivo || isApplying}
                  />
                </div>
                <div>
                  <Label>Unidade</Label>
                  <Input
                    value={manualUmd}
                    onChange={(e) => setManualUmd(e.target.value)}
                    placeholder="KG, L, UN..."
                    disabled={!inventarioAtivo || isApplying}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleManualSubmit}
                  disabled={!inventarioAtivo || isApplying}
                  className="mt-2"
                >
                  ➕ Adicionar ao Inventário
                </Button>
              </div>
            </div>
          ) : (
            // =========================
            //  MODO: QR CODE (CÂMERA)
            // =========================
            <div className="space-y-3 border rounded-md p-4 bg-slate-50/60">
              <div className="text-sm font-semibold mb-1">
                Leitura de QR Code das Etiquetas
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <Label>Último QR lido</Label>
                  <Input
                    ref={qrInputRef}
                    value={qrInput}
                    readOnly
                    placeholder="Nenhum QR lido ainda."
                    disabled={!inventarioAtivo || isApplying}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    className="w-full"
                    type="button"
                    onClick={() => {
                      if (!inventarioAtivo) {
                        showToast("Inicie um inventário primeiro.");
                        return;
                      }
                      setIsQrModalOpen(true);
                    }}
                    disabled={isApplying}
                  >
                    📷 Ler QR com a Câmera
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Clique em &quot;Ler QR com a Câmera&quot; e aponte o dispositivo
                para o QR Code das etiquetas geradas na tela de Etiquetas.
              </p>
            </div>
          )}

          {/* Resumo rápido de itens */}
          <div className="text-sm">
            <strong>Itens lançados neste inventário:</strong>{" "}
            {inventarioItens.length}
          </div>

          {/* Tabela com os itens lidos no inventário atual */}
          {inventarioItens.length > 0 && (
            <div className="max-h-[320px] overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Venc.</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Data Leitura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventarioItens.map((it) => {
                    const payload = it.payload || {};
                    const produto =
                      payload?.p || payload?.ins || payload?.insumo || "-";
                    const qtd = payload?.q ?? payload?.qtd ?? "-";
                    const un = payload?.u ?? payload?.umd ?? "";
                    const lt = payload?.lt || "-";
                    const dv = payload?.dv ? formatDate(payload.dv) : "-";
                    const source =
                      payload?.source === "manual" ? "Insumo" : "Etiqueta";

                    return (
                      <TableRow key={it.key}>
                        <TableCell className="font-medium">{produto}</TableCell>
                        <TableCell>{String(qtd)}</TableCell>
                        <TableCell>{String(un)}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {lt}
                        </TableCell>
                        <TableCell>{dv}</TableCell>
                        <TableCell className="text-xs">{source}</TableCell>
                        <TableCell className="text-xs">
                          {formatDateTime(it.scannedAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal do Scanner de QR Code */}
      <Dialog open={isQrModalOpen} onOpenChange={setIsQrModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ler QR Code da Etiqueta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Aponte a câmera para o QR Code impresso na etiqueta. Assim que a
              leitura for concluída, o item será lançado neste inventário.
            </p>
            <div className="rounded-md overflow-hidden border bg-black/80">
              <QrScanner
                constraints={{
                  facingMode: "environment",
                }}
                formats={["qr_code"]}
                onScan={(result: any) => {
                  const text = extractTextFromScannerResult(result);
                  if (!text) return;
                  handleQrDetected(text);
                  setIsQrModalOpen(false);
                }}
                onError={(error: any) => {
                  console.error("Erro no scanner de QR:", error);
                  showToast("Erro ao acessar a câmera ou ler o QR.");
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setIsQrModalOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Resumo da última contagem */}
      {ultimoResumo && ultimoResumo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumo da última contagem</CardTitle>
            <CardDescription>
              Totais por produto/unidade com base em todos os itens lançados
              (insumos + etiquetas). Esse mesmo resumo é enviado ao backend para
              gerar os ajustes de estoque.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[260px] overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead>Total Contado</TableHead>
                    <TableHead>Lotes (se houver)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ultimoResumo.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">
                        {r.produto}
                      </TableCell>
                      <TableCell>{r.unidade}</TableCell>
                      <TableCell>{r.totalQtd}</TableCell>
                      <TableCell className="text-xs">
                        {r.lotes.length > 0 ? r.lotes.join(", ") : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado da aplicação no backend */}
      {applyResult && (
        <Card>
          <CardHeader>
            <CardTitle>Resultado da aplicação no estoque</CardTitle>
            <CardDescription>
              Detalhamento de como o inventário foi aplicado na base de dados.
              {applyResult.inventoryCountId && (
                <>
                  {" "}
                  ID do inventário:{" "}
                  <span className="font-mono text-xs">
                    {applyResult.inventoryCountId}
                  </span>
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {applyResult.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum item foi processado.
              </p>
            ) : (
              <div className="max-h-[260px] overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Produto</TableHead>
                      <TableHead>Un.</TableHead>
                      <TableHead>Contado</TableHead>
                      <TableHead>Estoque Antes</TableHead>
                      <TableHead>Diferença</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mensagem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applyResult.items.map((it, idx) => (
                      <TableRow key={`${it.produto}-${it.unidade}-${idx}`}>
                        <TableCell className="font-medium">
                          {it.produto}
                        </TableCell>
                        <TableCell>{it.unidade}</TableCell>
                        <TableCell>{it.counted}</TableCell>
                        <TableCell>{it.current}</TableCell>
                        <TableCell
                          className={
                            it.diff > 0
                              ? "text-green-600 font-semibold"
                              : it.diff < 0
                              ? "text-red-600 font-semibold"
                              : "text-gray-600"
                          }
                        >
                          {it.diff}
                        </TableCell>
                        <TableCell
                          className={
                            it.status === "ok"
                              ? "text-green-700 font-semibold"
                              : "text-red-700 font-semibold"
                          }
                        >
                          {it.status === "ok" ? "OK" : "Problema"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {it.errorMessage || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Histórico de inventários (localStorage) */}
      {historico.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de contagens</CardTitle>
            <CardDescription>
              Inventários anteriores (salvos localmente neste navegador). Em
              breve, isso pode ser movido para a tabela{" "}
              <code>inventory_counts</code> no banco.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[260px] overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Iniciado em</TableHead>
                    <TableHead>Finalizado em</TableHead>
                    <TableHead>Itens lançados</TableHead>
                    <TableHead>Produtos distintos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historico.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-mono text-xs">
                        {h.id}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDateTime(h.startedAt)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDateTime(h.endedAt)}
                      </TableCell>
                      <TableCell>{h.totalItens}</TableCell>
                      <TableCell>{h.resumo.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Link para histórico salvo no banco */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico no banco de dados</CardTitle>
          <CardDescription>
            Veja todas as contagens de inventário já aplicadas em{" "}
            <code>inventory_counts</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            Use essa tela para consultar inventários antigos, divergências e
            gerar relatórios consolidados diretamente do Supabase.
          </p>
          <Link href="/dashboard/inventario/historico">
            <Button variant="outline" size="sm">
              Ver histórico completo →
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
