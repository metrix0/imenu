export type CreditRates = {
  chatModel: string;
  imageModel: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  imageUsdEstimate: number;
  outputRatio: number;
  maxInputTokens: number;
  maxImages: number;
  inputStep: number;
};

export type CreditQuote = {
  inputTokens: number;
  outputTokens: number;
  images: number;
  inputUsd: number;
  outputUsd: number;
  imagesUsd: number;
  totalUsd: number;
};

export function calculateCreditQuote(
  rates: CreditRates,
  inputTokens: number,
  images: number,
): CreditQuote {
  if (
    !Number.isSafeInteger(inputTokens) ||
    inputTokens < 0 ||
    inputTokens > rates.maxInputTokens ||
    inputTokens % rates.inputStep !== 0 ||
    !Number.isSafeInteger(images) ||
    images < 0 ||
    images > rates.maxImages
  ) {
    throw new Error("Quantidade de créditos inválida.");
  }

  const outputTokens = Math.round(inputTokens * rates.outputRatio);
  const inputUsd = inputTokens / 1_000_000 * rates.inputUsdPerMillion;
  const outputUsd = outputTokens / 1_000_000 * rates.outputUsdPerMillion;
  const imagesUsd = images * rates.imageUsdEstimate;
  return {
    inputTokens,
    outputTokens,
    images,
    inputUsd,
    outputUsd,
    imagesUsd,
    totalUsd: inputUsd + outputUsd + imagesUsd,
  };
}

/** Round upward to the nearest R$ 0,50 (up to R$ 0,49 above converted cost). */
export function convertCreditCostToBrlCents(totalUsd: number, usdBrlRate: number): number {
  if (!Number.isFinite(totalUsd) || totalUsd < 0 || !Number.isFinite(usdBrlRate) || usdBrlRate <= 0) {
    throw new Error("Cotação indisponível.");
  }
  if (totalUsd === 0) return 0;
  return Math.ceil((totalUsd * usdBrlRate * 100 - 1e-8) / 50) * 50;
}
