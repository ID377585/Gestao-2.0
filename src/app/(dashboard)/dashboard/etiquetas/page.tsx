"use client";

// src/app/(dashboard)/dashboard/etiquetas/page.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";

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

// ✅ Combo (igual pedidos)
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

/* =========================
   ✅ TIPOS DO BACK (route handler /api/inventory-labels)
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
   ✅ Produtos (GET /api/products) — para o combo Insumo/Produto
========================= */
type ProductOption = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
};

/* =========================
   ✅ MOCKS (depois a gente troca por auth real)
========================= */
const USUARIO_LOGADO_NOME = "Admin User";
const ESTABELECIMENTO_NOME = "Matriz";

/* =========================
   ✅ Tipos de etiqueta
========================= */
type TipoSel = "MANIPULACAO" | "REVALIDAR";

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

interface EtiquetaGerada {
  id: string; // ✅ estável: row.id do banco quando vem do histórico / local quando recém-criada
  tipo: TipoSel;
  tamanho: string;
  insumo: string;
  qtd: number;
  umd: string;
  dataManip: string; // ISO yyyy-mm-dd
  dataVenc: string; // ISO yyyy-mm-dd
  loteMan: string;
  responsavel: string;

  alergenico?: string;
  armazenamento?: string;
  ingredientes?: string;

  // fabricante
  dataFabricante?: string;
  dataVencimento?: string;
  sif?: string;
  loteFab?: string;

  localEnvio?: string;
  localArmazenado?: string;

  createdAt: string; // ISO datetime
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
   ✅ Helpers
========================= */
const getTodayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const isoToDDMMYY = (iso: string) => {
  if (!iso || iso.length < 10) return "";
  const yyyy = iso.slice(2, 4);
  const mm = iso.slice(5, 7);
  const dd = iso.slice(8, 10);
  return `${dd}${mm}${yyyy}`;
};

const removeAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const getInsumoCode2 = (nome: string) => {
  const first = (nome || "").trim().split(/\s+/)[0] ?? "";
  const cleaned = removeAccents(first).toUpperCase();
  return cleaned.slice(0, 2) || "XX";
};

const gerarSufixoRandomico = (tamanho = 3) => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < tamanho; i++) {
    const idx = Math.floor(Math.random() * chars.length);
    result += chars[idx];
  }
  return result;
};

// Porcionamento
type LinhaPorcao = { id: string; qtd: string };
const makeLinhaId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type LinhaErro = {
  baseQtd: boolean;
  porcoes: Record<string, boolean>;
};

// QR payload (unificado)
const buildQrPayloadFromEtiqueta = (e: EtiquetaGerada) => {
  const payload = {
    v: 1,
    lt: e.loteMan,
    p: e.insumo,
    q: e.qtd,
    u: e.umd,
    dv: e.dataVenc,
  };
  return JSON.stringify(payload);
};

const safeJsonParse = <T,>(s: string): T | null => {
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
};

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

  localEnvio: ESTABELECIMENTO_NOME,
  localArmazenado: "",
});

/* =========================
   ✅ API helpers (CLIENT -> Route Handler)
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
  productName: string;
  qty: number;
  unitLabel: string;
  labelCode: string;
  extraPayload?: unknown;
}): Promise<void> {
  const bodyToSend: any = {
    product_name: payload.productName,
    qty: payload.qty,
    unit_label: payload.unitLabel,
    label_code: payload.labelCode,
    notes:
      payload.extraPayload !== undefined
        ? JSON.stringify(payload.extraPayload)
        : null,
  };

  const res = await fetch("/api/inventory-labels", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(bodyToSend),
  });

  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = `Erro ao salvar etiqueta (HTTP ${res.status}).`;
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
}

async function apiListProducts(): Promise<ProductOption[]> {
  const res = await fetch("/api/products", { method: "GET" });
  const contentType = res.headers.get("content-type") || "";

  if (!res.ok) {
    let message = `Erro ao listar produtos (HTTP ${res.status}).`;
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

  const data = (await res.json()) as ProductOption[];
  return Array.isArray(data) ? data : [];
}

/* =========================
   ✅ Inventário (UI mock) — mantendo o que já estava validado
========================= */
type InventarioItem = {
  key: string;
  payload: any;
  scannedAt: string;
};

