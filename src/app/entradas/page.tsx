'use client';

import { useEffect, useMemo, useState } from 'react';
import { parseXmlBatch } from '@/lib/entradas/xmlParser';
import { processarMatchingEntrada } from '@/lib/entradas/matching';
import { listarEntradas, listarProdutos, salvarEntrada } from '@/lib/entradas/repository';
import { gerarRelatorioCategoriaSku } from '@/lib/entradas/reports';
import { EntradaDocumento, Produto } from '@/lib/entradas/types';
import UploadXmlLote from './components/UploadXmlLote';
import EntradaDashboard from './components/EntradaDashboard';
import RelatorioCategoriaSku from './components/RelatorioCategoriaSku';
import HistoricoCustoMedio from './components/HistoricoCustoMedio';
import PdfDanfeAssistido from './components/PdfDanfeAssistido';

export default function EntradasPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [entradas, setEntradas] = useState<EntradaDocumento[]>([]);
  const [loading, setLoading] = useState(false);

  async function carregarDados() {
    setLoading(true);
    try {
      const [produtosData, entradasData] = await Promise.all([
        listarProdutos(),
        listarEntradas(),
      ]);
      setProdutos(produtosData);
      setEntradas(entradasData);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarDados();
  }, []);

  async function handleXmlUpload(files: File[]) {
    setLoading(true);
    try {
      const parsed = await parseXmlBatch(files);

      for (const entrada of parsed) {
        const itensProcessados = processarMatchingEntrada(entrada.itens, produtos);
        const temPendencia = itensProcessados.some((i) => i.precisaVinculacaoManual);

        const payload: EntradaDocumento = {
          ...entrada,
          itens: itensProcessados,
          status: temPendencia
            ? 'pendente_vinculacao'
            : 'aguardando_aprovacao_1',
        };

        await salvarEntrada(payload);
      }

      await carregarDados();
    } finally {
      setLoading(false);
    }
  }

  const relatorio = useMemo(() => {
    return gerarRelatorioCategoriaSku(entradas, produtos);
  }, [entradas, produtos]);

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">ENTRADAS V4</h1>

      <EntradaDashboard entradas={entradas} produtos={produtos} loading={loading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <UploadXmlLote onUpload={handleXmlUpload} loading={loading} />
        <PdfDanfeAssistido />
      </div>

      <RelatorioCategoriaSku rows={relatorio} />
      <HistoricoCustoMedio produtos={produtos} />
    </div>
  );
}