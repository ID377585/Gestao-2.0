"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createBankAccount,
  listBankAccounts,
  updateBankAccount,
} from "@/lib/financeiro/bank-accounts";
import type { BankAccount, BankAccountType } from "@/types/compras";

export default function ContasBancariasPage() {
  const [items, setItems] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [editingId, setEditingId] = useState("");
  const [banco, setBanco] = useState("");
  const [nomeConta, setNomeConta] = useState("");
  const [agencia, setAgencia] = useState("");
  const [numeroConta, setNumeroConta] = useState("");
  const [tipo, setTipo] = useState<BankAccountType>("corrente");
  const [saldoInicial, setSaldoInicial] = useState("");
  const [busca, setBusca] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await listBankAccounts();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar as contas bancárias.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId("");
    setBanco("");
    setNomeConta("");
    setAgencia("");
    setNumeroConta("");
    setTipo("corrente");
    setSaldoInicial("");
  }

  async function handleSave() {
    if (!banco || !nomeConta) {
      alert("Preencha banco e nome da conta.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateBankAccount({
          id: editingId,
          banco,
          nomeConta,
          agencia,
          numeroConta,
          tipo,
          saldoInicial: Number(saldoInicial || 0),
          ativo: true,
        });
      } else {
        await createBankAccount({
          banco,
          nomeConta,
          agencia,
          numeroConta,
          tipo,
          saldoInicial: Number(saldoInicial || 0),
          ativo: true,
        });
      }

      resetForm();
      await loadData();
      alert("Conta bancária salva com sucesso.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar a conta bancária.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item: BankAccount) {
    setEditingId(item.id);
    setBanco(item.banco);
    setNomeConta(item.nomeConta);
    setAgencia(item.agencia ?? "");
    setNumeroConta(item.numeroConta ?? "");
    setTipo(item.tipo);
    setSaldoInicial(String(item.saldoInicial ?? 0));
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!busca) return true;
      const term = busca.toLowerCase();

      return (
        item.banco.toLowerCase().includes(term) ||
        item.nomeConta.toLowerCase().includes(term) ||
        (item.agencia ?? "").toLowerCase().includes(term) ||
        (item.numeroConta ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, busca]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Contas Bancárias</h1>
        <p className="text-sm text-gray-500">
          Cadastre as contas bancárias usadas no financeiro.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? "Editar conta bancária" : "Nova conta bancária"}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Banco</label>
            <input
              value={banco}
              onChange={(e) => setBanco(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Nome da conta</label>
            <input
              value={nomeConta}
              onChange={(e) => setNomeConta(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as BankAccountType)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="corrente">Corrente</option>
              <option value="poupanca">Poupança</option>
              <option value="caixa">Caixa</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Agência</label>
            <input
              value={agencia}
              onChange={(e) => setAgencia(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Número da conta</label>
            <input
              value={numeroConta}
              onChange={(e) => setNumeroConta(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Saldo inicial</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Limpar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium">Buscar</label>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full rounded-xl border px-3 py-2 outline-none"
          placeholder="Banco, conta, agência ou número"
        />
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando contas bancárias...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma conta bancária cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Banco</th>
                  <th className="px-4 py-3 font-medium">Conta</th>
                  <th className="px-4 py-3 font-medium">Agência</th>
                  <th className="px-4 py-3 font-medium">Número</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Saldo inicial</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3">{item.banco}</td>
                    <td className="px-4 py-3">{item.nomeConta}</td>
                    <td className="px-4 py-3">{item.agencia || "-"}</td>
                    <td className="px-4 py-3">{item.numeroConta || "-"}</td>
                    <td className="px-4 py-3">{item.tipo}</td>
                    <td className="px-4 py-3">
                      {Number(item.saldoInicial).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}