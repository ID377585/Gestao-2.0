"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createCostCenter,
  listCostCenters,
  updateCostCenter,
} from "@/lib/financeiro/cost-centers";
import type { CostCenter } from "@/types/compras";

export default function CentrosDeCustoPage() {
  const [items, setItems] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [editingId, setEditingId] = useState("");
  const [busca, setBusca] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await listCostCenters();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os centros de custo.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setCodigo("");
    setNome("");
    setDescricao("");
    setEditingId("");
  }

  async function handleSave() {
    if (!codigo || !nome) {
      alert("Preencha código e nome.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateCostCenter({
          id: editingId,
          codigo,
          nome,
          descricao,
          ativo: true,
        });
      } else {
        await createCostCenter({
          codigo,
          nome,
          descricao,
          ativo: true,
        });
      }

      resetForm();
      await loadData();
      alert("Centro de custo salvo com sucesso.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o centro de custo.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item: CostCenter) {
    setEditingId(item.id);
    setCodigo(item.codigo);
    setNome(item.nome);
    setDescricao(item.descricao ?? "");
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (!busca) return true;

      const term = busca.toLowerCase();
      return (
        item.codigo.toLowerCase().includes(term) ||
        item.nome.toLowerCase().includes(term) ||
        (item.descricao ?? "").toLowerCase().includes(term)
      );
    });
  }, [items, busca]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Centros de Custo</h1>
        <p className="text-sm text-gray-500">
          Cadastre as áreas responsáveis por custos e despesas.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? "Editar centro de custo" : "Novo centro de custo"}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Código</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
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
        <div>
          <label className="mb-1 block text-sm font-medium">Buscar</label>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-xl border px-3 py-2 outline-none"
            placeholder="Código, nome ou descrição"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando centros de custo...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum centro de custo cadastrado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Nome</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3">{item.codigo}</td>
                    <td className="px-4 py-3">{item.nome}</td>
                    <td className="px-4 py-3">{item.descricao || "-"}</td>
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