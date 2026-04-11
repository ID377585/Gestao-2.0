'use client';

import { RelatorioCategoriaSkuRow } from '@/lib/entradas/types';
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface Props {
  rows: RelatorioCategoriaSkuRow[];
}

export default function RelatorioCategoriaSku({ rows }: Props) {
  const chartData = rows.slice(0, 10).map((row) => ({
    name: row.sku,
    valor: Number(row.valorTotalEntrada.toFixed(2)),
  }));

  return (
    <div className="rounded-2xl border p-4 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Relatório por categoria/SKU</h2>

      <div className="mb-6 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Categoria</th>
              <th className="py-2">SKU</th>
              <th className="py-2">Produto</th>
              <th className="py-2">Qtd.</th>
              <th className="py-2">Valor total</th>
              <th className="py-2">Custo médio</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.categoria}-${row.sku}`} className="border-b">
                <td className="py-2">{row.categoria}</td>
                <td className="py-2">{row.sku}</td>
                <td className="py-2">{row.produtoNome}</td>
                <td className="py-2">{row.quantidadeEntrada}</td>
                <td className="py-2">R$ {row.valorTotalEntrada.toFixed(2)}</td>
                <td className="py-2">R$ {row.custoMedioPeriodo.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="valor" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}