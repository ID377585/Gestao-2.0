"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getFiscalCompanyProfileAction,
  saveFiscalCompanyProfileAction,
} from "./actions";

const DEFAULT_PROFILE = {
  razao_social: "FELICITA COMERCIO DE ALIMENTOS E BEBIDAS LTDA",
  nome_fantasia: "",
  cnpj: "63.001.508/0001-24",
  inscricao_estadual: "156170000110",
  telefone: "11 958218688",
  endereco: "RUA ADOLFO TABACOW",
  numero: "173",
  bairro: "ITAIM BIBI",
  cidade: "SÃO PAULO",
  uf: "SP",
  cep: "",
};

export default function FiscalCompanyProfilePage() {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(DEFAULT_PROFILE);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const profile = await getFiscalCompanyProfileAction();

      if (profile) {
        setForm({
          razao_social: profile.razao_social ?? DEFAULT_PROFILE.razao_social,
          nome_fantasia: profile.nome_fantasia ?? "",
          cnpj: profile.cnpj ?? DEFAULT_PROFILE.cnpj,
          inscricao_estadual: profile.inscricao_estadual ?? DEFAULT_PROFILE.inscricao_estadual,
          telefone: profile.telefone ?? DEFAULT_PROFILE.telefone,
          endereco: profile.endereco ?? DEFAULT_PROFILE.endereco,
          numero: profile.numero ?? DEFAULT_PROFILE.numero,
          bairro: profile.bairro ?? DEFAULT_PROFILE.bairro,
          cidade: profile.cidade ?? DEFAULT_PROFILE.cidade,
          uf: profile.uf ?? DEFAULT_PROFILE.uf,
          cep: profile.cep ?? "",
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const updateField = (field: keyof typeof DEFAULT_PROFILE, value: string) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = () => {
    const formData = new FormData();

    Object.entries(form).forEach(([key, value]) => {
      formData.append(key, value);
    });

    startTransition(async () => {
      try {
        await saveFiscalCompanyProfileAction(formData);
        alert("Dados fiscais salvos com sucesso.");
        await loadProfile();
      } catch (error: any) {
        console.error(error);
        alert(error?.message || "Erro ao salvar dados fiscais.");
      }
    });
  };

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dados Fiscais da Empresa</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre os dados fiscais usados na integração SEFAZ, NF-e, certificados e relatórios.
        </p>
      </div>

      <div className="border rounded-xl bg-card p-6 space-y-5">
        {loading && (
          <div className="text-sm text-muted-foreground">Carregando dados fiscais...</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Razão social</label>
            <input
              value={form.razao_social}
              onChange={(e) => updateField("razao_social", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Nome fantasia</label>
            <input
              value={form.nome_fantasia}
              onChange={(e) => updateField("nome_fantasia", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CNPJ</label>
            <input
              value={form.cnpj}
              onChange={(e) => updateField("cnpj", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Inscrição estadual</label>
            <input
              value={form.inscricao_estadual}
              onChange={(e) => updateField("inscricao_estadual", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => updateField("telefone", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Endereço</label>
            <input
              value={form.endereco}
              onChange={(e) => updateField("endereco", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Número</label>
            <input
              value={form.numero}
              onChange={(e) => updateField("numero", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Bairro</label>
            <input
              value={form.bairro}
              onChange={(e) => updateField("bairro", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cidade</label>
            <input
              value={form.cidade}
              onChange={(e) => updateField("cidade", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">UF</label>
            <input
              value={form.uf}
              onChange={(e) => updateField("uf", e.target.value.toUpperCase())}
              maxLength={2}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">CEP</label>
            <input
              value={form.cep}
              onChange={(e) => updateField("cep", e.target.value)}
              className="w-full border rounded-md px-3 py-2 bg-background"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm disabled:opacity-50"
          >
            {isPending ? "Salvando..." : "Salvar dados fiscais"}
          </button>
        </div>
      </div>
    </div>
  );
}
