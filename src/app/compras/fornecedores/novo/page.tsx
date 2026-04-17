"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupplier } from "@/lib/compras/suppliers";

export default function NovoFornecedorPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    contato: "",
    telefone: "",
    email: "",
    endereco: "",
    observacoes: "",
    ativo: true,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField(field: string, value: string | boolean) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!form.razaoSocial.trim()) {
      setError("Informe a razão social do fornecedor.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await createSupplier({
        razaoSocial: form.razaoSocial,
        nomeFantasia: form.nomeFantasia,
        cnpj: form.cnpj,
        contato: form.contato,
        telefone: form.telefone,
        email: form.email,
        endereco: form.endereco,
        observacoes: form.observacoes,
        ativo: form.ativo,
      });

      router.push("/compras/fornecedores");
    } catch (err) {
      console.error(err);
      setError("Não foi possível salvar o fornecedor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Novo fornecedor</h1>
        <p className="text-sm text-gray-500">
          Preencha os dados para cadastrar um novo fornecedor.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Razão social *
            </label>
            <input
              value={form.razaoSocial}
              onChange={(e) => updateField("razaoSocial", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Digite a razão social"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Nome fantasia
            </label>
            <input
              value={form.nomeFantasia}
              onChange={(e) => updateField("nomeFantasia", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Digite o nome fantasia"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">CNPJ</label>
            <input
              value={form.cnpj}
              onChange={(e) => updateField("cnpj", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="00.000.000/0000-00"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Contato</label>
            <input
              value={form.contato}
              onChange={(e) => updateField("contato", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Nome do contato"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => updateField("telefone", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="(00) 00000-0000"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="email@fornecedor.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={form.ativo ? "ativo" : "inativo"}
              onChange={(e) => updateField("ativo", e.target.value === "ativo")}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Endereço</label>
            <input
              value={form.endereco}
              onChange={(e) => updateField("endereco", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Rua, número, bairro, cidade"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Observações
            </label>
            <textarea
              value={form.observacoes}
              onChange={(e) => updateField("observacoes", e.target.value)}
              className="min-h-[120px] w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Informações adicionais sobre o fornecedor"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar fornecedor"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/compras/fornecedores")}
            className="rounded-xl border px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}