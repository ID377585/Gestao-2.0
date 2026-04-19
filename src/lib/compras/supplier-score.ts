type SupplierScoreInput = {
  totalPedidos: number;
  valorTotalComprado: number;
  recebimentosComDivergencia: number;
  totalRecebimentos: number;
  leadTimeMedio: number;
};

export type SupplierScoreResult = {
  score: number;
  selo: "excelente" | "bom" | "atencao" | "critico";
  scorePrazo: number;
  scoreDivergencia: number;
  scoreVolume: number;
  scoreRecorrencia: number;
};

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function computeLeadTimeScore(leadTimeMedio: number) {
  if (leadTimeMedio <= 3) return 100;
  if (leadTimeMedio <= 7) return 85;
  if (leadTimeMedio <= 15) return 70;
  if (leadTimeMedio <= 30) return 50;
  return 25;
}

function computeDivergenceScore(
  recebimentosComDivergencia: number,
  totalRecebimentos: number
) {
  if (totalRecebimentos <= 0) return 70;

  const taxa = recebimentosComDivergencia / totalRecebimentos;

  if (taxa === 0) return 100;
  if (taxa <= 0.1) return 85;
  if (taxa <= 0.2) return 70;
  if (taxa <= 0.35) return 45;
  return 20;
}

function computeVolumeScore(valorTotalComprado: number) {
  if (valorTotalComprado >= 100000) return 100;
  if (valorTotalComprado >= 50000) return 85;
  if (valorTotalComprado >= 20000) return 70;
  if (valorTotalComprado >= 5000) return 50;
  if (valorTotalComprado > 0) return 30;
  return 10;
}

function computeRecurrenceScore(totalPedidos: number) {
  if (totalPedidos >= 20) return 100;
  if (totalPedidos >= 10) return 85;
  if (totalPedidos >= 5) return 70;
  if (totalPedidos >= 2) return 45;
  if (totalPedidos >= 1) return 25;
  return 10;
}

function computeSeal(score: number): SupplierScoreResult["selo"] {
  if (score >= 85) return "excelente";
  if (score >= 70) return "bom";
  if (score >= 50) return "atencao";
  return "critico";
}

export function calculateSupplierScore(
  input: SupplierScoreInput
): SupplierScoreResult {
  const scorePrazo = computeLeadTimeScore(input.leadTimeMedio);
  const scoreDivergencia = computeDivergenceScore(
    input.recebimentosComDivergencia,
    input.totalRecebimentos
  );
  const scoreVolume = computeVolumeScore(input.valorTotalComprado);
  const scoreRecorrencia = computeRecurrenceScore(input.totalPedidos);

  const weighted =
    scorePrazo * 0.3 +
    scoreDivergencia * 0.35 +
    scoreVolume * 0.2 +
    scoreRecorrencia * 0.15;

  const score = clamp(Math.round(weighted));

  return {
    score,
    selo: computeSeal(score),
    scorePrazo,
    scoreDivergencia,
    scoreVolume,
    scoreRecorrencia,
  };
}