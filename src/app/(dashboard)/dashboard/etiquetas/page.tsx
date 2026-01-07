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

import { imprimirBatchNoBrowser } from "@/lib/etiquetas/print";
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
   TIPOS
========================= */
type InventoryLabelRow = {
  id: string;
  label_code: string;
  qty: number;
  unit_label: string;
  notes: string | null;
  created_at: string;
};

type ProductOption = {
  id: string;
  name: string;
  category: string | null;
  unit: string | null;
};

const USUARIO_LOGADO_NOME = "Admin User";
const ESTABELECIMENTO_NOME = "Matriz";

const TIPO_LABEL: Record<TipoSel, string> = {
  MANIPULACAO: "MANIPULAÇÃO",
  REVALIDAR: "FABRICANTE",
};

const TIPO_LABEL_LONG = TIPO_LABEL;

const tamanhosEtiqueta = [
  { id: "1", nome: "Pequena", largura: 5, altura: 3 },
  { id: "2", nome: "Média", largura: 10, altura: 6 },
  { id: "3", nome: "Grande", largura: 15, altura: 10 },
];

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
   COMPONENTE
========================= */
export default function EtiquetasPage() {
  const [showNovaEtiqueta, setShowNovaEtiqueta] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] =
    useState<TipoSel>("MANIPULACAO");
  const [tamanhoSelecionado, setTamanhoSelecionado] = useState("Grande");

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsError, setProductsError] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(
    null,
  );

  const [formData, setFormData] = useState(createDefaultForm());
  const [linhasPorcao, setLinhasPorcao] = useState<LinhaPorcao[]>([]);
  const [erros, setErros] = useState<LinhaErro>({ baseQtd: false, porcoes: {} });

  const handleInputChange = useCallback(
    (field: keyof typeof formData, value: string) => {
      setFormData((p) => ({ ...p, [field]: value }));
    },
    [],
  );

  const displayInsumoLabel = useMemo(() => {
    if (formData.insumo) return formData.insumo;
    if (productsLoading) return "Carregando produtos...";
    return "Selecionar produto...";
  }, [formData.insumo, productsLoading]);

  /* =========================
     CARREGAR PRODUTOS
  ========================= */
  useEffect(() => {
    const load = async () => {
      setProductsLoading(true);
      try {
        const res = await fetch("/api/products");
        const data = (await res.json()) as ProductOption[];
        setProducts(
          data.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
        );
      } catch (e: any) {
        setProductsError("Erro ao carregar produtos");
      } finally {
        setProductsLoading(false);
      }
    };
    load();
  }, []);

  /* =========================
     MODAL
  ========================= */
  return (
    <div className="space-y-6">
      <Button onClick={() => setShowNovaEtiqueta(true)}>Nova Etiqueta</Button>

      {showNovaEtiqueta && (
        <div className="fixed inset-0 bg-black/50 z-50">
          {/* backdrop */}
          <div
            className="absolute inset-0"
            onClick={() => setShowNovaEtiqueta(false)}
          />

          {/* modal */}
          <div className="relative z-[60] flex min-h-screen items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl rounded-lg p-6">
              <Label>Insumo / Produto *</Label>

              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                  >
                    {displayInsumoLabel}
                    <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>

                <PopoverContent
                  forceMount
                  className="w-[--radix-popover-trigger-width] p-0 z-[999999]"
                  side="bottom"
                  align="start"
                >
                  <Command>
                    <CommandInput placeholder="Buscar produto..." />

                    <CommandList className="max-h-[300px] overflow-auto">
                      <CommandEmpty>
                        {productsLoading
                          ? "Carregando..."
                          : "Nenhum produto encontrado"}
                      </CommandEmpty>

                      <CommandGroup>
                        {products.map((p) => (
                          <CommandItem
                            key={p.id}
                            value={p.name}
                            onSelect={(value) => {
                              setSelectedProductId(p.id);
                              handleInputChange("insumo", p.name);
                              if (p.unit) {
                                handleInputChange("umd", p.unit);
                              }
                              setProductOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedProductId === p.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                            {p.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
