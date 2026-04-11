'use client';

import { atualizarEntrada } from '@/lib/entradas/repository';
import { EntradaDocumento } from '@/lib/entradas/types';
import { nowIso } from '@/lib/entradas/utils';

interface Props {
  entrada: EntradaDocumento;
  usuario: string;
  onUpdated?: () => Promise<void> | void;
}

export default function AprovacaoEtapas({ entrada, usuario, onUpdated }: Props) {
  async function aprovarEtapa1() {
    if (!entrada.id) return;
    await atualizarEntrada(entrada.id, {
      etapaAprovacao1: {
        aprovado: true,
        aprovadoPor: usuario,
        aprovadoEm: nowIso(),
        observacao: 'Conferência inicial concluída.',
      },
      status: 'aguardando_aprovacao_2',
      atualizadoEm: nowIso(),
    });
    await onUpdated?.();
  }

  async function aprovarEtapa2() {
    if (!entrada.id) return;
    await atualizarEntrada(entrada.id, {
      etapaAprovacao2: {
        aprovado: true,
        aprovadoPor: usuario,
        aprovadoEm: nowIso(),
        observacao: 'Aprovação final para estoque.',
      },
      status: 'aprovada',
      atualizadoEm: nowIso(),
    });
    await onUpdated?.();
  }

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="text-lg font-semibold">Aprovação em duas etapas</h3>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={aprovarEtapa1}
          disabled={entrada.status !== 'aguardando_aprovacao_1'}
          className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          Aprovar etapa 1
        </button>

        <button
          type="button"
          onClick={aprovarEtapa2}
          disabled={entrada.status !== 'aguardando_aprovacao_2'}
          className="rounded-xl bg-green-600 px-4 py-2 text-white disabled:opacity-50"
        >
          Aprovar etapa 2
        </button>
      </div>
    </div>
  );
}