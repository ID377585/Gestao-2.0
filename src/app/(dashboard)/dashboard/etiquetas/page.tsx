"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/* =========================
   ✅ MOCK USUÁRIO LOGADO
   - Trocar depois pelo nome real do auth
========================= */
const USUARIO_LOGADO_NOME = "Admin User";

// Interfaces
interface TipoEtiqueta {
  id: string;
  nome: "MANIPULACAO" | "REVALIDAR";
  descricao: string;
}

interface TamanhoEtiqueta {
  id: string;
  nome: string;
  largura: number;
  altura: number;
}

interface EtiquetaGerada {
  id: number;
  tipo: "MANIPULACAO" | "REVALIDAR";
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
  dataFabricante?: string;
  dataVencimento?: string;
  sif?: string;
  loteFab?: string;
  localEnvio?: string;
  localArmazenado?: string;
  createdAt: string; // ISO datetime
}

// ✅ Cadastro de Insumos (EXEMPLO / MOCK)
type UnidadeMedida = "kg" | "g" | "lt" | "ml" | "un" | "cx" | "pct";

interface InsumoCadastro {
  id: string;
  nome: string;
  umd: UnidadeMedida;
  shelfLifeDias: number;

  /* =========================
     ✅ NOVOS CAMPOS (AUTOPREENCHIMENTO)
  ========================= */
  alergenico?: string;
  armazenamento?: string;
  ingredientes?: string;
}

const insumosCadastroExemplo: InsumoCadastro[] = [
  {
    id: "ins-1",
    nome: "Cacau em pó",
    umd: "g",
    shelfLifeDias: 30,
    alergenico: "Não contém",
    armazenamento: "Local seco e fresco",
    ingredientes: "Cacau em pó 100%",
  },
  {
    id: "ins-2",
    nome: "Ricota fresca",
    umd: "kg",
    shelfLifeDias: 3,
    alergenico: "Contém leite",
    armazenamento: "Refrigeração 0-4°C",
    ingredientes: "Leite pasteurizado, fermento lácteo",
  },
  {
    id: "ins-3",
    nome: "Carne bovina",
    umd: "kg",
    shelfLifeDias: 2,
    alergenico: "Não contém",
    armazenamento: "Refrigeração 0-4°C",
    ingredientes: "Carne bovina",
  },
  {
    id: "ins-4",
    nome: "Farinha de trigo",
    umd: "kg",
    shelfLifeDias: 90,
    alergenico: "Contém glúten",
    armazenamento: "Local seco e arejado",
    ingredientes: "Farinha de trigo",
  },
  {
    id: "ins-5",
    nome: "Leite integral",
    umd: "lt",
    shelfLifeDias: 2,
    alergenico: "Contém leite",
    armazenamento: "Refrigeração 0-4°C",
    ingredientes: "Leite integral",
  },
];

// ✅ helpers de label (apenas visual)
type TipoSel = "MANIPULACAO" | "REVALIDAR";

const TIPO_LABEL: Record<TipoSel, string> = {
  MANIPULACAO: "MANIPULAÇÃO",
  REVALIDAR: "FABRICANTE",
};

const TIPO_LABEL_LONG: Record<TipoSel, string> = {
  MANIPULACAO: "MANIPULAÇÃO",
  REVALIDAR: "FABRICANTE",
};

// Dados de exemplo
const tiposEtiqueta: TipoEtiqueta[] = [
  { id: "1", nome: "MANIPULACAO", descricao: "Etiqueta de manipulação padrão" },
  { id: "2", nome: "REVALIDAR", descricao: "Etiqueta com dados do fabricante" },
];

const tamanhosEtiqueta: TamanhoEtiqueta[] = [
  { id: "1", nome: "Pequena", largura: 5.0, altura: 3.0 },
  { id: "2", nome: "Média", largura: 10.0, altura: 6.0 },
  { id: "3", nome: "Grande", largura: 15.0, altura: 10.0 },
];

