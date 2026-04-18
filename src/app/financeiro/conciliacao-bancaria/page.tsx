"use client";

import { useEffect, useMemo, useState } from "react";
import { listBankAccounts } from "@/lib/financeiro/bank-accounts";
import {
  createBankReconciliationEntry,
  importBankReconciliationCsv,
  linkReconciliationToFinance,
  listBankReconciliationEntries,
  markReconciliationEntry,
  unlinkReconciliationFromFinance,
} from "@/lib/financeiro/bank-reconciliation";
import { listAccountsPayable } from "@/lib/financeiro/accounts-payable";
import { listAccountsReceivable } from "@/lib/financeiro/accounts-receivable";
import {
  buildReconciliationSuggestions,
  type ReconciliationSuggestion,
} from "@/lib/financeiro/reconciliation-matching";
import type {
  BankAccount,
  BankReconciliationEntry,
} from "@/types/compras";

export default function ConciliacaoBancariaPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [entries, setEntries] = useState<BankReconciliationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const [bankAccountId, setBankAccountId] = useState("");
  const [data, setData] = useState("");
  const [descricao, setDescricao] = useState("");
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [valor, setValor] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [suggestions, setSuggestions] = useState<
    Map<string, ReconciliationSuggestion>
  >(new Map());

  async function loadData(selectedBankAccountId?: string) {
    try {
      setLoading(true);
      setError("");

      const [
        accountsData,
        entriesData,
        payablesData,
        receivablesData,
      ] = await Promise.all([
        listBankAccounts(),
        listBankReconciliationEntries(selectedBankAccountId || bankAccountId || undefined),
        listAccountsPayable(),
        listAccountsReceivable(),
      ]);

      setAccounts(accountsData.filter((item) => item.ativo));
      setEntries(entriesData);

      const builtSuggestions = buildReconciliationSuggestions({
        entries: entriesData,
        payables: payablesData,
        receivables: receivablesData,
      });

      setSuggestions(builtSuggestions);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a conciliação bancária.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const selectedAccount = accounts.find((item) => item.id === bankAccountId);

    if (!selectedAccount || !data || !descricao || !valor) {
      alert("Selecione a conta e preencha data, descrição e valor.");
      return;
    }

    try {
      setSaving(true);

      await createBankReconciliationEntry({
        bankAccountId: selectedAccount.id,
        bankAccountName: `${selectedAccount.banco} - ${selectedAccount.nomeConta}`,
        data,
        descricao,
        tipo,
        valor: Number(valor),
        origem: "manual",
        observacoes,
      });

      setData("");
      setDescricao("");
      setTipo("saida");
      setValor("");
      setObservacoes("");

      await loadData(selectedAccount.id);
      alert("Lançamento bancário criado com sucesso.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível criar o lançamento bancário.");
    } finally {
      setSaving(false);
    }
  }

  async function handleImportCsv(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    const selectedAccount = accounts.find((item) => item.id === bankAccountId);

    if (!file) return;

    if (!selectedAccount) {
      alert("Selecione uma conta bancária antes de importar o CSV.");
      event.target.value = "";
      return;
    }

    try {
      setImporting(true);
      setError("");

      const text = await file.text();

      const importedCount = await importBankReconciliationCsv({
        csvText: text,
        bankAccountId: selectedAccount.id,
        bankAccountName: `${selectedAccount.banco} - ${selectedAccount.nomeConta}`,
      });

      await loadData(selectedAccount.id);
      alert(`${importedCount} lançamentos importados com sucesso.`);
    } catch (err) {
      console.error(err);
      setError("Não foi possível importar o arquivo CSV.");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  async function handleToggleConciliado(item: BankReconciliationEntry) {
    try {
      await markReconciliationEntry({
        id: item.id,
        conciliado: !item.conciliado,
        observacoes: item.observacoes ?? "",
      });

      await loadData(bankAccountId);
    } catch (err) {
      console.error(err);
      setError("Não foi possível atualizar a conciliação.");
    }
  }

  async function handleApplySuggestion(item: BankReconciliationEntry) {
    const suggestion = suggestions.get(item.id);

    if (!suggestion) {
      alert("Nenhuma sugestão disponível para este lançamento.");
      return;
    }

    try {
      await linkReconciliationToFinance({
        id: item.id,
        financeType: suggestion.financeType,
        financeId: suggestion.financeId,
        financeLabel: suggestion.financeLabel,
        observacoes: `Conciliado por sugestão (${suggestion.reason})`,
      });

      await loadData(bankAccountId);
      alert("Sugestão aplicada com sucesso.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível aplicar a sugestão.");
    }
  }

  async function handleRemoveLink(item: BankReconciliationEntry) {
    const confirmed = confirm("Deseja remover o vínculo desta conciliação?");
    if (!confirmed) return;

    try {
      await unlinkReconciliationFromFinance({
        id: item.id,
        observacoes: "Vínculo removido manualmente",
      });

      await loadData(bankAccountId);
      alert("Vínculo removido com sucesso.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível remover o vínculo.");
    }
  }

  const resumo = useMemo(() => {
    const entradas = entries
      .filter((item) => item.tipo === "entrada")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const saidas = entries
      .filter((item) => item.tipo === "saida")
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const conciliados = entries
      .filter((item) => item.conciliado)
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const pendentes = entries
      .filter((item) => !item.conciliado)
      .reduce((acc, item) => acc + Number(item.valor), 0);

    const vinculados = entries.filter(
      (item) => item.matchedFinanceId && item.matchedFinanceType
    ).length;

    return {
      entradas,
      saidas,
      saldoMovimentado: entradas - saidas,
      conciliados,
      pendentes,
      comSugestao: entries.filter((item) => suggestions.has(item.id)).length,
      vinculados,
    };
  }, [entries, suggestions]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (bankAccountId) {
      loadData(bankAccountId);
    }
  }, [bankAccountId]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Conciliação Bancária</h1>
        <p className="text-sm text-gray-500">
          Registre, importe e concilie lançamentos bancários.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Conta bancária</label>
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="">Selecione</option>
              {accounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.banco} - {item.nomeConta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "entrada" | "saida")}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>
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
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-sm font-medium">Observações</label>
          <input
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 outline-none"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCreate}
            disabled={saving}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Adicionar lançamento"}
          </button>

          <label className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50">
            {importing ? "Importando..." : "Importar CSV"}
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportCsv}
              className="hidden"
              disabled={importing}
            />
          </label>
        </div>

        <div className="mt-4 rounded-xl border bg-gray-50 p-3 text-xs text-gray-600">
          Formato esperado do CSV: colunas <strong>data</strong>, <strong>descricao</strong> e <strong>valor</strong>. Também aceita <strong>tipo</strong> opcional.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Entradas</div>
          <div className="mt-2 text-xl font-bold">
            {resumo.entradas.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Saídas</div>
          <div className="mt-2 text-xl font-bold">
            {resumo.saidas.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Saldo movimentado</div>
          <div className="mt-2 text-xl font-bold">
            {resumo.saldoMovimentado.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Pendentes</div>
          <div className="mt-2 text-xl font-bold">
            {resumo.pendentes.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Com sugestão</div>
          <div className="mt-2 text-xl font-bold">{resumo.comSugestao}</div>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="text-sm text-gray-500">Vinculados</div>
          <div className="mt-2 text-xl font-bold">{resumo.vinculados}</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando conciliação...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum lançamento bancário encontrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Data</th>
                  <th className="px-4 py-3 font-medium">Conta</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Vínculo</th>
                  <th className="px-4 py-3 font-medium">Sugestão</th>
                  <th className="px-4 py-3 font-medium">Conciliado</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((item) => {
                  const suggestion = suggestions.get(item.id);

                  return (
                    <tr key={item.id} className="border-b">
                      <td className="px-4 py-3">
                        {item.data
                          ? new Date(item.data).toLocaleDateString("pt-BR")
                          : "-"}
                      </td>
                      <td className="px-4 py-3">{item.bankAccountName}</td>
                      <td className="px-4 py-3">{item.descricao}</td>
                      <td className="px-4 py-3">{item.tipo}</td>
                      <td className="px-4 py-3">
                        {Number(item.valor).toLocaleString("pt-BR", {
                          style: "currency",
                          currency: "BRL",
                        })}
                      </td>

                      <td className="px-4 py-3">
                        {item.matchedFinanceId ? (
                          <div className="space-y-1">
                            <div className="text-xs font-medium">
                              {item.matchedFinanceType} • {item.matchedFinanceLabel}
                            </div>
                            <div className="text-xs text-gray-500">
                              ID: {item.matchedFinanceId}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Sem vínculo</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {suggestion ? (
                          <div className="space-y-1">
                            <div className="text-xs font-medium">
                              {suggestion.financeType} • {suggestion.financeLabel}
                            </div>
                            <div className="text-xs text-gray-500">
                              score {suggestion.score} • {suggestion.reason}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Sem sugestão</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {item.conciliado ? "Sim" : "Não"}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {suggestion && !item.matchedFinanceId ? (
                            <button
                              type="button"
                              onClick={() => handleApplySuggestion(item)}
                              className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-gray-50"
                            >
                              Conciliar sugestão
                            </button>
                          ) : null}

                          {item.matchedFinanceId ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveLink(item)}
                              className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-gray-50"
                            >
                              Remover vínculo
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleConciliado(item)}
                              className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-gray-50"
                            >
                              {item.conciliado ? "Desconciliar" : "Conciliar"}
                            </button>
                          )}
                        </div>
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