export default function EtiquetasPage() {
  const [etiquetasGeradas, setEtiquetasGeradas] = useState<EtiquetaGerada[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);

  const [showNovaEtiqueta, setShowNovaEtiqueta] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] =
    useState<TipoSel>("MANIPULACAO");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("Grande");

  // ✅ produtos pro combo
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  const [formData, setFormData] = useState(createDefaultForm());
  const [linhasPorcao, setLinhasPorcao] = useState<LinhaPorcao[]>([]);
  const [erros, setErros] = useState<LinhaErro>({ baseQtd: false, porcoes: {} });

  // ✅ Inventário (mantido)
  const [inventarioAtivo, setInventarioAtivo] = useState(false);
  const [inventarioId, setInventarioId] = useState<string>("");
  const [inventarioItens, setInventarioItens] = useState<InventarioItem[]>([]);
  const [inventarioScannedKeys, setInventarioScannedKeys] = useState<
    Record<string, true>
  >({});
  const [qrInput, setQrInput] = useState("");
  const [toastMsg, setToastMsg] = useState<string>("");
  const toastTimerRef = useRef<number | null>(null);
  const qrInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg("");
    }, 3000);
  }, []);

  const iniciarInventario = useCallback(() => {
    const id = `inv-${Date.now()}`;
    setInventarioAtivo(true);
    setInventarioId(id);
    setInventarioItens([]);
    setInventarioScannedKeys({});
    setQrInput("");
    showToast("Inventário iniciado!");
    setTimeout(() => {
      qrInputRef.current?.focus();
    }, 50);
  }, [showToast]);

  const finalizarInventario = useCallback(() => {
    setInventarioAtivo(false);
    setInventarioId("");
    setInventarioItens([]);
    setInventarioScannedKeys({});
    setQrInput("");
    showToast("Inventário finalizado!");
  }, [showToast]);

  const parseQrPayload = useCallback((raw: string) => {
    const cleaned = String(raw || "").trim();
    if (!cleaned) return null;

    try {
      const obj = JSON.parse(cleaned);
      return obj;
    } catch {
      return null;
    }
  }, []);

  const makeInventarioKey = useCallback((payload: any) => {
    const p = String(payload?.p || payload?.ins || payload?.insumo || "");
    const q = String(payload?.q || payload?.qtd || "");
    const u = String(payload?.u || payload?.umd || "");
    return `${p}__${q}__${u}`;
  }, []);

  const registrarLeituraInventario = useCallback(
    (payload: any) => {
      const key = makeInventarioKey(payload);

      if (inventarioScannedKeys[key]) {
        showToast("Este produto já foi contado!");
        return;
      }

      setInventarioScannedKeys((prev) => ({ ...prev, [key]: true }));
      setInventarioItens((prev) => [
        {
          key,
          payload,
          scannedAt: new Date().toISOString(),
        },
        ...prev,
      ]);
    },
    [inventarioScannedKeys, makeInventarioKey, showToast]
  );

  const handleQrSubmit = useCallback(() => {
    if (!inventarioAtivo) {
      showToast("Inicie um inventário primeiro.");
      return;
    }

    const payload = parseQrPayload(qrInput);
    if (!payload) {
      showToast("QR inválido (não é JSON).");
      return;
    }

    registrarLeituraInventario(payload);
    setQrInput("");
    setTimeout(() => qrInputRef.current?.focus(), 10);
  }, [inventarioAtivo, parseQrPayload, qrInput, registrarLeituraInventario, showToast]);

  const formatDate = useCallback((dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("pt-BR");
  }, []);

  const formatDateTime = useCallback((dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString("pt-BR");
  }, []);

  const handleInputChange = useCallback(
    (field: keyof typeof formData, value: string) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [formData]
  );

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId) ?? null;
  }, [products, selectedProductId]);

  const displayInsumoLabel = useMemo(() => {
    const manual = String(formData.insumo || "").trim();
    if (manual) return manual;
    if (productsLoading) return "Carregando produtos...";
    return "Selecionar produto...";
  }, [formData.insumo, productsLoading]);

  // ✅ carregar produtos 1x
  useEffect(() => {
    let mounted = true;
    const loadProducts = async () => {
      setProductsLoading(true);
      try {
        const rows = await apiListProducts();
        const sorted = [...rows].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "pt-BR", { sensitivity: "base" })
        );
        if (mounted) setProducts(sorted);
      } catch (e) {
        console.error("Erro ao carregar produtos:", e);
        if (mounted) setProducts([]);
      } finally {
        if (mounted) setProductsLoading(false);
      }
    };

    void loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

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

        const mapped: EtiquetaGerada[] = rows.map((row) => {
          const extra = row.notes ? safeJsonParse<Partial<EtiquetaGerada>>(row.notes) : null;
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

            alergenico: extra?.alergenico,
            armazenamento: extra?.armazenamento,
            ingredientes: extra?.ingredientes,
            dataFabricante: extra?.dataFabricante,
            dataVencimento: extra?.dataVencimento,
            sif: extra?.sif,
            loteFab: extra?.loteFab,
            localEnvio: extra?.localEnvio,
            localArmazenado: extra?.localArmazenado,

            createdAt: extra?.createdAt ?? createdAt,
          };
        });

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
  }, []);

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

      // ✅ reset combo
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
    setLinhasPorcao((prev) => prev.map((l) => (l.id === id ? { ...l, qtd } : l)));
    setErros((prev) => ({
      ...prev,
      porcoes: { ...prev.porcoes, [id]: false },
    }));
  }, []);

  // ✅ LOTE: IE-XX-DDMMAA-0D-XXX (mantido fixo 0D como você já validou)
  const gerarLoteVigilancia = useCallback(() => {
    const ie = "IE";
    const cod = getInsumoCode2(formData.insumo);
    const dt = isoToDDMMYY(formData.dataManip);
    const shelfPart = `0D`; // fixo
    const base = `${ie}-${cod}-${dt}-${shelfPart}`;
    const sufixo = gerarSufixoRandomico(3);
    return `${base}-${sufixo}`;
  }, [formData.insumo, formData.dataManip]);

  const makeQrDataUrl = useCallback(async (text: string) => {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 220,
    });
  }, []);

  const imprimirBatchNoBrowser = useCallback(
    async (etqs: EtiquetaGerada[]) => {
      const w = window.open("", "_blank", "width=900,height=700");
      if (!w) return;

      const LABEL_W_MM = 104;
      const LABEL_H_MM = 50.8;

      const qrDataUrls = await Promise.all(
        etqs.map((e) => makeQrDataUrl(buildQrPayloadFromEtiqueta(e)))
      );

      const buildExtraFab = (e: EtiquetaGerada) => {
        let html = "";

        if (e.dataFabricante) {
          html +=
            `<div class="row"><span class="k">Fabricação:</span><span class="v">` +
            formatDate(e.dataFabricante) +
            `</span></div>`;
        }

        if (e.dataVencimento) {
          html +=
            `<div class="row"><span class="k">Val. Original:</span><span class="v">` +
            formatDate(e.dataVencimento) +
            `</span></div>`;
        }

        if (e.sif) {
          html +=
            `<div class="row"><span class="k">SIF:</span><span class="v">` +
            e.sif +
            `</span></div>`;
        }

        if (e.loteFab) {
          html +=
            `<div class="row"><span class="k">Lote Fab.:</span><span class="v">` +
            e.loteFab +
            `</span></div>`;
        }

        return html;
      };

      const parts: string[] = [];

      const head = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Impressão de Etiquetas</title>
  <style>
    @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }

    html, body {
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: Arial, Helvetica, sans-serif;
      background: #fff;
    }

    .page {
      width: ${LABEL_W_MM}mm;
      height: ${LABEL_H_MM}mm;
      page-break-after: always;
      break-after: page;
      box-sizing: border-box;
      padding: 2.6mm 3.2mm;
      display: flex;
      align-items: stretch;
      justify-content: stretch;
      overflow: hidden;
    }

    .label {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .main {
      display: flex;
      flex: 1;
      gap: 2.5mm;
      align-items: stretch;
    }

    .qrBox {
      width: 24mm;
      min-width: 24mm;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

    .qrImg {
      width: 24mm;
      height: 24mm;
      object-fit: contain;
    }

    .qrHint {
      margin-top: 1mm;
      font-size: 2.6mm;
      line-height: 1.1;
      text-align: center;
      font-weight: 700;
      letter-spacing: 0.1mm;
    }

    .info {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 0.8mm;
      overflow: hidden;
    }

    .row {
      display: flex;
      align-items: baseline;
      gap: 1.2mm;
      font-size: 3.5mm;
      line-height: 1.12;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .k {
      font-weight: 800;
      min-width: 22mm;
      flex: 0 0 auto;
    }

    .v {
      font-weight: 650;
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .row.produto { font-size: 4.0mm; }
    .row.qtd     { font-size: 4.0mm; }

    .footer {
      font-size: 3.0mm;
      line-height: 1.1;
      margin-top: 1mm;
      display: flex;
      justify-content: space-between;
      gap: 2mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
`;
      parts.push(head);

      etqs.forEach((e, i) => {
        const isFab = e.tipo === "REVALIDAR";
        const extraFab = isFab ? buildExtraFab(e) : "";
        const qrSrc = qrDataUrls[i];

        const pageHtml = `
        <div class="page">
          <div class="label">
            <div class="main">
              <div class="qrBox">
                <img class="qrImg" alt="QR" src="${qrSrc}" />
                <div class="qrHint">SCAN</div>
              </div>

              <div class="info">
                <div class="row produto"><span class="k">Produto:</span><span class="v">${e.insumo}</span></div>
                <div class="row qtd"><span class="k">Qtd:</span><span class="v">${e.qtd} ${e.umd}</span></div>

                <div class="row"><span class="k">Manipulação:</span><span class="v">${formatDate(
                  e.dataManip
                )}</span></div>
                <div class="row"><span class="k">Vencimento:</span><span class="v">${formatDate(
                  e.dataVenc
                )}</span></div>

                <div class="row"><span class="k">Lote:</span><span class="v">${e.loteMan}</span></div>
                <div class="row"><span class="k">Responsável:</span><span class="v">${e.responsavel}</span></div>

                ${
                  e.alergenico
                    ? `<div class="row"><span class="k">Alergênico:</span><span class="v">${e.alergenico}</span></div>`
                    : ""
                }

                ${extraFab}
              </div>
            </div>

            <div class="footer">
              <span>${e.localEnvio ? "Envio: " + e.localEnvio : ""}</span>
              <span>${e.localArmazenado ? "Arm.: " + e.localArmazenado : ""}</span>
            </div>
          </div>
        </div>
      `;
        parts.push(pageHtml);
      });

      // ✅ melhoria: aguardar imagens (QR) carregarem antes de imprimir
      parts.push(`
<script>
  function waitImagesLoaded() {
    const imgs = Array.from(document.images || []);
    if (imgs.length === 0) return Promise.resolve();
    return Promise.all(imgs.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(res => {
        img.onload = () => res();
        img.onerror = () => res();
      });
    }));
  }

  window.onload = async () => {
    try { await waitImagesLoaded(); } catch(e) {}
    window.focus();
    window.print();
  };
</script>
</body>
</html>`);

      w.document.open();
      w.document.write(parts.join("\n"));
      w.document.close();
    },
    [formatDate, makeQrDataUrl]
  );

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
    if (!String(formData.umd || "").trim()) {
      alert("Preencha a Unidade para imprimir (ex: kg, g, un).");
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

    const novas: EtiquetaGerada[] = qtds.map((qtdStr, idx) => {
      const loteUnico = gerarLoteVigilancia();
      return {
        id: `${nowISO}-${idx}-${Math.random().toString(16).slice(2)}`, // id local (antes do reload/histórico do banco)
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

        localEnvio: formData.localEnvio || undefined,
        localArmazenado: formData.localArmazenado || undefined,
        createdAt: nowISO,
      };
    });

    try {
      await Promise.all(
        novas.map((et) =>
          apiCreateInventoryLabel({
            productName: et.insumo,
            qty: et.qtd,
            unitLabel: et.umd,
            labelCode: et.loteMan,
            extraPayload: et,
          })
        )
      );
    } catch (e: any) {
      console.error("Erro ao salvar etiquetas no banco:", e);
      alert(e?.message ?? "Falha ao salvar etiqueta no banco.");
      return;
    }

    setEtiquetasGeradas((prev) => [...novas, ...prev]);
    await imprimirBatchNoBrowser(novas);
    setShowNovaEtiqueta(false);
  }, [
    formData,
    gerarLoteVigilancia,
    imprimirBatchNoBrowser,
    linhasPorcao,
    tamanhoSelecionado,
    tipoSelecionado,
    validarQuantidades,
  ]);

  const tiposVisiveis = useMemo(
    () => tiposEtiqueta.filter((t) => t.nome === "MANIPULACAO"),
    []
  );

  const hojeISO = useMemo(() => getTodayISO(), []);
  const etiquetasHoje = useMemo(
    () => etiquetasGeradas.filter((e) => (e.createdAt || "").startsWith(hojeISO)).length,
    [etiquetasGeradas, hojeISO]
  );

  return (
    <div className="space-y-6">
      {/* ✅ Toast (Inventário) */}
      {toastMsg && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999]">
          <div className="px-6 py-3 rounded-lg shadow-lg bg-red-600 text-white text-lg font-extrabold">
            {toastMsg}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sistema de Etiquetas</h1>
          <p className="text-gray-600">Impressão térmica de etiquetas de manipulação</p>
        </div>
        <div className="flex space-x-2">
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

      {/* ✅ Inventário / Contagem por QR Code (mantido do que já funcionava) */}
      <Card>
        <CardHeader>
          <CardTitle>Inventário / Contagem por QR Code</CardTitle>
          <CardDescription>
            Cada etiqueta pode ser lida apenas 1 vez por inventário. Ao finalizar, a contagem
            reinicia para permitir nova leitura no próximo inventário.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            {!inventarioAtivo ? (
              <Button onClick={iniciarInventario}>▶️ Iniciar Inventário</Button>
            ) : (
              <Button variant="destructive" onClick={finalizarInventario}>
                ⏹️ Finalizar Inventário
              </Button>
            )}

            <div className="text-sm text-muted-foreground">
              Status: <strong>{inventarioAtivo ? "ATIVO" : "INATIVO"}</strong>{" "}
              {inventarioAtivo ? `(${inventarioId})` : ""}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <Label>Leitura do QR (scanner cola o texto e dá Enter)</Label>
              <Input
                ref={qrInputRef}
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder='Ex.: {"v":1,"lt":"IE-FA-...","p":"Farinha","q":2,"u":"kg","dv":"2026-01-07"}'
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleQrSubmit();
                  }
                }}
                disabled={!inventarioAtivo}
              />
            </div>

            <div className="flex gap-2">
              <Button
                className="w-full"
                onClick={handleQrSubmit}
                disabled={!inventarioAtivo || !qrInput.trim()}
              >
                Ler QR
              </Button>
            </div>
          </div>

          <div className="text-sm">
            <strong>Itens contados:</strong> {inventarioItens.length}
          </div>

          {inventarioItens.length > 0 && (
            <div className="max-h-[240px] overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Venc.</TableHead>
                    <TableHead>Data Leitura</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventarioItens.map((it) => (
                    <TableRow key={it.key}>
                      <TableCell className="font-medium">
                        {it.payload?.p || it.payload?.ins || it.payload?.insumo || "-"}
                      </TableCell>
                      <TableCell>
                        {String(it.payload?.q ?? it.payload?.qtd ?? "-")}{" "}
                        {String(it.payload?.u ?? it.payload?.umd ?? "")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {it.payload?.lt || "-"}
                      </TableCell>
                      <TableCell>
                        {it.payload?.dv ? formatDate(it.payload.dv) : "-"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDateTime(it.scannedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Etiquetas</CardTitle>
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
            <p className="text-xs text-muted-foreground">Etiquetas de manipulação</p>
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
            <p className="text-xs text-muted-foreground">Etiquetas com dados do fabricante</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hoje</CardTitle>
            <span className="text-2xl">📅</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{etiquetasHoje}</div>
            <p className="text-xs text-muted-foreground">Etiquetas geradas hoje</p>
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
                Precisa de dados do fabricante? Abra “Nova Etiqueta” e selecione{" "}
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
                      colSpan={9}
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
                        >
                          {TIPO_LABEL[etiqueta.tipo]}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{etiqueta.insumo}</TableCell>
                      <TableCell>
                        {etiqueta.qtd} {etiqueta.umd}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{etiqueta.loteMan}</TableCell>
                      <TableCell>{etiqueta.responsavel}</TableCell>
                      <TableCell>{formatDateTime(etiqueta.createdAt)}</TableCell>
                      <TableCell>{formatDate(etiqueta.dataVenc)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>
                            <strong>Envio:</strong> {etiqueta.localEnvio || "-"}
                          </p>
                          <p>
                            <strong>Armazenado:</strong> {etiqueta.localArmazenado || "-"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void imprimirBatchNoBrowser([etiqueta])}
                            title="Reimprimir"
                          >
                            🖨️
                          </Button>
                          <Button size="sm" variant="outline" title="Visualizar" disabled>
                            👁️
                          </Button>
                          <Button size="sm" variant="outline" title="Copiar" disabled>
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
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 gap-3">
              <h3 className="text-lg sm:text-xl font-semibold">
                Nova Etiqueta - {TIPO_LABEL_LONG[tipoSelecionado]}
              </h3>
              <Button variant="ghost" onClick={() => setShowNovaEtiqueta(false)}>
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <Label>Tipo de Etiqueta</Label>
                  <select
                    value={tipoSelecionado}
                    onChange={(e) => setTipoSelecionado(e.target.value as TipoSel)}
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

              {/* ✅ INSUMO/PRODUTO (Combo pesquisável — sem “segunda listagem” embaixo) */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
                  <div className="min-w-0 md:col-span-6">
                    <Label>Insumo/Produto *</Label>

                    <Popover open={productOpen} onOpenChange={setProductOpen} modal>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          aria-expanded={productOpen}
                          className="w-full justify-between"
                        >
                          {displayInsumoLabel}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent
                        className="w-[--radix-popover-trigger-width] p-0 z-[9999]"
                        align="start"
                        sideOffset={6}
                      >
                        <Command>
                          <CommandInput placeholder="Buscar produto..." />
                          <CommandList>
                            <CommandEmpty>
                              {productsLoading ? "Carregando..." : "Nenhum produto encontrado."}
                            </CommandEmpty>

                            <CommandGroup>
                              {products.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.name} ${p.category ?? ""}`}
                                  onSelect={() => {
                                    setSelectedProductId(p.id);
                                    handleInputChange("insumo", p.name);

                                    // ✅ autopreenche unidade só se ainda estiver vazia
                                    if (p.unit && !String(formData.umd || "").trim()) {
                                      handleInputChange("umd", p.unit);
                                    }

                                    setProductOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProductId === p.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate">{p.name}</span>
                                    {p.category ? (
                                      <span className="text-xs text-muted-foreground truncate">
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
                        {selectedProduct.unit ? ` • Unidade: ${selectedProduct.unit}` : ""}
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
                      placeholder="Ex: kg, g, un"
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

                {/* Porcionamento */}
                {linhasPorcao.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Porcionamento: mesmo produto/unidade (travados). Só a quantidade muda.
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
                            <Input className="w-full min-w-0" value={formData.insumo} disabled readOnly />
                          </div>

                          <div className="min-w-0 md:col-span-3">
                            <Label>Quantidade *</Label>
                            <Input
                              type="number"
                              value={linha.qtd}
                              onChange={(e) => handleChangeLinhaQtd(linha.id, e.target.value)}
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

                          <div className="min-w-0 md:col-span-2">
                            <Label>Unidade</Label>
                            <Input className="w-full min-w-0" value={formData.umd} disabled readOnly />
                          </div>

                          <div className="min-w-0 md:col-span-1 md:flex md:items-end">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleRemoveLinha(linha.id)}
                              className="w-full md:w-auto"
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
                    onChange={(e) => handleInputChange("dataManip", e.target.value)}
                  />
                </div>

                <div className="min-w-0">
                  <Label>Data de Vencimento *</Label>
                  <Input
                    className="w-full min-w-0"
                    type="date"
                    value={formData.dataVenc}
                    onChange={(e) => handleInputChange("dataVenc", e.target.value)}
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
                  <h4 className="font-semibold text-green-800">Dados do Fabricante</h4>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="min-w-0">
                      <Label>Data de Fabricação</Label>
                      <Input
                        className="w-full min-w-0"
                        type="date"
                        value={formData.dataFabricante}
                        onChange={(e) => handleInputChange("dataFabricante", e.target.value)}
                      />
                    </div>

                    <div className="min-w-0">
                      <Label>Validade Original (Fabricante)</Label>
                      <Input
                        className="w-full min-w-0"
                        type="date"
                        value={formData.dataVencimento}
                        onChange={(e) => handleInputChange("dataVencimento", e.target.value)}
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
                        onChange={(e) => handleInputChange("loteFab", e.target.value)}
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
                  <Input className="w-full min-w-0" value={formData.responsavel} disabled readOnly />
                </div>

                <div className="min-w-0">
                  <Label>Alergênico</Label>
                  <Input
                    className="w-full min-w-0"
                    value={formData.alergenico}
                    onChange={(e) => handleInputChange("alergenico", e.target.value)}
                    placeholder="Ex: Contém leite"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <Label>Condições de Armazenamento</Label>
                <Input
                  className="w-full min-w-0"
                  value={formData.armazenamento}
                  onChange={(e) => handleInputChange("armazenamento", e.target.value)}
                  placeholder="Ex: Refrigerado 0-4°C"
                />
              </div>

              <div className="min-w-0">
                <Label>Ingredientes</Label>
                <Textarea
                  className="w-full min-w-0"
                  value={formData.ingredientes}
                  onChange={(e) => handleInputChange("ingredientes", e.target.value)}
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
                    onChange={(e) => handleInputChange("localEnvio", e.target.value)}
                    placeholder="Para onde será enviado"
                  />
                </div>
                <div className="min-w-0">
                  <Label>Local de Armazenamento</Label>
                  <Input
                    className="w-full min-w-0"
                    value={formData.localArmazenado}
                    onChange={(e) => handleInputChange("localArmazenado", e.target.value)}
                    placeholder="Onde está armazenado"
                  />
                </div>
              </div>

              {/* Ações */}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:space-x-2 sm:gap-0">
                <Button variant="outline" onClick={() => setShowNovaEtiqueta(false)}>
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
      )}
    </div>
  );
}
