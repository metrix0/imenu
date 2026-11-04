import { LIMITS, MODELS } from "./config";
import type { CreditRates } from "./creditMath";

// Rates from https://developers.openai.com/api/docs/pricing (USD, standard API).
// Keep model prices in one place; an unknown configured model must not show an incorrect price.
const CHAT_RATES: Record<string, { input: number; output: number }> = {
  "gpt-5.6-luna": { input: 0.20, output: 1.20 },
  "gpt-5.6-terra": { input: 2.00, output: 12.00 },
  "gpt-5.6-sol": { input: 4.00, output: 20.00 },
};

// Estimate per 1024px low-quality output. Actual costs vary with dimensions,
// input images and prompt tokens (image edits may cost more).
// https://developers.openai.com/api/docs/guides/image-generation
const IMAGE_RATES: Record<string, number> = {
  "gpt-image-2": 0.006,
  "gpt-image-2-2026-04-21": 0.006,
  "gpt-image-2.5-sunburst": 0.00588,
  "gpt-image-2.5-flare": 0.00588,
};

export function getCreditRates(): CreditRates | null {
  const chat = CHAT_RATES[MODELS.chat];
  const image = IMAGE_RATES[MODELS.image];
  if (!chat || image == null) return null;
  return {
    chatModel: MODELS.chat,
    imageModel: MODELS.image,
    inputUsdPerMillion: chat.input,
    outputUsdPerMillion: chat.output,
    imageUsdEstimate: image,
    outputRatio: LIMITS.monthlyChatOutput / LIMITS.monthlyChatInput,
    maxInputTokens: 10_000_000,
    maxImages: 150,
    inputStep: 100_000,
  };
}
