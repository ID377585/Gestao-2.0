"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupplier } from "@/lib/compras/suppliers";
import { formatCep, formatCnpj, formatPhone } from "@/lib/formatters";

const UF_OPTIONS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

export default function NovoFornecedorPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    razaoSocial: "",
    nomeFantasia: "",
    cnpj: "",
    contato: "",
    telefone: "",
    telefone2: "",
    email: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cep: "",
    cidade: "",
    estado: "",
    uf: "",
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
        razaoSocial: form.razaoSocial.trim(),
        nomeFantasia: form.nomeFantasia.trim(),
        cnpj: form.cnpj.trim(),
        contato: form.contato.trim(),
        telefone: form.telefone.trim(),
        telefone2: form.telefone2.trim(),
        email: form.email.trim(),
        endereco: form.endereco.trim(),
        numero: form.numero.trim(),
        complemento: form.complemento.trim(),
        bairro: form.bairro.trim(),
        cep: form.cep.trim(),
        cidade: form.cidade.trim(),
        estado: form.estado.trim(),
        uf: form.uf.trim(),
        observacoes: form.observacoes.trim(),
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
    <div className="max-w-5xl space-y-6 p-6">
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
              onChange={(e) => updateField("cnpj", formatCnpj(e.target.value))}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Digite o CNPJ"
              inputMode="numeric"
              autoComplete="off"
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
              onChange={(e) =>
                updateField("telefone", formatPhone(e.target.value))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Digite o telefone"
              inputMode="numeric"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Telefone 2</label>
            <input
              value={form.telefone2}
              onChange={(e) =>
                updateField("telefone2", formatPhone(e.target.value))
              }
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Digite o telefone 2"
              inputMode="numeric"
              autoComplete="off"
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
              placeholder="Rua / Avenida"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Nº</label>
            <input
              value={form.numero}
              onChange={(e) => updateField("numero", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Número"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Complemento</label>
            <input
              value={form.complemento}
              onChange={(e) => updateField("complemento", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Sala, bloco, referência..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Bairro</label>
            <input
              value={form.bairro}
              onChange={(e) => updateField("bairro", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Bairro"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">CEP</label>
            <input
              value={form.cep}
              onChange={(e) => updateField("cep", formatCep(e.target.value))}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Digite o CEP"
              inputMode="numeric"
              autoComplete="off"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Cidade</label>
            <input
              value={form.cidade}
              onChange={(e) => updateField("cidade", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Ex.: São Paulo"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Estado</label>
            <input
              value={form.estado}
              onChange={(e) => updateField("estado", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
              placeholder="Ex.: São Paulo"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">UF</label>
            <select
              value={form.uf}
              onChange={(e) => updateField("uf", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none"
            >
              <option value="">— Selecione —</option>
              {UF_OPTIONS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
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
