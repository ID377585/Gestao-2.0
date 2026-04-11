'use client';

import { EntradaDocumento, Produto } from '@/lib/entradas/types';

interface Props {
  entradas: EntradaDocumento[];
  produtos: Produto[];
  loading?: boolean;
}

export default function EntradaDashboard({ entradas, produtos, loading }: Props) {
  const totalEntradas = entradas.length;
  const pendentes = entradas.filter((e) => e.status === 'pendente_vinculacao').length;
  const aguardandoA1 = entradas.filter((e) => e.status === 'aguardando_aprovacao_1').length;
  const aguardandoA2 = entradas.filter((e) => e.status === 'aguardando_aprovacao_2').length;
  const lancadas = entradas.filter((e) => e.status === 'lancada_estoque').length;

  const cards = [
    { label: 'Entradas', value: totalEntradas },
    { label: 'Pendentes de vinculação', value: pendentes },
    { label: 'Aguardando aprovação 1', value: aguardandoA1 },
    { label: 'Aguardando aprovação 2', value: aguardandoA2 },
    { label: 'Lançadas no estoque', value: lancadas },
    { label: 'Produtos cadastrados', value: produtos.length },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border p-4 shadow-sm">
          <div className="text-sm text-gray-500">{card.label}</div>
          <div className="mt-2 text-2xl font-bold">{loading ? '...' : card.value}</div>
        </div>
      ))}
    </div>
  );
}