const etiquetasGeradasExemplo: EtiquetaGerada[] = [
  {
    id: 1,
    tipo: "MANIPULACAO",
    tamanho: "Média",
    insumo: "Pão Francês",
    qtd: 50,
    umd: "un",
    dataManip: "2024-01-15",
    dataVenc: "2024-01-17",
    loteMan: "MAN240115001",
    responsavel: "João Silva",
    alergenico: "Glúten",
    armazenamento: "Temperatura ambiente",
    ingredientes: "Farinha, água, fermento, sal",
    localEnvio: "Padaria São João",
    localArmazenado: "Estoque Seco",
    createdAt: "2024-01-15T08:30:00",
  },
  {
    id: 2,
    tipo: "REVALIDAR",
    tamanho: "Grande",
    insumo: "Carne Bovina",
    qtd: 5,
    umd: "kg",
    dataManip: "2024-01-15",
    dataVenc: "2024-01-18",
    loteMan: "MAN240115002",
    responsavel: "Maria Santos",
    dataFabricante: "2024-01-10",
    dataVencimento: "2024-01-20",
    sif: "SIF 123",
    loteFab: "FAB240110001",
    alergenico: "Não contém",
    armazenamento: "Refrigeração 0-4°C",
    localEnvio: "Restaurante Bella Vista",
    localArmazenado: "Câmara Fria",
    createdAt: "2024-01-15T09:15:00",
  },
];

