"use client";

import { useEffect, useMemo, useState } from "react";
import {
  createFinancialCategory,
  listFinancialCategories,
  updateFinancialCategory,
} from "@/lib/financeiro/financial-categories";
import type { FinancialCategory, FinancialAccountType } from "@/types/compras";

export default function PlanoDeContasPage() {
  const [items, setItems] = useState<FinancialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [codigo, setCodigo] = useState("");
  const [grupo, setGrupo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [subcategoria, setSubcategoria] = useState("");
  const [tipo, setTipo] = useState<FinancialAccountType>("despesa");

  const [editingId, setEditingId] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | FinancialAccountType>("todos");
  const [busca, setBusca] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await listFinancialCategories();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar o plano de contas.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setCodigo("");
    setGrupo("");
    setCategoria("");
    setSubcategoria("");
    setTipo("despesa");
    setEditingId("");
  }

  async function handleSave() {
    if (!codigo || !grupo || !categoria) {
      alert("Preencha código, grupo e categoria.");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateFinancialCategory({
          id: editingId,
          codigo,
          grupo,
          categoria,
          subcategoria,
          tipo,
          ativo: true,
        });
      } else {
        await createFinancialCategory({
          codigo,
          grupo,
          categoria,
          subcategoria,
          tipo,
          ativo: true,
        });
      }

      resetForm();
      await loadData();
      alert("Plano de contas salvo com sucesso.");
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o plano de contas.");
    } finally {
      setSaving(false);
    }
  }

  function handleEdit(item: FinancialCategory) {
    setEditingId(item.id);
    setCodigo(item.codigo);
    setGrupo(item.grupo);
    setCategoria(item.categoria);
    setSubcategoria(item.subcategoria ?? "");
    setTipo(item.tipo);
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const tipoOk = filtroTipo === "todos" || item.tipo === filtroTipo;
      const buscaOk =
        !busca ||
        item.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        item.grupo.toLowerCase().includes(busca.toLowerCase()) ||
        item.categoria.toLowerCase().includes(busca.toLowerCase()) ||
        (item.subcategoria ?? "").toLowerCase().includes(busca.toLowerCase());

      return tipoOk && buscaOk;
    });
  }, [items, filtroTipo, busca]);

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Plano de Contas</h1>
        <p className="text-sm text-gray-500">
          Cadastre grupos, categorias e subcategorias financeiras.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? "Editar conta" : "Nova conta"}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div>
            <label className="mb-1 block text-sm font-medium">Código</label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Grupo</label>
            <input
              value={grupo}
              onChange={(e) => setGrupo(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Categoria</label>
            <input
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Subcategoria</label>
            <input
              value={subcategoria}
              onChange={(e) => setSubcategoria(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as FinancialAccountType)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
              <option value="custo">Custo</option>
            </select>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Filtrar por tipo</label>
            <select
              value={filtroTipo}
              onChange={(e) =>
                setFiltroTipo(e.target.value as "todos" | FinancialAccountType)
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="receita">Receita</option>
              <option value="despesa">Despesa</option>
              <option value="custo">Custo</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Buscar</label>
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Código, grupo, categoria ou subcategoria"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando plano de contas...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma conta cadastrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Código</th>
                  <th className="px-4 py-3 font-medium">Grupo</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Subcategoria</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3">{item.codigo}</td>
                    <td className="px-4 py-3">{item.grupo}</td>
                    <td className="px-4 py-3">{item.categoria}</td>
                    <td className="px-4 py-3">{item.subcategoria || "-"}</td>
                    <td className="px-4 py-3">{item.tipo}</td>
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