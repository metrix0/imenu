export type CreditRates = {
  chatModel: string;
  imageModel: string;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
  imageUsdEstimate: number;
  outputRatio: number;
  maxInputTokens: number;
  maxImages: number;
  maxOutputTokens?: number;
  inputStep: number;
};

export type CreditQuote = {
  inputTokens: number;
  outputTokens: number;
  /** Output purchased alongside selected input at the configured ratio. */
  outputAllowanceTokens: number;
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

  const outputAllowanceTokens = Math.round(inputTokens * rates.outputRatio);
  // Each recharge purchases its full output allocation, regardless of unused plan output.
  const outputTokens = outputAllowanceTokens;
  if (outputTokens > (rates.maxOutputTokens ?? Number.MAX_SAFE_INTEGER)) {
    throw new Error("Quantidade de créditos inválida.");
  }
  const inputUsd = inputTokens / 1_000_000 * rates.inputUsdPerMillion;
  const outputUsd = outputTokens / 1_000_000 * rates.outputUsdPerMillion;
  const imagesUsd = images * rates.imageUsdEstimate;
  return {
    inputTokens,
    outputTokens,
    outputAllowanceTokens,
    images,
    inputUsd,
    outputUsd,
    imagesUsd,
    totalUsd: inputUsd + outputUsd + imagesUsd,
  };
}

/** Round the USD/BRL exchange rate up by at least R$ 0,50, then round the total up to cents. */
export function convertCreditCostToBrlCents(totalUsd: number, usdBrlRate: number): number {
  if (!Number.isFinite(totalUsd) || totalUsd < 0 || !Number.isFinite(usdBrlRate) || usdBrlRate <= 0) {
    throw new Error("Cotação indisponível.");
  }
  if (totalUsd === 0) return 0;
  const billingUsdBrlRate = Math.ceil(usdBrlRate + 0.50);
  return Math.ceil(totalUsd * billingUsdBrlRate * 100 - 1e-8);
}
