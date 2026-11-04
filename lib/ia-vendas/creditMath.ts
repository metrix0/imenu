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
  /** Existing output tokens the recharge can reuse without buying twice. */
  availableOutputTokens?: number;
  inputStep: number;
};

export type CreditQuote = {
  inputTokens: number;
  outputTokens: number;
  /** Total output supported by the selected input (existing + newly added). */
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
  // Reuse output still available in the plan. Only sell the missing credits.
  const outputTokens = Math.max(0, outputAllowanceTokens - (rates.availableOutputTokens ?? 0));
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

/** Charge at least R$ 0,50 above the converted cost; round only to the next cent. */
export function convertCreditCostToBrlCents(totalUsd: number, usdBrlRate: number): number {
  if (!Number.isFinite(totalUsd) || totalUsd < 0 || !Number.isFinite(usdBrlRate) || usdBrlRate <= 0) {
    throw new Error("Cotação indisponível.");
  }
  if (totalUsd === 0) return 0;
  return Math.ceil((totalUsd * usdBrlRate + 0.50) * 100 - 1e-8);
}
