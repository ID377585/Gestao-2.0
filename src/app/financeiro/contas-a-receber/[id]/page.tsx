"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  cancelAccountReceivable,
  getAccountReceivableById,
  markAccountReceivableAsPending,
  markAccountReceivableAsReceived,
  updateAccountReceivableDetails,
} from "@/lib/financeiro/accounts-receivable";
import { useFinancialHistory } from "@/hooks/use-financial-history";
import FinancialHistoryCard from "@/components/financeiro/financial-history-card";
import { listBankAccounts } from "@/lib/financeiro/bank-accounts";
import { getBankStatusMap } from "@/lib/financeiro/reconciliation-status";
import type { BankAccount } from "@/types/compras";
import { listFinancialCategories } from "@/lib/financeiro/financial-categories";
import type {
  AccountReceivable,
  BankAccount,
  FinancialCategory,
} from "@/types/compras";

const { createFinancialHistoryEntryWithUser } = useFinancialHistory();

function statusClass(status: AccountReceivable["statusRecebimento"]) {
  switch (status) {
    case "pendente":
      return "bg-yellow-100 text-yellow-800";
    case "recebido":
      return "bg-green-100 text-green-800";
    case "vencido":
      return "bg-red-100 text-red-800";
    case "cancelado":
      return "bg-gray-200 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function statusLabel(status: AccountReceivable["statusRecebimento"]) {
  switch (status) {
    case "pendente":
      return "Pendente";
    case "recebido":
      return "Recebido";
    case "vencido":
      return "Vencido";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

export default function ContaAReceberDetalhePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const receivableId = params.id;

  const [item, setItem] = useState<AccountReceivable | null>(null);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [dataRecebimento, setDataRecebimento] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [formaRecebimento, setFormaRecebimento] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [descricao, setDescricao] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [categoriaId, setCategoriaId] = useState("");

  const [bankStatus, setBankStatus] = useState<{
  bankConciliated: boolean;
  bankAccountName: string;
  matchedAt: string;
} | null>(null);

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [data, allCategories, allBankAccounts, bankMap] = await Promise.all([
        getAccountReceivableById(receivableId),
        listFinancialCategories(),
        listBankAccounts(),
        getBankStatusMap({ financeType: "receber" }),
        ]);

      if (!data) {
        setError("Conta a receber não encontrada.");
        setLoading(false);
        return;
      }

      setItem(data);
      setCategories(
        allCategories.filter((entry) => entry.ativo && entry.tipo === "receita")
      );
      setBankAccounts(allBankAccounts.filter((entry) => entry.ativo));
      setBankStatus(bankMap.get(data.id) ?? null);
      setObservacoes(data.observacoes ?? "");
      setFormaRecebimento(data.formaRecebimento ?? "");
      setBankAccountId(data.bankAccountId ?? "");
      setCategoriaId(data.categoriaId ?? "");
      setDescricao(data.descricao ?? "");
      setVencimento(data.vencimento ?? "");
      setDataRecebimento(
        data.dataRecebimento || new Date().toISOString().slice(0, 10)
      );
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a conta.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDetails() {
    if (!item) return;

    const category = categories.find((entry) => entry.id === categoriaId);

    try {
      setSaving(true);
      setError("");

      await updateAccountReceivableDetails({
        id: item.id,
        descricao,
        vencimento,
        categoriaId: category?.id ?? "",
        categoria: category
          ? [category.grupo, category.categoria, category.subcategoria]
              .filter(Boolean)
              .join(" / ")
          : "",
        observacoes,
      });

      await loadData();
      alert("Dados atualizados com sucesso.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar os dados.");
    } finally {
      setSaving(false);
    }

    await createFinancialHistoryEntryWithUser({
  financeType: "receber",
  financeId: item.id,
  action: "editado",
  title: "Conta a receber editada",
  description: descricao,
});
  }

  async function handleReceive() {
    if (!item) return;

    const selectedBankAccount = bankAccounts.find(
      (entry) => entry.id === bankAccountId
    );

    try {
      setSaving(true);
      setError("");

      await markAccountReceivableAsReceived({
        id: item.id,
        dataRecebimento,
        formaRecebimento,
        bankAccountId: selectedBankAccount?.id ?? "",
        bankAccountName: selectedBankAccount
          ? `${selectedBankAccount.banco} - ${selectedBankAccount.nomeConta}`
          : "",
        observacoes,
      });

      await loadData();
      alert("Conta marcada como recebida.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível registrar o recebimento.");
    } finally {
      setSaving(false);
    }
await createFinancialHistoryEntryWithUser({
  financeType: "receber",
  financeId: item.id,
  action: "recebido",
  title: "Conta marcada como recebida",
  description: formaRecebimento,
  bankAccountName: selectedBankAccount
    ? `${selectedBankAccount.banco} - ${selectedBankAccount.nomeConta}`
    : "",
});

  }

  async function handlePending() {
    if (!item) return;

    try {
      setSaving(true);
      setError("");

      await markAccountReceivableAsPending({
        id: item.id,
        observacoes,
      });

      await loadData();
      alert("Conta retornou para pendente.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível atualizar a conta.");
    } finally {
      setSaving(false);
    }

await createFinancialHistoryEntryWithUser({
  financeType: "receber",
  financeId: item.id,
  action: "pendente",
  title: "Conta retornou para pendente",
  description: observacoes,
});

  }

  async function handleCancel() {
    if (!item) return;

    const confirmed = confirm("Deseja cancelar esta conta a receber?");
    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");

      await cancelAccountReceivable({
        id: item.id,
        observacoes,
      });

      await loadData();
      alert("Conta cancelada com sucesso.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível cancelar a conta.");
    } finally {
      setSaving(false);
    }

await createFinancialHistoryEntryWithUser({
  financeType: "receber",
  financeId: item.id,
  action: "cancelado",
  title: "Conta a receber cancelada",
  description: observacoes,
});

  }

  useEffect(() => {
    if (receivableId) {
      loadData();
    }
  }, [receivableId]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Carregando conta...</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-600">
          {error || "Conta a receber não encontrada."}
        </p>
        <button
          onClick={() => router.push("/financeiro/contas-a-receber")}
          className="rounded-xl border px-4 py-2 text-sm font-medium"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conta a receber</h1>
          <p className="text-sm text-gray-500">{item.descricao}</p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-sm font-medium ${statusClass(
            item.statusRecebimento
          )}`}
        >
          {statusLabel(item.statusRecebimento)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Dados do título</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Cliente</label>
              <input
                value={item.customerName}
                disabled
                className="w-full rounded-xl border bg-gray-50 px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Origem</label>
              <input
                value={item.origem}
                disabled
                className="w-full rounded-xl border bg-gray-50 px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Origem ID</label>
              <input
                value={item.origemId}
                disabled
                className="w-full rounded-xl border bg-gray-50 px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Descrição</label>
              <input
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
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
              <label className="mb-1 block text-sm font-medium">Categoria</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              >
                <option value="">Selecione</option>
                {categories.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {[entry.grupo, entry.categoria, entry.subcategoria]
                      .filter(Boolean)
                      .join(" / ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border p-4">
                <div className="text-sm text-gray-500">Conta bancária</div>
                <div className="mt-1 font-semibold">
                    {bankStatus?.bankAccountName || item.bankAccountName || "-"}
                </div>
                </div>

                <div className="rounded-xl border p-4">
                <div className="text-sm text-gray-500">Status bancário</div>
                <div className="mt-1 font-semibold">
                    {bankStatus?.bankConciliated ? "Conciliado" : "Não conciliado"}
                </div>
                </div>

                <div className="rounded-xl border p-4">
                <div className="text-sm text-gray-500">Data da conciliação</div>
                <div className="mt-1 font-semibold">
                    {bankStatus?.matchedAt
                    ? new Date(bankStatus.matchedAt).toLocaleDateString("pt-BR")
                    : "-"}
                </div>
                </div>
            </div>
            </div>

            <div>
              <span className="font-medium text-sm">Valor:</span>{" "}
              {Number(item.valor).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>

            <button
              type="button"
              onClick={handleSaveDetails}
              disabled={saving}
              className="rounded-xl border px-4 py-2 text-sm font-medium"
            >
              Salvar dados
            </button>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Ações financeiras</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Data de recebimento
              </label>
              <input
                type="date"
                value={dataRecebimento}
                onChange={(e) => setDataRecebimento(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Forma de recebimento
              </label>
              <input
                value={formaRecebimento}
                onChange={(e) => setFormaRecebimento(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
                placeholder="Ex.: Pix, dinheiro, cartão, transferência"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Conta bancária</label>
              <select
                value={bankAccountId}
                onChange={(e) => setBankAccountId(e.target.value)}
                className="w-full rounded-xl border px-3 py-2 outline-none"
              >
                <option value="">Selecione</option>
                {bankAccounts.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.banco} - {entry.nomeConta}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Observações
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="min-h-[120px] w-full rounded-xl border px-3 py-2 outline-none"
                placeholder="Observações financeiras"
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={handleReceive}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {saving ? "Salvando..." : "Marcar como recebido"}
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handlePending}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
              >
                Voltar para pendente
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={handleCancel}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
              >
                Cancelar conta
              </button>

              <button
                type="button"
                onClick={() => router.push("/financeiro/contas-a-receber")}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

<FinancialHistoryCard financeType="receber" financeId={item.id} />