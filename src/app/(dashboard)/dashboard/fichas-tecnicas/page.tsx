"use client";

import { useEffect, useMemo, useState } from "react";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ProductOption = {
  id: string;
  name: string;
  price?: number | null;
  default_unit_label?: string | null;
  sector_category?: string | null;
};

type Ingrediente = {
  id: string;
  productId: string | null;
  nome: string;
  quantidadeUso: number;
  unidadeUso: string;
  precoCompra: number;
  quantidadeCompra: number;
  unidadeCompra: string;
  custoUnitarioBase: number;
  custoIngrediente: number;
  fatorCorrecao: number;
  fatorCoccao: number;
};

type FichaTecnica = {
  id: string;
  nome: string;
  categoria: string;
  rendimento: number;
  pesoPorcao: number;
  tempoPreparo: number;
  custoTotal: number;
  custoPorPorcao: number;
  margemLucro: number;
  precoVenda: number;
  modoPreparo: string;
  ingredientes: Ingrediente[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "gestify:fichas-tecnicas:v2";

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

function calcularCMV(custoPorPorcao: number, precoVenda: number) {
  if (!precoVenda || precoVenda <= 0) return 0;
  return (custoPorPorcao / precoVenda) * 100;
}

function calcularLucroUnitario(precoVenda: number, custoPorPorcao: number) {
  return (precoVenda || 0) - (custoPorPorcao || 0);
}

function calcularCustos(
  ingredientes: Ingrediente[],
  rendimento: number,
  margemLucro: number
) {
  const custoTotal = ingredientes.reduce(
    (acc, item) => acc + (item.custoIngrediente || 0),
    0
  );

  const custoPorPorcao =
    rendimento > 0 ? Number((custoTotal / rendimento).toFixed(2)) : 0;

  const precoVenda =
    margemLucro >= 0
      ? Number((custoPorPorcao * (1 + margemLucro / 100)).toFixed(2))
      : 0;

  return {
    custoTotal: Number(custoTotal.toFixed(2)),
    custoPorPorcao,
    precoVenda,
  };
}

function loadSavedFichas(): FichaTecnica[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveFichas(data: FichaTecnica[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeCsv(val: unknown) {
  const s = String(val ?? "");
  if (/[",;\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function calcularCustoIngrediente(input: {
  quantidadeUso: number;
  precoCompra: number;
  quantidadeCompra: number;
  fatorCorrecao: number;
  fatorCoccao: number;
}) {
  const quantidadeUso = toNumber(input.quantidadeUso, 0);
  const precoCompra = toNumber(input.precoCompra, 0);
  const quantidadeCompra = toNumber(input.quantidadeCompra, 0);
  const fatorCorrecao = toNumber(input.fatorCorrecao, 1) || 1;
  const fatorCoccao = toNumber(input.fatorCoccao, 1) || 1;

  if (quantidadeCompra <= 0 || quantidadeUso <= 0) {
    return {
      custoUnitarioBase: 0,
      custoIngrediente: 0,
    };
  }

  const custoUnitarioBase = precoCompra / quantidadeCompra;
  const custoIngrediente =
    quantidadeUso * custoUnitarioBase * fatorCorrecao * fatorCoccao;

  return {
    custoUnitarioBase: Number(custoUnitarioBase.toFixed(6)),
    custoIngrediente: Number(custoIngrediente.toFixed(2)),
  };
}

export default function FichasTecnicasPage() {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [fichasTecnicas, setFichasTecnicas] = useState<FichaTecnica[]>([]);
  const [fichaSelecionada, setFichaSelecionada] = useState<FichaTecnica | null>(
    null
  );

  const [showNovaFicha, setShowNovaFicha] = useState(false);
  const [showEditarFicha, setShowEditarFicha] = useState(false);
  const [fichaEditando, setFichaEditando] = useState<FichaTecnica | null>(null);

  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState("");
  const [rendimento, setRendimento] = useState<number>(1);
  const [pesoPorcao, setPesoPorcao] = useState<number>(0);
  const [tempoPreparo, setTempoPreparo] = useState<number>(0);
  const [margemLucro, setMargemLucro] = useState<number>(200);
  const [modoPreparo, setModoPreparo] = useState("");

  const [ingredientes, setIngredientes] = useState<Ingrediente[]>([]);
  const [editandoIngredienteId, setEditandoIngredienteId] = useState<string | null>(null);

  const [draftIngredienteId, setDraftIngredienteId] = useState("");
  const [draftIngredienteNome, setDraftIngredienteNome] = useState("");
  const [draftQuantidadeUso, setDraftQuantidadeUso] = useState<number>(0);
  const [draftUnidadeUso, setDraftUnidadeUso] = useState("UN");
  const [draftPrecoCompra, setDraftPrecoCompra] = useState<number>(0);
  const [draftQuantidadeCompra, setDraftQuantidadeCompra] = useState<number>(1);
  const [draftUnidadeCompra, setDraftUnidadeCompra] = useState("UN");
  const [draftFCorrecao, setDraftFCorrecao] = useState<number>(1);
  const [draftFCoccao, setDraftFCoccao] = useState<number>(1);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        setLoadingProducts(true);
        const res = await fetch("/api/products", { cache: "no-store" });

        if (!res.ok) {
          throw new Error("Falha ao carregar produtos.");
        }

        const data = await res.json();
        const normalized = Array.isArray(data)
          ? data.map((p: any) => ({
              id: String(p.id),
              name: String(p.name ?? ""),
              price: Number(p.price ?? 0),
              default_unit_label: p.default_unit_label ?? "UN",
              sector_category: p.sector_category ?? p.category ?? "",
            }))
          : [];

        setProducts(normalized);
      } catch (err) {
        console.error("Erro ao carregar produtos para fichas técnicas:", err);
        setProducts([]);
      } finally {
        setLoadingProducts(false);
      }

      const saved = loadSavedFichas();
      setFichasTecnicas(saved);
    };

    bootstrap();
  }, []);

  useEffect(() => {
    saveFichas(fichasTecnicas);
  }, [fichasTecnicas]);

  const custoMedio = useMemo(() => {
    if (!fichasTecnicas.length) return 0;
    return (
      fichasTecnicas.reduce((acc, f) => acc + f.custoPorPorcao, 0) /
      fichasTecnicas.length
    );
  }, [fichasTecnicas]);

  const cmvMedio = useMemo(() => {
    if (!fichasTecnicas.length) return 0;
    return (
      fichasTecnicas.reduce(
        (acc, f) => acc + calcularCMV(f.custoPorPorcao, f.precoVenda),
        0
      ) / fichasTecnicas.length
    );
  }, [fichasTecnicas]);

  const margemMedia = useMemo(() => {
    if (!fichasTecnicas.length) return 0;
    return (
      fichasTecnicas.reduce((acc, f) => acc + f.margemLucro, 0) /
      fichasTecnicas.length
    );
  }, [fichasTecnicas]);

  const previewIngrediente = useMemo(() => {
    return calcularCustoIngrediente({
      quantidadeUso: draftQuantidadeUso,
      precoCompra: draftPrecoCompra,
      quantidadeCompra: draftQuantidadeCompra,
      fatorCorrecao: draftFCorrecao,
      fatorCoccao: draftFCoccao,
    });
  }, [
    draftQuantidadeUso,
    draftPrecoCompra,
    draftQuantidadeCompra,
    draftFCorrecao,
    draftFCoccao,
  ]);

  const resetDraftIngrediente = () => {
    setEditandoIngredienteId(null);
    setDraftIngredienteId("");
    setDraftIngredienteNome("");
    setDraftQuantidadeUso(0);
    setDraftUnidadeUso("UN");
    setDraftPrecoCompra(0);
    setDraftQuantidadeCompra(1);
    setDraftUnidadeCompra("UN");
    setDraftFCorrecao(1);
    setDraftFCoccao(1);
  };

  const resetForm = () => {
    setNome("");
    setCategoria("");
    setRendimento(1);
    setPesoPorcao(0);
    setTempoPreparo(0);
    setMargemLucro(200);
    setModoPreparo("");
    setIngredientes([]);
    resetDraftIngrediente();
  };

  const onSelectProductIngredient = (productId: string) => {
    setDraftIngredienteId(productId);

    const p = products.find((item) => item.id === productId);
    if (!p) return;

    const unit = String(p.default_unit_label || "UN").toUpperCase();

    setDraftIngredienteNome(p.name);
    setDraftUnidadeUso(unit);
    setDraftUnidadeCompra(unit);
    setDraftPrecoCompra(Number(p.price ?? 0));
    setDraftQuantidadeCompra(1);
  };

  const salvarIngrediente = () => {
    const quantidadeUso = toNumber(draftQuantidadeUso, 0);
    const precoCompra = toNumber(draftPrecoCompra, 0);
    const quantidadeCompra = toNumber(draftQuantidadeCompra, 0);
    const fatorCorrecao = toNumber(draftFCorrecao, 1) || 1;
    const fatorCoccao = toNumber(draftFCoccao, 1) || 1;

    if (!draftIngredienteNome.trim()) {
      alert("Selecione ou informe um ingrediente.");
      return;
    }

    if (quantidadeUso <= 0) {
      alert("Informe uma quantidade de uso válida.");
      return;
    }

    if (quantidadeCompra <= 0) {
      alert("Informe uma quantidade de compra válida.");
      return;
    }

    const calculo = calcularCustoIngrediente({
      quantidadeUso,
      precoCompra,
      quantidadeCompra,
      fatorCorrecao,
      fatorCoccao,
    });

    const payload: Ingrediente = {
      id: editandoIngredienteId || uid(),
      productId: draftIngredienteId || null,
      nome: draftIngredienteNome.trim(),
      quantidadeUso,
      unidadeUso: String(draftUnidadeUso || "UN").toUpperCase(),
      precoCompra,
      quantidadeCompra,
      unidadeCompra: String(draftUnidadeCompra || "UN").toUpperCase(),
      custoUnitarioBase: calculo.custoUnitarioBase,
      custoIngrediente: calculo.custoIngrediente,
      fatorCorrecao,
      fatorCoccao,
    };

    if (editandoIngredienteId) {
      setIngredientes((prev) =>
        prev.map((item) => (item.id === editandoIngredienteId ? payload : item))
      );
    } else {
      setIngredientes((prev) => [...prev, payload]);
    }

    resetDraftIngrediente();
  };

  const editarIngrediente = (id: string) => {
    const item = ingredientes.find((ing) => ing.id === id);
    if (!item) return;

    setEditandoIngredienteId(item.id);
    setDraftIngredienteId(item.productId || "");
    setDraftIngredienteNome(item.nome);
    setDraftQuantidadeUso(item.quantidadeUso);
    setDraftUnidadeUso(item.unidadeUso);
    setDraftPrecoCompra(item.precoCompra);
    setDraftQuantidadeCompra(item.quantidadeCompra);
    setDraftUnidadeCompra(item.unidadeCompra);
    setDraftFCorrecao(item.fatorCorrecao);
    setDraftFCoccao(item.fatorCoccao);
  };

  const removerIngrediente = (id: string) => {
    setIngredientes((prev) => prev.filter((item) => item.id !== id));
    if (editandoIngredienteId === id) {
      resetDraftIngrediente();
    }
  };

  const salvarNovaFicha = () => {
    if (!nome.trim()) {
      alert("Informe o nome da receita.");
      return;
    }

    if (!categoria.trim()) {
      alert("Informe a categoria.");
      return;
    }

    if (rendimento <= 0) {
      alert("Informe um rendimento válido.");
      return;
    }

    if (ingredientes.length === 0) {
      alert("Adicione pelo menos um ingrediente.");
      return;
    }

    const custos = calcularCustos(ingredientes, rendimento, margemLucro);

    const novaFicha: FichaTecnica = {
      id: uid(),
      nome: nome.trim(),
      categoria: categoria.trim(),
      rendimento: toNumber(rendimento, 1),
      pesoPorcao: toNumber(pesoPorcao, 0),
      tempoPreparo: toNumber(tempoPreparo, 0),
      custoTotal: custos.custoTotal,
      custoPorPorcao: custos.custoPorPorcao,
      margemLucro: toNumber(margemLucro, 0),
      precoVenda: custos.precoVenda,
      modoPreparo: modoPreparo.trim(),
      ingredientes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setFichasTecnicas((prev) => [novaFicha, ...prev]);
    setShowNovaFicha(false);
    resetForm();
  };

  const handleEditarFicha = (ficha: FichaTecnica) => {
    setFichaEditando(ficha);
    setShowEditarFicha(true);
  };

  const salvarEdicaoFicha = () => {
    if (!fichaEditando) return;

    const custos = calcularCustos(
      fichaEditando.ingredientes,
      fichaEditando.rendimento,
      fichaEditando.margemLucro
    );

    const atualizada: FichaTecnica = {
      ...fichaEditando,
      custoTotal: custos.custoTotal,
      custoPorPorcao: custos.custoPorPorcao,
      precoVenda: custos.precoVenda,
      updatedAt: new Date().toISOString(),
    };

    setFichasTecnicas((prev) =>
      prev.map((f) => (f.id === atualizada.id ? atualizada : f))
    );
    setFichaEditando(null);
    setShowEditarFicha(false);
  };

  const excluirFicha = (id: string) => {
    if (!confirm("Deseja realmente excluir esta ficha técnica?")) return;
    setFichasTecnicas((prev) => prev.filter((f) => f.id !== id));
  };

  const exportarRelatorioCustos = () => {
    if (!fichasTecnicas.length) {
      alert("Nenhuma ficha técnica cadastrada para exportar.");
      return;
    }

    const headers = [
      "nome",
      "categoria",
      "rendimento",
      "peso_por_porcao",
      "tempo_preparo",
      "custo_total",
      "custo_por_porcao",
      "preco_venda",
      "cmv",
      "margem_lucro",
      "lucro_unitario",
      "ingredientes",
    ];

    const lines = [headers.join(";")];

    fichasTecnicas.forEach((ficha) => {
      const row = [
        escapeCsv(ficha.nome),
        escapeCsv(ficha.categoria),
        escapeCsv(ficha.rendimento),
        escapeCsv(ficha.pesoPorcao),
        escapeCsv(ficha.tempoPreparo),
        escapeCsv(ficha.custoTotal.toFixed(2)),
        escapeCsv(ficha.custoPorPorcao.toFixed(2)),
        escapeCsv(ficha.precoVenda.toFixed(2)),
        escapeCsv(calcularCMV(ficha.custoPorPorcao, ficha.precoVenda).toFixed(1)),
        escapeCsv(ficha.margemLucro.toFixed(0)),
        escapeCsv(
          calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao).toFixed(2)
        ),
        escapeCsv(ficha.ingredientes.length),
      ];

      lines.push(row.join(";"));
    });

    const csvContent = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relatorio_fichas_tecnicas.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleImprimirFicha = (ficha: FichaTecnica) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Impressão - ${ficha.nome}</title>
<style>
  body{ font-family: Arial, sans-serif; padding: 24px; }
  h1{ margin: 0 0 6px 0; font-size: 22px; }
  .muted{ color:#555; margin:0 0 16px 0; }
  .grid{ display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .box{ border:1px solid #ddd; border-radius: 10px; padding: 10px; }
  .label{ font-size: 12px; color:#666; margin-bottom: 4px; }
  .value{ font-size: 14px; font-weight: 600; }
  table{ width: 100%; border-collapse: collapse; margin-top: 10px; }
  th,td{ border:1px solid #ddd; padding: 8px; font-size: 12px; }
  th{ background:#f5f5f5; text-align:left; }
  .right{ text-align:right; }
  @media print { body{ padding:0; } }
</style>
</head>
<body>
  <h1>${ficha.nome}</h1>
  <p class="muted">${ficha.categoria}</p>

  <div class="grid">
    <div class="box"><div class="label">Rendimento</div><div class="value">${ficha.rendimento} porções</div></div>
    <div class="box"><div class="label">Peso por porção</div><div class="value">${ficha.pesoPorcao} g</div></div>
    <div class="box"><div class="label">Tempo</div><div class="value">${ficha.tempoPreparo} min</div></div>
    <div class="box"><div class="label">Preço de venda</div><div class="value">${formatCurrency(ficha.precoVenda)}</div></div>
  </div>

  <div class="grid">
    <div class="box"><div class="label">Custo total</div><div class="value">${formatCurrency(ficha.custoTotal)}</div></div>
    <div class="box"><div class="label">Custo por porção</div><div class="value">${formatCurrency(ficha.custoPorPorcao)}</div></div>
    <div class="box"><div class="label">CMV</div><div class="value">${calcularCMV(
      ficha.custoPorPorcao,
      ficha.precoVenda
    ).toFixed(1)}%</div></div>
    <div class="box"><div class="label">Lucro unitário</div><div class="value">${formatCurrency(
      calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao)
    )}</div></div>
  </div>

  <h2 style="font-size:16px;margin:18px 0 8px 0;">Ingredientes</h2>
  <table>
    <thead>
      <tr>
        <th>Ingrediente</th>
        <th>Uso</th>
        <th>Compra</th>
        <th class="right">Preço Compra</th>
        <th class="right">Custo Unit.</th>
        <th class="right">Custo Final</th>
      </tr>
    </thead>
    <tbody>
      ${ficha.ingredientes
        .map(
          (i) => `
        <tr>
          <td>${i.nome}</td>
          <td>${i.quantidadeUso} ${i.unidadeUso}</td>
          <td>${i.quantidadeCompra} ${i.unidadeCompra}</td>
          <td class="right">${formatCurrency(i.precoCompra)}</td>
          <td class="right">${formatCurrency(i.custoUnitarioBase)}</td>
          <td class="right">${formatCurrency(i.custoIngrediente)}</td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <script>
    window.onload = () => {
      window.focus();
      window.print();
    }
  </script>
</body>
</html>
    `.trim();

    const w = window.open("", "_blank", "noopener,noreferrer,width=1000,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fichas Técnicas</h1>
          <p className="text-gray-600">
            Receitas com cálculo automático de custos, CMV e preço sugerido.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={exportarRelatorioCustos}>
            <span className="mr-2">📊</span>
            Relatório de Custos
          </Button>

          <Button type="button" onClick={() => setShowNovaFicha(true)}>
            <span className="mr-2">➕</span>
            Nova Ficha Técnica
          </Button>
        </div>
      </div>

      {loadingProducts && (
        <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800">
          Carregando produtos para usar como ingredientes...
        </div>
      )}

      {!loadingProducts && products.length === 0 && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
          Nenhum produto foi carregado da base. Você ainda pode cadastrar fichas com ingredientes manuais, mas o ideal é ter produtos cadastrados antes.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Receitas</CardTitle>
            <span className="text-2xl">📝</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fichasTecnicas.length}</div>
            <p className="text-xs text-muted-foreground">Receitas cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custo Médio</CardTitle>
            <span className="text-2xl">💰</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(custoMedio)}</div>
            <p className="text-xs text-muted-foreground">Por porção</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CMV Médio</CardTitle>
            <span className="text-2xl">📊</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cmvMedio.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Custo da mercadoria vendida</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Margem Média</CardTitle>
            <span className="text-2xl">📈</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{margemMedia.toFixed(0)}%</div>
            <p className="text-xs text-muted-foreground">Margem de lucro</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {fichasTecnicas.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Nenhuma ficha técnica cadastrada ainda. Clique em <strong>Nova Ficha Técnica</strong> para criar a primeira.
              </p>
            </CardContent>
          </Card>
        ) : (
          fichasTecnicas.map((ficha) => (
            <Card key={ficha.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="text-lg">{ficha.nome}</CardTitle>
                    <CardDescription>{ficha.categoria}</CardDescription>
                  </div>
                  <Badge variant="secondary">{ficha.rendimento} porções</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">Custo por porção:</p>
                    <p className="font-bold text-red-600">
                      {formatCurrency(ficha.custoPorPorcao)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Preço de venda:</p>
                    <p className="font-bold text-green-600">
                      {formatCurrency(ficha.precoVenda)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">CMV:</p>
                    <p className="font-bold">
                      {calcularCMV(ficha.custoPorPorcao, ficha.precoVenda).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Lucro unitário:</p>
                    <p className="font-bold text-blue-600">
                      {formatCurrency(
                        calcularLucroUnitario(ficha.precoVenda, ficha.custoPorPorcao)
                      )}
                    </p>
                  </div>
                </div>

                <div className="text-sm text-gray-600">
                  <p>⏱️ Tempo: {ficha.tempoPreparo} min</p>
                  <p>⚖️ Peso por porção: {ficha.pesoPorcao} g</p>
                  <p>🧾 Ingredientes: {ficha.ingredientes.length}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        className="flex-1"
                        onClick={() => setFichaSelecionada(ficha)}
                      >
                        Ver Detalhes
                      </Button>
                    </DialogTrigger>

                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white text-gray-900">
                      <DialogHeader>
                        <DialogTitle>{ficha.nome}</DialogTitle>
                        <DialogDescription>
                          Ficha técnica completa com ingredientes e custos
                        </DialogDescription>
                      </DialogHeader>

                      {fichaSelecionada && (
                        <div className="space-y-6">
                          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div>
                              <Label>Categoria</Label>
                              <p className="font-medium">{fichaSelecionada.categoria}</p>
                            </div>
                            <div>
                              <Label>Rendimento</Label>
                              <p className="font-medium">{fichaSelecionada.rendimento} porções</p>
                            </div>
                            <div>
                              <Label>Peso por Porção</Label>
                              <p className="font-medium">{fichaSelecionada.pesoPorcao} g</p>
                            </div>
                            <div>
                              <Label>Tempo de Preparo</Label>
                              <p className="font-medium">{fichaSelecionada.tempoPreparo} min</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 md:grid-cols-4">
                            <div>
                              <Label>Custo Total</Label>
                              <p className="font-bold text-red-600">
                                {formatCurrency(fichaSelecionada.custoTotal)}
                              </p>
                            </div>
                            <div>
                              <Label>Custo por Porção</Label>
                              <p className="font-bold text-red-600">
                                {formatCurrency(fichaSelecionada.custoPorPorcao)}
                              </p>
                            </div>
                            <div>
                              <Label>Preço de Venda</Label>
                              <p className="font-bold text-green-600">
                                {formatCurrency(fichaSelecionada.precoVenda)}
                              </p>
                            </div>
                            <div>
                              <Label>CMV</Label>
                              <p className="font-bold">
                                {calcularCMV(
                                  fichaSelecionada.custoPorPorcao,
                                  fichaSelecionada.precoVenda
                                ).toFixed(1)}
                                %
                              </p>
                            </div>
                          </div>

                          <div>
                            <Label>Modo de Preparo</Label>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                              {fichaSelecionada.modoPreparo || "Não informado."}
                            </p>
                          </div>

                          <div>
                            <h3 className="mb-4 text-lg font-semibold">Ingredientes</h3>
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Ingrediente</TableHead>
                                  <TableHead>Uso</TableHead>
                                  <TableHead>Compra</TableHead>
                                  <TableHead>Preço Compra</TableHead>
                                  <TableHead>Custo Unit.</TableHead>
                                  <TableHead>Custo Final</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {fichaSelecionada.ingredientes.map((ingrediente) => (
                                  <TableRow key={ingrediente.id}>
                                    <TableCell className="font-medium">
                                      {ingrediente.nome}
                                    </TableCell>
                                    <TableCell>
                                      {ingrediente.quantidadeUso} {ingrediente.unidadeUso}
                                    </TableCell>
                                    <TableCell>
                                      {ingrediente.quantidadeCompra} {ingrediente.unidadeCompra}
                                    </TableCell>
                                    <TableCell>
                                      {formatCurrency(ingrediente.precoCompra)}
                                    </TableCell>
                                    <TableCell>
                                      {formatCurrency(ingrediente.custoUnitarioBase)}
                                    </TableCell>
                                    <TableCell className="font-medium text-red-600">
                                      {formatCurrency(ingrediente.custoIngrediente)}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditarFicha(ficha)}
                    title="Editar ficha"
                  >
                    ✏️
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleImprimirFicha(ficha)}
                    title="Imprimir ficha"
                  >
                    🖨️
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => excluirFicha(ficha.id)}
                    title="Excluir ficha"
                  >
                    🗑️
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {showEditarFicha && fichaEditando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Editar Ficha Técnica</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowEditarFicha(false);
                  setFichaEditando(null);
                }}
              >
                ✕
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Nome</Label>
                <Input
                  value={fichaEditando.nome}
                  onChange={(e) =>
                    setFichaEditando((prev) =>
                      prev ? { ...prev, nome: e.target.value } : prev
                    )
                  }
                />
              </div>

              <div>
                <Label>Categoria</Label>
                <Input
                  value={fichaEditando.categoria}
                  onChange={(e) =>
                    setFichaEditando((prev) =>
                      prev ? { ...prev, categoria: e.target.value } : prev
                    )
                  }
                />
              </div>

              <div>
                <Label>Rendimento (porções)</Label>
                <Input
                  type="number"
                  value={fichaEditando.rendimento}
                  onChange={(e) =>
                    setFichaEditando((prev) =>
                      prev ? { ...prev, rendimento: toNumber(e.target.value, 1) } : prev
                    )
                  }
                />
              </div>

              <div>
                <Label>Peso por porção (g)</Label>
                <Input
                  type="number"
                  value={fichaEditando.pesoPorcao}
                  onChange={(e) =>
                    setFichaEditando((prev) =>
                      prev ? { ...prev, pesoPorcao: toNumber(e.target.value, 0) } : prev
                    )
                  }
                />
              </div>

              <div>
                <Label>Tempo de preparo (min)</Label>
                <Input
                  type="number"
                  value={fichaEditando.tempoPreparo}
                  onChange={(e) =>
                    setFichaEditando((prev) =>
                      prev ? { ...prev, tempoPreparo: toNumber(e.target.value, 0) } : prev
                    )
                  }
                />
              </div>

              <div>
                <Label>Margem de lucro (%)</Label>
                <Input
                  type="number"
                  value={fichaEditando.margemLucro}
                  onChange={(e) =>
                    setFichaEditando((prev) =>
                      prev ? { ...prev, margemLucro: toNumber(e.target.value, 0) } : prev
                    )
                  }
                />
              </div>

              <div className="md:col-span-2">
                <Label>Modo de preparo</Label>
                <Textarea
                  rows={5}
                  value={fichaEditando.modoPreparo}
                  onChange={(e) =>
                    setFichaEditando((prev) =>
                      prev ? { ...prev, modoPreparo: e.target.value } : prev
                    )
                  }
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEditarFicha(false);
                  setFichaEditando(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={salvarEdicaoFicha}>
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      )}

      {showNovaFicha && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Nova Ficha Técnica</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setShowNovaFicha(false);
                  resetForm();
                }}
              >
                ✕
              </Button>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="nome">Nome da Receita</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex.: Calda de Caramelo"
                  />
                </div>

                <div>
                  <Label htmlFor="categoria">Categoria</Label>
                  <Input
                    id="categoria"
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    placeholder="Ex.: Secos"
                  />
                </div>

                <div>
                  <Label htmlFor="rendimento">Rendimento (porções)</Label>
                  <Input
                    id="rendimento"
                    type="number"
                    value={rendimento}
                    onChange={(e) => setRendimento(toNumber(e.target.value, 1))}
                    placeholder="Ex.: 20"
                  />
                </div>

                <div>
                  <Label htmlFor="peso">Peso por Porção (g)</Label>
                  <Input
                    id="peso"
                    type="number"
                    value={pesoPorcao}
                    onChange={(e) => setPesoPorcao(toNumber(e.target.value, 0))}
                    placeholder="Ex.: 50"
                  />
                </div>

                <div>
                  <Label htmlFor="tempo">Tempo de Preparo (min)</Label>
                  <Input
                    id="tempo"
                    type="number"
                    value={tempoPreparo}
                    onChange={(e) => setTempoPreparo(toNumber(e.target.value, 0))}
                    placeholder="Ex.: 120"
                  />
                </div>

                <div>
                  <Label htmlFor="margem">Margem de Lucro (%)</Label>
                  <Input
                    id="margem"
                    type="number"
                    value={margemLucro}
                    onChange={(e) => setMargemLucro(toNumber(e.target.value, 0))}
                    placeholder="Ex.: 200"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="modo">Modo de Preparo</Label>
                <Textarea
                  id="modo"
                  value={modoPreparo}
                  onChange={(e) => setModoPreparo(e.target.value)}
                  placeholder="Descreva o modo de preparo da receita..."
                  rows={4}
                />
              </div>

              <div>
                <h4 className="mb-4 text-lg font-semibold">Ingredientes</h4>

                <div className="rounded-lg border p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <Label>Produto cadastrado</Label>
                      <select
                        className="mt-2 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={draftIngredienteId}
                        onChange={(e) => onSelectProductIngredient(e.target.value)}
                      >
                        <option value="">— Selecionar produto —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-3">
                      <Label>Ingrediente</Label>
                      <Input
                        value={draftIngredienteNome}
                        onChange={(e) => setDraftIngredienteNome(e.target.value)}
                        placeholder="Nome do ingrediente"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Qtd de uso</Label>
                      <Input
                        type="number"
                        value={draftQuantidadeUso}
                        onChange={(e) =>
                          setDraftQuantidadeUso(toNumber(e.target.value, 0))
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Unidade de uso</Label>
                      <Input
                        value={draftUnidadeUso}
                        onChange={(e) =>
                          setDraftUnidadeUso(e.target.value.toUpperCase())
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Preço da compra</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={draftPrecoCompra}
                        onChange={(e) =>
                          setDraftPrecoCompra(toNumber(e.target.value, 0))
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Qtd comprada</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={draftQuantidadeCompra}
                        onChange={(e) =>
                          setDraftQuantidadeCompra(toNumber(e.target.value, 1))
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>Unidade compra</Label>
                      <Input
                        value={draftUnidadeCompra}
                        onChange={(e) =>
                          setDraftUnidadeCompra(e.target.value.toUpperCase())
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>F. Correção</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={draftFCorrecao}
                        onChange={(e) =>
                          setDraftFCorrecao(toNumber(e.target.value, 1))
                        }
                      />
                    </div>

                    <div className="md:col-span-2">
                      <Label>F. Cocção</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={draftFCoccao}
                        onChange={(e) =>
                          setDraftFCoccao(toNumber(e.target.value, 1))
                        }
                      />
                    </div>

                    <div className="md:col-span-4 flex items-end gap-2">
                      <Button
                        type="button"
                        className="w-full"
                        onClick={salvarIngrediente}
                      >
                        {editandoIngredienteId ? "Salvar ingrediente" : "Adicionar ingrediente"}
                      </Button>

                      {editandoIngredienteId ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={resetDraftIngrediente}
                        >
                          Cancelar
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-50 p-3 text-sm">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div>
                        <p className="text-gray-600">Custo unitário base</p>
                        <p className="font-bold">{formatCurrency(previewIngrediente.custoUnitarioBase)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Custo final do ingrediente</p>
                        <p className="font-bold text-red-600">{formatCurrency(previewIngrediente.custoIngrediente)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Modo</p>
                        <p className="font-medium">
                          {editandoIngredienteId ? "Editando ingrediente" : "Novo ingrediente"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {ingredientes.length === 0 ? (
                    <p className="text-sm text-gray-600">
                      Nenhum ingrediente adicionado ainda.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ingrediente</TableHead>
                          <TableHead>Uso</TableHead>
                          <TableHead>Compra</TableHead>
                          <TableHead>Preço compra</TableHead>
                          <TableHead>Custo unit.</TableHead>
                          <TableHead>Custo final</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ingredientes.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.nome}</TableCell>
                            <TableCell>
                              {item.quantidadeUso} {item.unidadeUso}
                            </TableCell>
                            <TableCell>
                              {item.quantidadeCompra} {item.unidadeCompra}
                            </TableCell>
                            <TableCell>{formatCurrency(item.precoCompra)}</TableCell>
                            <TableCell>{formatCurrency(item.custoUnitarioBase)}</TableCell>
                            <TableCell className="font-medium text-red-600">
                              {formatCurrency(item.custoIngrediente)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => editarIngrediente(item.id)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removerIngrediente(item.id)}
                                >
                                  Remover
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 p-4">
                <h4 className="mb-3 font-semibold">Prévia automática</h4>
                {(() => {
                  const preview = calcularCustos(ingredientes, rendimento, margemLucro);
                  const cmv = calcularCMV(preview.custoPorPorcao, preview.precoVenda);
                  return (
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 text-sm">
                      <div>
                        <p className="text-gray-600">Custo total</p>
                        <p className="font-bold text-red-600">
                          {formatCurrency(preview.custoTotal)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Custo por porção</p>
                        <p className="font-bold text-red-600">
                          {formatCurrency(preview.custoPorPorcao)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Preço sugerido</p>
                        <p className="font-bold text-green-600">
                          {formatCurrency(preview.precoVenda)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">CMV</p>
                        <p className="font-bold">{cmv.toFixed(1)}%</p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowNovaFicha(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>

                <Button type="button" onClick={salvarNovaFicha}>
                  Salvar Ficha Técnica
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}