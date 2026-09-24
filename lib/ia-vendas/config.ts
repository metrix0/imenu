// Server-only budgets. The addon remains free while being tested; no billing or trial.
export const MODELS = {
  chat: process.env.IA_VENDAS_CHAT_MODEL || "gpt-5.6-luna",
  analysis: process.env.IA_VENDAS_ANALYSIS_MODEL || "gpt-5.6-sol",
  image: process.env.IA_VENDAS_IMAGE_MODEL || "gpt-image-1.5",
};
export const LIMITS = {
  input: 1_850_000,
  output: 156_000,
  images: 12,
  runInput: 100_000,
  chatOutput: 6_000,
  analysisOutput: 12_000,
  attachments: 3,
  fileBytes: 8_388_608,
  monthlyFileBytes: 104_857_600,
  operations: 20,
  actions: 15,
  cooldownDays: 14,
};
export const PRIVATE_BUCKET = "ia-vendas-private";