// ✅ datas helpers (ISO yyyy-mm-dd)
const getTodayISO = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const addDaysISO = (isoDate: string, days: number) => {
  if (!isoDate) return "";
  const base = new Date(isoDate + "T00:00:00");
  base.setDate(base.getDate() + days);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const isoToDDMMYY = (iso: string) => {
  // iso: yyyy-mm-dd
  if (!iso || iso.length < 10) return "";
  const yyyy = iso.slice(2, 4);
  const mm = iso.slice(5, 7);
  const dd = iso.slice(8, 10);
  return `${dd}${mm}${yyyy}`;
};

const removeAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const getInsumoCode2 = (nome: string) => {
  // regra simples e previsível: 2 primeiras letras do 1º termo (Cacau -> CA)
  const first = (nome || "").trim().split(/\s+/)[0] ?? "";
  const cleaned = removeAccents(first).toUpperCase();
  return cleaned.slice(0, 2) || "XX";
};

const getShelfLifeDiasByNome = (nome: string) => {
  const found = insumosCadastroExemplo.find(
    (i) => i.nome.toLowerCase() === (nome || "").toLowerCase()
  );
  return found?.shelfLifeDias ?? 0;
};

// ✅ Porcionamento: cada linha é uma etiqueta (mesmo produto/umd, qtd variável)
type LinhaPorcao = { id: string; qtd: string };
const makeLinhaId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

type LinhaErro = {
  baseQtd: boolean;
  porcoes: Record<string, boolean>;
};

/* =========================
   ✅ Inventário (Mock no front)
   - Lê QR (texto)
   - Bloqueia duplicado por sessão
   - Pop-up por 3s
========================= */
type InventarioItem = {
  key: string; // chave única (ex.: produto + qtd + umd)
  payload: any;
  scannedAt: string;
};

export default function EtiquetasPage() {
  // ✅ AGORA É MUTÁVEL (para entrar no histórico e atualizar cards)
  const [etiquetasGeradas, setEtiquetasGeradas] = useState<EtiquetaGerada[]>(
    etiquetasGeradasExemplo
  );

  const [showNovaEtiqueta, setShowNovaEtiqueta] = useState(false);

  const [tipoSelecionado, setTipoSelecionado] =
    useState<TipoSel>("MANIPULACAO");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("");

  const defaultForm = useMemo(
    () => ({
      insumo: "",
      qtd: "",
      umd: "" as UnidadeMedida | "",
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
      localEnvio: "",
      localArmazenado: "",
    }),
    []
  );

  const [formData, setFormData] = useState(defaultForm);
  const [linhasPorcao, setLinhasPorcao] = useState<LinhaPorcao[]>([]);

  // ✅ ERROS (borda vermelha quando vazio)
  const [erros, setErros] = useState<LinhaErro>({ baseQtd: false, porcoes: {} });

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("pt-BR");
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleString("pt-BR");
  };

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // ✅ quando abre o modal: reseta form + seta hoje + zera porções + zera erros
  useEffect(() => {
    if (showNovaEtiqueta) {
      const hojeISO = getTodayISO();
      setFormData({
        ...defaultForm,
        dataManip: hojeISO,
        responsavel: USUARIO_LOGADO_NOME,
      });
      setTamanhoSelecionado("");
      setLinhasPorcao([]);
      setErros({ baseQtd: false, porcoes: {} });
    }
  }, [showNovaEtiqueta, defaultForm]);

  // ✅ quando seleciona um insumo: preenche UMD + calcula vencimento usando shelfLifeDias
  // ✅ + AUTOPREENCHIMENTO: alergenico, armazenamento, ingredientes
  const handleSelectInsumo = (insumoId: string) => {
    const insumo = insumosCadastroExemplo.find((i) => i.id === insumoId);
    const hojeISO = getTodayISO();

    if (!insumo) {
      setFormData((prev) => ({
        ...prev,
        insumo: "",
        umd: "",
        dataManip: hojeISO,
        dataVenc: "",
        responsavel: USUARIO_LOGADO_NOME,
        alergenico: "",
        armazenamento: "",
        ingredientes: "",
      }));
      setLinhasPorcao([]);
      return;
    }

    const vencISO = addDaysISO(hojeISO, insumo.shelfLifeDias);

    setFormData((prev) => ({
      ...prev,
      insumo: insumo.nome,
      umd: insumo.umd,
      dataManip: hojeISO,
      dataVenc: vencISO,

      // ✅ bloqueados (auto)
      responsavel: USUARIO_LOGADO_NOME,
      alergenico: insumo.alergenico || "",
      armazenamento: insumo.armazenamento || "",
      ingredientes: insumo.ingredientes || "",
    }));
  };

  const selectedInsumoId = useMemo(() => {
    const found = insumosCadastroExemplo.find((i) => i.nome === formData.insumo);
    return found?.id ?? "";
  }, [formData.insumo]);

  const handleAddLinha = () => {
    if (!formData.insumo || !formData.umd) return;
    setLinhasPorcao((prev) => [...prev, { id: makeLinhaId(), qtd: "" }]);
  };

  const handleRemoveLinha = (id: string) => {
    setLinhasPorcao((prev) => prev.filter((l) => l.id !== id));
    setErros((prev) => {
      const next = { ...prev, porcoes: { ...prev.porcoes } };
      delete next.porcoes[id];
      return next;
    });
  };

  const handleChangeLinhaQtd = (id: string, qtd: string) => {
    setLinhasPorcao((prev) =>
      prev.map((l) => (l.id === id ? { ...l, qtd } : l))
    );
    // se digitou algo, já remove o erro daquela linha
    setErros((prev) => ({
      ...prev,
      porcoes: { ...prev.porcoes, [id]: false },
    }));
  };

  // ✅ LOTE no padrão: IE-CA-161225-30D
  const gerarLoteVigilancia = () => {
    const ie = "IE"; // Ivan Escobar
    const cod = getInsumoCode2(formData.insumo);
    const dt = isoToDDMMYY(formData.dataManip);
    const shelf = getShelfLifeDiasByNome(formData.insumo);
    const shelfPart = `${shelf}D`;
    return `${ie}-${cod}-${dt}-${shelfPart}`;
  };

  /* =========================
     ✅ QR PAYLOAD (MÍNIMO)
     - produto, quantidade e unidade
     - ideal para inventário/contagem
  ========================= */
  const buildQrPayloadFromEtiqueta = (e: EtiquetaGerada) => {
    // ✅ Payload MÍNIMO para QR (para inventário/contagem)
    // Contém apenas: produto, quantidade e unidade de medida
    // Mantém versão para evoluções futuras sem quebrar leitor
    const payload = {
      v: 1,
      p: e.insumo, // produto
      q: e.qtd, // quantidade
      u: e.umd, // unidade
    };

    // remove acentos para reduzir risco de leitor “quebrar”
    const json = JSON.stringify(payload);
    return removeAccents(json);
  };

  /* =========================
     ✅ QR IMAGE (offline / local)
     - Gera PNG (dataURL) sem depender de internet
     - Evita QR "quebrado" no print (img externo bloqueado)
  ========================= */
  const makeQrDataUrl = async (text: string) => {
    // largura alta melhora leitura em 203dpi
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 220,
    });
  };

  /* =========================
     ✅ Impressão "local" via diálogo do navegador
     ✅ AJUSTES:
       - Remove título "MANIPULAÇÃO/FABRICANTE" da impressão
       - QR Code à esquerda com payload mínimo (produto/qtd/umd)
       - Layout 104mm x 50,8mm (Zebra ZD220)
  ========================= */
  const imprimirBatchNoBrowser = async (etqs: EtiquetaGerada[]) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;

    const LABEL_W_MM = 104;
    const LABEL_H_MM = 50.8;

    // ✅ Gera QR local (dataURL) para cada etiqueta (sem internet)
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

    // ✅ monta páginas com QR (LOCAL dataURL)
    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Impressão de Etiquetas</title>
  <style>
    @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }

    html, body {
      width: ${LABEL_W_MM}mm;
      height: ${LABEL_H_MM}mm;
      margin: 0;
      padding: 0;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-family: Arial, Helvetica, sans-serif;
    }

    .page {
      width: ${LABEL_W_MM}mm;
      height: ${LABEL_H_MM}mm;
      page-break-after: always;
      break-after: page;
      box-sizing: border-box;
      padding: 2.6mm 3.2mm; /* margem interna */
      display: flex;
      align-items: stretch;
      justify-content: stretch;
    }

    .label {
      width: 100%;
      height: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* ✅ layout horizontal (QR à esquerda + info à direita) */
    .main {
      display: flex;
      flex: 1;
      gap: 2.5mm;
      align-items: stretch;
    }

    .qrBox {
      width: 24mm;     /* largura fixa do QR */
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
      html, body {
        width: ${LABEL_W_MM}mm;
        height: ${LABEL_H_MM}mm;
        margin: 0 !important;
        padding: 0 !important;
      }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${etqs
    .map((e) => {
      const isFab = e.tipo === "REVALIDAR";
      const extraFab = isFab ? buildExtraFab(e) : "";

      return `
        <div class="page">
          <div class="label">
            <div class="main">
              <div class="qrBox">
                <img class="qrImg" alt="QR"
                  src="__QR_SRC__"
                />
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
    })
    .join("")}
  <script>
    window.onload = () => {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`;

    // ✅ Recria o body substituindo o QR de cada etiqueta corretamente (dataURL)
    const parts: string[] = [];
    const beforeBody = html.split("</body>")[0];
    const afterBody = "</body></html>";

    const head = beforeBody.split("<body>")[0] + "<body>\n";
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

    parts.push(`
      <script>
        window.onload = () => {
          window.focus();
          window.print();
        };
      </script>
    `);

    parts.push(afterBody);

    const finalHtml = parts.join("\n");

    w.document.open();
    w.document.write(finalHtml);
    w.document.close();
  };

  // ✅ validação de quantidades (destaca vazias)
  const validarQuantidades = () => {
    const baseVazia = !String(formData.qtd || "").trim();
    const porcoesErros: Record<string, boolean> = {};

    for (const l of linhasPorcao) {
      const vazia = !String(l.qtd || "").trim();
      if (vazia) porcoesErros[l.id] = true;
    }

    setErros({ baseQtd: baseVazia, porcoes: porcoesErros });

    return !(baseVazia || Object.keys(porcoesErros).length > 0);
  };

  const handleGerarEImprimir = async () => {
    // 1) valida tudo
    const ok = validarQuantidades();
    if (!ok) return;

    // 2) lote único (SEM -01 / -02) para todas as etiquetas do mesmo porcionamento
    const lote = gerarLoteVigilancia();

    // 3) cria registros (histórico) + imprime todas
    const nowISO = new Date().toISOString();

    const qtds = [
      { id: "base", qtd: formData.qtd },
      ...linhasPorcao.map((l) => ({ id: l.id, qtd: l.qtd })),
    ]
      .map((x) => String(x.qtd ?? "").trim())
      .filter((v) => v.length > 0);

    const lastId =
      etiquetasGeradas.length > 0
        ? Math.max(...etiquetasGeradas.map((e) => e.id))
        : 0;

    const novas: EtiquetaGerada[] = qtds.map((qtdStr, idx) => ({
      id: lastId + idx + 1,
      tipo: tipoSelecionado,
      tamanho: tamanhoSelecionado,
      insumo: formData.insumo,
      qtd: Number(qtdStr),
      umd: String(formData.umd || ""),
      dataManip: formData.dataManip,
      dataVenc: formData.dataVenc,
      loteMan: lote,
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
    }));

    // 4) atualiza histórico + cards (state)
    setEtiquetasGeradas((prev) => [...novas, ...prev]); // mais recente em cima

    // 5) imprime no browser (Chrome > Salvar como PDF)
    await imprimirBatchNoBrowser(novas);

    // 6) fecha modal
    setShowNovaEtiqueta(false);
  };

  const tiposVisiveis = useMemo(
    () => tiposEtiqueta.filter((t) => t.nome === "MANIPULACAO"),
    []
  );

  // ✅ "HOJE" dinâmico
  const hojeISO = useMemo(() => getTodayISO(), []);
  const etiquetasHoje = useMemo(
    () =>
      etiquetasGeradas.filter((e) => (e.createdAt || "").startsWith(hojeISO))
        .length,
    [etiquetasGeradas, hojeISO]
  );

  /* =========================
     ✅ Inventário (UI mock)
  ========================= */
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

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg("");
    }, 3000);
  };

  const iniciarInventario = () => {
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
  };

  const finalizarInventario = () => {
    setInventarioAtivo(false);
    // não precisa limpar imediatamente, mas por regra você quer liberar no próximo inventário
    setInventarioId("");
    setInventarioItens([]);
    setInventarioScannedKeys({});
    setQrInput("");
    showToast("Inventário finalizado!");
  };

  const parseQrPayload = (raw: string) => {
    // Leitor normalmente retorna exatamente o JSON
    // Se vier com espaços/linhas, normaliza:
    const cleaned = String(raw || "").trim();
    if (!cleaned) return null;

    try {
      const obj = JSON.parse(cleaned);
      return obj;
    } catch {
      return null;
    }
  };

  const makeInventarioKey = (payload: any) => {
    // ✅ chave de unicidade por inventário (mínima):
    // produto + quantidade + unidade
    const p = String(payload?.p || payload?.ins || payload?.insumo || "");
    const q = String(payload?.q || payload?.qtd || "");
    const u = String(payload?.u || payload?.umd || "");
    return `${p}__${q}__${u}`;
  };

  const registrarLeituraInventario = (payload: any) => {
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

    // ✅ Aqui no futuro você chama Firestore/DB:
    // await saveInventarioLeitura(inventarioId, payload)
    // ou atualizar estoque etc.
  };

  const handleQrSubmit = () => {
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

    // limpa campo para próxima leitura
    setQrInput("");
    setTimeout(() => qrInputRef.current?.focus(), 10);
  };

  return (
    <div className="space-y-6">
      {/* ✅ Toast (pop-up chamativo 3s) */}
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
          <h1 className="text-3xl font-bold text-gray-900">
            Sistema de Etiquetas
          </h1>
          <p className="text-gray-600">
            Impressão térmica de etiquetas de manipulação
          </p>
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

      {/* ✅ Inventário (Novo) */}
      <Card>
        <CardHeader>
          <CardTitle>Inventário / Contagem por QR Code</CardTitle>
          <CardDescription>
            Cada etiqueta pode ser lida apenas 1 vez por inventário. Ao finalizar,
            a contagem reinicia para permitir nova leitura no próximo inventário.
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
                placeholder='Ex.: {"v":1,"p":"...","q":1,"u":"kg"}'
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
                        {it.payload?.p || it.payload?.ins || "-"}
                      </TableCell>
                      <TableCell>
                        {String(it.payload?.q ?? "-")}{" "}
                        {String(it.payload?.u ?? "")}
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

      {/* Stats Cards */}
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

      {/* Tipos de Etiqueta (✅ agora só MANIPULACAO) */}
      <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
        {tiposVisiveis.map((tipo) => (
          <Card key={tipo.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center">
                <span className="mr-2">📝</span>
                {TIPO_LABEL_LONG[tipo.nome as TipoSel]}
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
                Criar Etiqueta {TIPO_LABEL[tipo.nome as TipoSel]}
              </Button>

              <div className="mt-3 text-xs text-muted-foreground">
                Precisa de dados do fabricante? Abra “Nova Etiqueta” e selecione{" "}
                <strong>{TIPO_LABEL.REVALIDAR}</strong> no formulário.
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Histórico de Etiquetas */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Etiquetas Geradas</CardTitle>
          <CardDescription>
            Todas as etiquetas geradas com opção de reimpressão
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              {etiquetasGeradas.map((etiqueta) => (
                <TableRow key={etiqueta.id}>
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
                  <TableCell className="font-mono text-sm">
                    {etiqueta.loteMan}
                  </TableCell>
                  <TableCell>{etiqueta.responsavel}</TableCell>
                  <TableCell>{formatDateTime(etiqueta.createdAt)}</TableCell>
                  <TableCell>{formatDate(etiqueta.dataVenc)}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <p>
                        <strong>Envio:</strong> {etiqueta.localEnvio || "-"}
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
                        onClick={() => {
                          void imprimirBatchNoBrowser([etiqueta]);
                        }}
                      >
                        🖨️
                      </Button>
                      <Button size="sm" variant="outline">
                        👁️
                      </Button>
                      <Button size="sm" variant="outline">
                        📋
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Nova Etiqueta */}
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
              {/* =========================
                  ✅ AJUSTE MOBILE:
                  - mobile: 1 coluna
                  - md+: 2 colunas
                  - min-w-0 / w-full para evitar esmagar e “sobrepor”
              ========================== */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <Label>Tipo de Etiqueta</Label>
                  <Select
                    value={tipoSelecionado}
                    onValueChange={(value: TipoSel) => setTipoSelecionado(value)}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Selecionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANIPULACAO">MANIPULAÇÃO</SelectItem>
                      <SelectItem value="REVALIDAR">FABRICANTE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="min-w-0">
                  <Label>Tamanho da Etiqueta</Label>
                  <Select
                    value={tamanhoSelecionado}
                    onValueChange={setTamanhoSelecionado}
                  >
                    <SelectTrigger className="w-full min-w-0">
                      <SelectValue placeholder="Selecionar tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      {tamanhosEtiqueta.map((tamanho) => (
                        <SelectItem key={tamanho.id} value={tamanho.nome}>
                          {tamanho.nome} ({tamanho.largura}×{tamanho.altura}cm)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ✅ LINHA BASE + BOTÃO Add + (mobile: coluna / md+: linha) */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:items-end">
                  {/* Insumo */}
                  <div className="min-w-0 md:col-span-6">
                    <Label>Insumo/Produto *</Label>
                    <Select
                      value={selectedInsumoId}
                      onValueChange={(insumoId) => handleSelectInsumo(insumoId)}
                    >
                      <SelectTrigger className="w-full min-w-0">
                        <SelectValue placeholder="Selecionar insumo" />
                      </SelectTrigger>
                      <SelectContent>
                        {insumosCadastroExemplo.map((ins) => (
                          <SelectItem key={ins.id} value={ins.id}>
                            {ins.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Quantidade */}
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

                  {/* Unidade */}
                  <div className="min-w-0 md:col-span-2">
                    <Label>Unidade *</Label>
                    <Input className="w-full min-w-0" value={formData.umd} disabled readOnly />
                  </div>

                  {/* Add */}
                  <div className="min-w-0 md:col-span-1 md:flex md:items-end">
                    <Button
                      type="button"
                      onClick={handleAddLinha}
                      disabled={!formData.insumo || !formData.umd}
                      className="w-full md:w-auto"
                    >
                      Add +
                    </Button>
                  </div>
                </div>

                {/* ✅ LINHAS EXTRAS */}
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
                          {/* Insumo */}
                          <div className="min-w-0 md:col-span-6">
                            <Label>Insumo/Produto</Label>
                            <Input className="w-full min-w-0" value={formData.insumo} disabled readOnly />
                          </div>

                          {/* Quantidade */}
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

                          {/* Unidade */}
                          <div className="min-w-0 md:col-span-2">
                            <Label>Unidade</Label>
                            <Input className="w-full min-w-0" value={formData.umd} disabled readOnly />
                          </div>

                          {/* Remover */}
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

              {/* Datas (mobile 1 col / md 2 col) */}
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
              {formData.insumo && formData.dataManip && (
                <div className="p-3 bg-gray-50 rounded border">
                  <div className="text-sm">
                    <strong>Lote (automático):</strong>{" "}
                    <span className="font-mono">{gerarLoteVigilancia()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Formato: IE-XX-DDMMAA-##D
                  </p>
                </div>
              )}

              {/* Campos Específicos para REVALIDAR */}
              {tipoSelecionado === "REVALIDAR" && (
                <div className="p-4 bg-green-50 rounded-lg space-y-4">
                  <h4 className="font-semibold text-green-800">
                    Dados do Fabricante
                  </h4>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

              {/* Informações Adicionais */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="min-w-0">
                  <Label>Responsável *</Label>
                  <Input className="w-full min-w-0" value={formData.responsavel} disabled readOnly />
                </div>

                <div className="min-w-0">
                  <Label>Alergênico</Label>
                  <Input className="w-full min-w-0" value={formData.alergenico} disabled readOnly />
                </div>
              </div>

              <div className="min-w-0">
                <Label>Condições de Armazenamento</Label>
                <Input className="w-full min-w-0" value={formData.armazenamento} disabled readOnly />
              </div>

              <div className="min-w-0">
                <Label>Ingredientes</Label>
                <Textarea
                  className="w-full min-w-0"
                  value={formData.ingredientes}
                  disabled
                  readOnly
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
                    !tipoSelecionado || !tamanhoSelecionado || !formData.insumo
                  }
                >
                  <span className="mr-2">🖨️</span>
                  Gerar e Imprimir Etiqueta(s)
                </Button>
              </div>

              <div className="text-xs text-muted-foreground">
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
