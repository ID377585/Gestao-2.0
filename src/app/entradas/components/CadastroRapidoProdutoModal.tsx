'use client';

import { useState } from 'react';
import { criarProduto } from '@/lib/entradas/repository';
import { Produto } from '@/lib/entradas/types';
import { generateSkuFromName, nowIso } from '@/lib/entradas/utils';

interface Props {
  nomeInicial?: string;
  unidadeInicial?: string;
  codigoFornecedorInicial?: string;
  eanInicial?: string;
  onCreated?: (produto: Produto & { id: string }) => void;
}

export default function CadastroRapidoProdutoModal({
  nomeInicial = '',
  unidadeInicial = 'UN',
  codigoFornecedorInicial = '',
  eanInicial = '',
  onCreated,
}: Props) {
  const [nome, setNome] = useState(nomeInicial);
  const [categoria, setCategoria] = useState('GERAL');
  const [unidade, setUnidade] = useState(unidadeInicial);
  const [codigoFornecedor, setCodigoFornecedor] = useState(codigoFornecedorInicial);
  const [ean, setEan] = useState(eanInicial);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    try {
      const payload: Produto = {
        nome,
        sku: generateSkuFromName(nome),
        codigoFornecedor,
        ean,
        categoria,
        unidade,
        estoqueAtual: 0,
        custoMedioAtual: 0,
        ativo: true,
        criadoEm: nowIso(),
        atualizadoEm: nowIso(),
      };

      const id = await criarProduto(payload);
      onCreated?.({ ...payload, id });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-lg font-semibold">Cadastro rápido de produto</h3>

      <div className="mt-4 grid gap-3">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome" className="rounded-xl border px-3 py-2" />
        <input value={categoria} onChange={(e) => setCategoria(e.target.value)} placeholder="Categoria" className="rounded-xl border px-3 py-2" />
        <input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="Unidade" className="rounded-xl border px-3 py-2" />
        <input value={codigoFornecedor} onChange={(e) => setCodigoFornecedor(e.target.value)} placeholder="Código fornecedor" className="rounded-xl border px-3 py-2" />
        <input value={ean} onChange={(e) => setEan(e.target.value)} placeholder="EAN" className="rounded-xl border px-3 py-2" />
      </div>

      <button
        type="button"
        onClick={salvar}
        disabled={saving || !nome}
        className="mt-4 rounded-xl bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {saving ? 'Salvando...' : 'Criar produto'}
      </button>
    </div>
  );
}