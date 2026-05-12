"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getSupplierById, updateSupplier } from "@/lib/compras/suppliers";
import { formatCep, formatCnpj, formatPhone } from "@/lib/formatters";
import type { Supplier } from "@/types/compras";

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

type SupplierForm = {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  contato: string;
  telefone: string;
  telefone2: string;
  email: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  cidade: string;
  estado: string;
  uf: string;
  observacoes: string;
  ativo: boolean;
};

const emptyForm: SupplierForm = {
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
};

export default function EditarFornecedorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supplierId = params.id;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateField<K extends keyof SupplierForm>(
    field: K,
    value: SupplierForm[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const data = await getSupplierById(supplierId);

      if (!data) {
        setError("Fornecedor não encontrado.");
        return;
      }

      setSupplier(data);

      setForm({
        razaoSocial: data.razaoSocial || "",
        nomeFantasia: data.nomeFantasia || "",
        cnpj: formatCnpj(data.cnpj || ""),
        contato: data.contato || "",
        telefone: formatPhone(data.telefone || ""),
        telefone2: formatPhone(data.telefone2 || ""),
        email: data.email || "",
        endereco: data.endereco || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        cep: formatCep(data.cep || ""),
        cidade: data.cidade || "",
        estado: data.estado || "",
        uf: data.uf || "",
        observacoes: data.observacoes || "",
        ativo: data.ativo ?? true,
      });
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar os dados do fornecedor.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.razaoSocial.trim()) {
      setError("Informe a razão social do fornecedor.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      await updateSupplier(supplierId, {
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
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Não foi possível atualizar o fornecedor.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (supplierId) {
      loadData();
    }
  }, [supplierId]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Carregando fornecedor...</p>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-red-600">
          {error || "Fornecedor não encontrado."}
        </p>

        <Link
          href="/compras/fornecedores"
          className="inline-flex rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
        >
          Voltar para fornecedores
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Editar fornecedor</h1>
          <p className="text-sm text-gray-500">
            Atualize os dados cadastrais de {supplier.razaoSocial}.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/compras/fornecedores/${supplier.id}`}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Abrir ficha
          </Link>

          <Link
            href="/compras/fornecedores"
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            Voltar
          </Link>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Razão social *
            </label>
            <input
              value={form.razaoSocial}
              onChange={(e) => updateField("razaoSocial", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="Razão social do fornecedor"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Nome fantasia
            </label>
            <input
              value={form.nomeFantasia}
              onChange={(e) => updateField("nomeFantasia", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="Nome fantasia"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">CNPJ</label>
            <input
              value={form.cnpj}
              onChange={(e) => updateField("cnpj", formatCnpj(e.target.value))}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
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
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
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
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
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
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
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
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="email@fornecedor.com"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Status</label>
            <select
              value={form.ativo ? "ativo" : "inativo"}
              onChange={(e) => updateField("ativo", e.target.value === "ativo")}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
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
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="Rua / Avenida"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Nº</label>
            <input
              value={form.numero}
              onChange={(e) => updateField("numero", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="Número"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Complemento</label>
            <input
              value={form.complemento}
              onChange={(e) => updateField("complemento", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="Sala, bloco, referência..."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Bairro</label>
            <input
              value={form.bairro}
              onChange={(e) => updateField("bairro", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="Bairro"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">CEP</label>
            <input
              value={form.cep}
              onChange={(e) => updateField("cep", formatCep(e.target.value))}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
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
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="Ex.: São Paulo"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Estado</label>
            <input
              value={form.estado}
              onChange={(e) => updateField("estado", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="Ex.: São Paulo"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">UF</label>
            <select
              value={form.uf}
              onChange={(e) => updateField("uf", e.target.value)}
              className="w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
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
              className="min-h-[120px] w-full rounded-xl border px-3 py-2 outline-none focus:border-black"
              placeholder="Informações adicionais sobre o fornecedor"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => router.push("/compras/fornecedores")}
            disabled={saving}
            className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}
