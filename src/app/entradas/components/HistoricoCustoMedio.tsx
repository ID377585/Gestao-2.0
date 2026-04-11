'use client';

import { useEffect, useState } from 'react';
import { Produto, HistoricoCustoProduto } from '@/lib/entradas/types';
import { listarHistoricoCustoPorProduto } from '@/lib/entradas/repository';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  produtos: Produto[];
}

export default function HistoricoCustoMedio({ produtos }: Props) {
  const [produtoId, setProdutoId] = useState('');
  const [historico, setHistorico] = useState<HistoricoCustoProduto[]>([]);

  useEffect(() => {
    async function load() {
      if (!produtoId) {
        setHistorico([]);
        return;
      }
      const data = await listarHistoricoCustoPorProduto(produtoId);
      setHistorico(data);
    }
    load();
  }, [produtoId]);

  const chartData = historico.map((item) => ({
    data: new Date(item.data).toLocaleDateString('pt-BR'),
    custo: Number(item.custoUnitario.toFixed(4)),
  }));

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Dashboard de custo médio histórico</h2>

      <select
        value={produtoId}
        onChange={(e) => setProdutoId(e.target.value)}
        className="mb-4 rounded-xl border px-3 py-2"
      >
        <option value="">Selecione um produto</option>
        {produtos.map((produto) => (
          <option key={produto.id} value={produto.id}>
            {produto.nome} - {produto.sku}
          </option>
        ))}
      </select>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="data" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="custo" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}