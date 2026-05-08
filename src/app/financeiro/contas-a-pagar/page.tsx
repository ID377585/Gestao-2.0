"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  createAccountPayable,
  listAccountsPayable,
} from "@/lib/financeiro/accounts-payable";
import { listCostCenters } from "@/lib/financeiro/cost-centers";
import { listFinancialCategories } from "@/lib/financeiro/financial-categories";
import {
  getBankStatusMap,
  type FinancialBankStatus,
} from "@/lib/financeiro/reconciliation-status";
import type {
  AccountPayable,
  CostCenter,
  FinancialCategory,
  PayableStatus,
} from "@/types/compras";

function statusLabel(status: PayableStatus) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "pago":
      return "Pago";
    case "vencido":
      return "Vencido";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

function statusClass(status: PayableStatus) {
  switch (status) {
    case "pendente":
      return "bg-yellow-100 text-yellow-800";
    case "pago":
      return "bg-green-100 text-green-800";
    case "vencido":
      return "bg-red-100 text-red-800";
    case "cancelado":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function formatCurrency(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("pt-BR");
}

async function safeLoad<T>(loader: () => Promise<T>, fallback: T) {
  try {
    return await loader();
  } catch (error) {
    console.warn("[contas-a-pagar] Falha ao carregar dado auxiliar.", error);
    return fallback;
  }
}

type PayableRow = AccountPayable & {
  bankStatus?: FinancialBankStatus;
};

export default function ContasAPagarPage() {
  const [items, setItems] = useState<PayableRow[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const [statusFilter, setStatusFilter] = useState<
    "todos" | "pendente" | "pago" | "vencido" | "cancelado"
  >("todos");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [originFilter, setOriginFilter] = useState<
    "todos" | "compra" | "recebimento" | "manual"
  >("todos");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [costCenterFilter, setCostCenterFilter] = useState("");
  const [bankFilter, setBankFilter] = useState<
    "todos" | "conciliado" | "nao_conciliado"
  >("todos");
  const [search, setSearch] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [supplierName, setSupplierName] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [numeroDocumento, setNumeroDocumento] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [centroCustoId, setCentroCustoId] = useState("");
  const [observacoes, setObservacoes] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      setWarning("");

      const [payables, allCategories, allCostCenters, bankStatusMap] =
        await Promise.all([
          safeLoad(() => listAccountsPayable(), [] as AccountPayable[]),
          safeLoad(() => listFinancialCategories(), [] as FinancialCategory[]),
          safeLoad(() => listCostCenters(), [] as CostCenter[]),
          safeLoad(
            () => getBankStatusMap({ financeType: "pagar" }),
            new Map<string, FinancialBankStatus>()
          ),
        ]);

      const enriched: PayableRow[] = payables.map((item) => ({
        ...item,
        bankStatus: bankStatusMap.get(item.id),
      }));

      setItems(enriched);
      setCategories(
        allCategories.filter((item) => item.ativo && item.tipo !== "receita")
      );
      setCostCenters(allCostCenters.filter((item) => item.ativo));

      if (enriched.some((item) => item.id.startsWith("entrada-"))) {
        setWarning(
          "Algumas contas foram geradas automaticamente a partir das notas lançadas em Entradas. Elas aparecem como contas gerenciais até a tabela financeira estar totalmente provisionada."
        );
      }
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar as contas a pagar.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!supplierName || !descricao || !valor || !vencimento) {
      alert("Preencha fornecedor, descrição, valor e vencimento.");
      return;
    }

    const category = categories.find((item) => item.id === categoriaId);
    const costCenter = costCenters.find((item) => item.id === centroCustoId);

    try {
      setSaving(true);
      setError("");

      await createAccountPayable({
        origem: "manual",
        supplierName,
        descricao,
        valor: Number(valor),
        vencimento,
        numeroDocumento,
        categoriaId: category?.id ?? "",
        categoria: category
          ? [category.grupo, category.categoria, category.subcategoria]
              .filter(Boolean)
              .join(" / ")
          : "",
        centroCustoId: costCenter?.id ?? "",
        centroCusto: costCenter?.nome ?? "",
        observacoes,
      });

      setSupplierName("");
      setDescricao("");
      setValor("");
      setVencimento("");
      setNumeroDocumento("");
      setCategoriaId("");
      setCentroCustoId("");
      setObservacoes("");
      setShowForm(false);

      await loadData();
      alert("Conta a pagar criada com sucesso.");
    } catch (err) {
      console.error(err);
      setError(
        "Não foi possível criar a conta a pagar. Verifique se a tabela accounts_payable existe no banco."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const statusOk =
        statusFilter === "todos" || item.statusPagamento === statusFilter;

      const supplierOk =
        !supplierFilter ||
        item.supplierName.toLowerCase().includes(supplierFilter.toLowerCase());

      const originOk =
        originFilter === "todos" || item.origem === originFilter;

      const categoryOk =
        !categoryFilter || item.categoriaId === categoryFilter;

      const costCenterOk =
        !costCenterFilter || item.centroCustoId === costCenterFilter;

      const bankOk =
        bankFilter === "todos" ||
        (bankFilter === "conciliado" && item.bankStatus?.bankConciliated) ||
        (bankFilter === "nao_conciliado" && !item.bankStatus?.bankConciliated);

      const searchTerm = search.toLowerCase();

      const searchOk =
        !search ||
        String(item.descricao ?? "").toLowerCase().includes(searchTerm) ||
        String(item.supplierName ?? "").toLowerCase().includes(searchTerm) ||
        String(item.numeroDocumento ?? "").toLowerCase().includes(searchTerm);
        
      return (
        statusOk &&
        supplierOk &&
        originOk &&
        categoryOk &&
        costCenterOk &&
        bankOk &&
        searchOk
      );
    });
  }, [
    items,
    statusFilter,
    supplierFilter,
    originFilter,
    categoryFilter,
    costCenterFilter,
    bankFilter,
    search,
  ]);

  const totalPendente = useMemo(() => {
    return filteredItems
      .filter(
        (item) =>
          item.statusPagamento !== "pago" &&
          item.statusPagamento !== "cancelado"
      )
      .reduce((acc, item) => acc + Number(item.valor), 0);
  }, [filteredItems]);

  useEffect(() => {
    void loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contas a pagar</h1>
          <p className="text-sm text-gray-500">
            Títulos financeiros gerados pelos recebimentos de compras, entradas
            de notas fiscais e lançamentos manuais.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowForm((prev) => !prev)}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
          >
            {showForm ? "Fechar cadastro" : "Nova conta a pagar"}
          </button>

          <div className="rounded-2xl border bg-white px-4 py-3 text-right shadow-sm">
            <div className="text-xs text-gray-500">Total em aberto</div>
            <div className="text-lg font-bold">{formatCurrency(totalPendente)}</div>
          </div>
        </div>
      </div>

      {warning ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          {warning}
        </div>
      ) : null}

      {showForm ? (
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Fornecedor</label>
              <input
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
                placeholder="Nome do fornecedor"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Descrição</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
                placeholder="Ex.: Compra de mercadorias"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Valor</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
                placeholder="0,00"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Vencimento</label>
              <input
                type="date"
                value={vencimento}
                onChange={(e) => setVencimento(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Número do documento
              </label>
              <input
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
                placeholder="Nota, boleto, referência..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Categoria</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              >
                <option value="">Selecione</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {[item.grupo, item.categoria, item.subcategoria]
                      .filter(Boolean)
                      .join(" / ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Centro de custo
              </label>
              <select
                value={centroCustoId}
                onChange={(e) => setCentroCustoId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              >
                <option value="">Selecione</option>
                {costCenters.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Observações</label>
              <input
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
                placeholder="Informações adicionais"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar conta a pagar"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-7">
          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | "todos"
                    | "pendente"
                    | "pago"
                    | "vencido"
                    | "cancelado"
                )
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="pendente">Pendentes</option>
              <option value="pago">Pagos</option>
              <option value="vencido">Vencidos</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Fornecedor</label>
            <input
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Buscar fornecedor"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Origem</label>
            <select
              value={originFilter}
              onChange={(e) =>
                setOriginFilter(
                  e.target.value as "todos" | "compra" | "recebimento" | "manual"
                )
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todas</option>
              <option value="compra">Compra</option>
              <option value="recebimento">Recebimento</option>
              <option value="manual">Manual</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Categoria</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="">Todas</option>
              {categories.map((item) => (
                <option key={item.id} value={item.id}>
                  {[item.grupo, item.categoria, item.subcategoria]
                    .filter(Boolean)
                    .join(" / ")}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Centro de custo
            </label>
            <select
              value={costCenterFilter}
              onChange={(e) => setCostCenterFilter(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="">Todos</option>
              {costCenters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Status bancário
            </label>
            <select
              value={bankFilter}
              onChange={(e) =>
                setBankFilter(
                  e.target.value as "todos" | "conciliado" | "nao_conciliado"
                )
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="conciliado">Conciliado</option>
              <option value="nao_conciliado">Não conciliado</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Buscar</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Descrição ou fornecedor"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando contas...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhuma conta encontrada para o filtro selecionado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Fornecedor</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Conta bancária</th>
                  <th className="px-4 py-3 font-medium">Status bancário</th>
                  <th className="px-4 py-3 font-medium">Origem</th>
                  <th className="px-4 py-3 font-medium">Vencimento</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>

              <tbody>
                {filteredItems.map((item) => {
                  const isVirtualEntry = item.id.startsWith("entrada-");

                  return (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-3 font-medium">
                        {item.supplierName}
                      </td>

                      <td className="px-4 py-3">
                        <div>{item.descricao}</div>
                        {isVirtualEntry ? (
                          <div className="mt-1 text-xs text-gray-500">
                            Gerado pela sessão de Entradas
                          </div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        {item.numeroDocumento || "-"}
                      </td>

                      <td className="px-4 py-3">
                        {item.bankStatus?.bankAccountName ||
                          item.bankAccountName ||
                          "-"}
                      </td>

                      <td className="px-4 py-3">
                        {item.bankStatus?.bankConciliated ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                            Conciliado
                          </span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                            Não conciliado
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3">{item.origem}</td>

                      <td className="px-4 py-3">{formatDate(item.vencimento)}</td>

                      <td className="px-4 py-3">
                        {formatCurrency(Number(item.valor))}
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${statusClass(
                            item.statusPagamento
                          )}`}
                        >
                          {statusLabel(item.statusPagamento)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {isVirtualEntry ? (
                          <span className="rounded-lg border px-3 py-1 text-xs font-medium text-gray-500">
                            Entrada
                          </span>
                        ) : (
                          <Link
                            href={`/financeiro/contas-a-pagar/${item.id}`}
                            className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-gray-50"
                          >
                            Abrir
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}