"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listSuppliers, toggleSupplierStatus } from "@/lib/compras/suppliers";
import type { Supplier } from "@/types/compras";

export default function FornecedoresPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");
      const data = await listSuppliers();
      setSuppliers(data);
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os fornecedores.");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleStatus(item: Supplier) {
    try {
      await toggleSupplierStatus(item.id, !item.ativo);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Não foi possível alterar o status do fornecedor.");
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fornecedores</h1>
          <p className="text-sm text-gray-500">
            Cadastre e gerencie os fornecedores do módulo de compras.
          </p>
        </div>

        <Link
          href="/compras/fornecedores/novo"
          className="inline-flex items-center justify-center rounded-xl bg-black px-4 py-2 text-sm font-medium text-white"
        >
          Novo fornecedor
        </Link>
      </div>

      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando fornecedores...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-gray-500">
            Nenhum fornecedor cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="px-4 py-3 font-medium">Razão social</th>
                  <th className="px-4 py-3 font-medium">Contato</th>
                  <th className="px-4 py-3 font-medium">Telefone</th>
                  <th className="px-4 py-3 font-medium">E-mail</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.razaoSocial}</div>
                      {item.nomeFantasia ? (
                        <div className="text-xs text-gray-500">
                          {item.nomeFantasia}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{item.contato || "-"}</td>
                    <td className="px-4 py-3">{item.telefone || "-"}</td>
                    <td className="px-4 py-3">{item.email || "-"}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          item.ativo
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-700"
                        }`}
                      >
                        {item.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        {item.ativo ? "Inativar" : "Ativar"}
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