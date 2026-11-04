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
