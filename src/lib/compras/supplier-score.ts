export type SupplierScoreInput = {
  totalPedidos: number;
  totalEntradas?: number;
  valorTotalComprado: number;
  recebimentosComDivergencia: number;
  totalRecebimentos: number;
  leadTimeMedio: number;
};

export type SupplierScoreSeal = "excelente" | "bom" | "atencao" | "critico";

export type SupplierScoreResult = {
  score: number;
  selo: SupplierScoreSeal;
  scorePrazo: number;
  scoreDivergencia: number;
  scoreVolume: number;
  scoreRecorrencia: number;
  semHistorico: boolean;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function computeLeadTimeScore(leadTimeMedio: number, semHistorico: boolean) {
  if (semHistorico) return 100;
  if (leadTimeMedio <= 0) return 100;
  if (leadTimeMedio <= 3) return 100;
  if (leadTimeMedio <= 7) return 85;
  if (leadTimeMedio <= 15) return 70;
  if (leadTimeMedio <= 30) return 50;
  return 25;
}

function computeDivergenceScore(
  recebimentosComDivergencia: number,
  totalRecebimentos: number,
  semHistorico: boolean
) {
  if (semHistorico) return 100;
  if (totalRecebimentos <= 0) return 100;

  const taxa = recebimentosComDivergencia / totalRecebimentos;

  if (taxa === 0) return 100;
  if (taxa <= 0.1) return 85;
  if (taxa <= 0.2) return 70;
  if (taxa <= 0.35) return 45;
  return 20;
}

function computeVolumeScore(valorTotalComprado: number, semHistorico: boolean) {
  if (semHistorico) return 100;
  if (valorTotalComprado >= 100000) return 100;
  if (valorTotalComprado >= 50000) return 90;
  if (valorTotalComprado >= 20000) return 85;
  if (valorTotalComprado >= 10000) return 80;
  if (valorTotalComprado >= 5000) return 75;
  if (valorTotalComprado > 0) return 70;
  return 100;
}

function computeRecurrenceScore(totalOperacoes: number, semHistorico: boolean) {
  if (semHistorico) return 100;
  if (totalOperacoes >= 20) return 100;
  if (totalOperacoes >= 10) return 90;
  if (totalOperacoes >= 5) return 85;
  if (totalOperacoes >= 2) return 80;
  if (totalOperacoes >= 1) return 75;
  return 100;
}

function computeSeal(
  score: number,
  semHistorico: boolean
): SupplierScoreResult["selo"] {
  if (semHistorico) return "bom";
  if (score >= 85) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 50) return "atencao";
  return "critico";
}

export function calculateSupplierScore(
  input: SupplierScoreInput
): SupplierScoreResult {
  const totalPedidos = Number(input.totalPedidos || 0);
  const totalEntradas = Number(input.totalEntradas || 0);
  const totalRecebimentos = Number(input.totalRecebimentos || 0);
  const valorTotalComprado = Number(input.valorTotalComprado || 0);
  const recebimentosComDivergencia = Number(
    input.recebimentosComDivergencia || 0
  );
  const leadTimeMedio = Number(input.leadTimeMedio || 0);

  const totalOperacoes = totalPedidos + totalEntradas;

  const semHistorico =
    totalOperacoes === 0 &&
    totalRecebimentos === 0 &&
    valorTotalComprado === 0 &&
    recebimentosComDivergencia === 0;

  const scorePrazo = computeLeadTimeScore(leadTimeMedio, semHistorico);

  const scoreDivergencia = computeDivergenceScore(
    recebimentosComDivergencia,
    totalRecebimentos,
    semHistorico
  );

  const scoreVolume = computeVolumeScore(valorTotalComprado, semHistorico);

  const scoreRecorrencia = computeRecurrenceScore(
    totalOperacoes,
    semHistorico
  );

  const weighted =
    scorePrazo * 0.3 +
    scoreDivergencia * 0.35 +
    scoreVolume * 0.2 +
    scoreRecorrencia * 0.15;

  const score = clamp(weighted);

  return {
    score,
    selo: computeSeal(score, semHistorico),
    scorePrazo,
    scoreDivergencia,
    scoreVolume,
    scoreRecorrencia,
    semHistorico,
  };
}