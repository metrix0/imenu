import { applyProposal } from "../application";
import { proposeImages } from "../images";
import { LIMITS } from "../config";
import { aiAccess } from "../access";
import { query, withTransaction } from "@/lib/database/sql";
import { saveFile, signedAttachment } from "../files";
import OpenAI from "openai";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/database/supabaseServerClient", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("../data", () => ({ imageUrl: jest.fn(), metrics: jest.fn() }));
jest.mock("../files", () => ({ saveFile: jest.fn(), signedAttachment: jest.fn() }));
jest.mock("openai", () => ({ __esModule: true, default: jest.fn(), toFile: jest.fn() }));

const restaurant = "11111111-1111-4111-8111-111111111111";
const conversation = "22222222-2222-4222-8222-222222222222";
const run = "33333333-3333-4333-8333-333333333333";
const proposal = "44444444-4444-4444-8444-444444444444";
const item = { id: "55555555-5555-4555-8555-555555555555", name: "Prato", price_cents: 1000, image_path: null };
const generate = jest.fn();
let actions: Map<string, any>, imageCount: number, statements: string[], plus: boolean;

beforeEach(() => {
  imageCount = 0;
  plus = false;
  statements = [];
  actions = new Map([[proposal, {
    id: proposal, restaurant_id: restaurant, conversation_id: conversation,
    status: "pending", attempts: 0, operations: [], generated_actions: [],
    image_jobs: [{ target: "item", item_id: item.id, prompt: "Foto aprovada" }],
  }]]);
  generate.mockReset().mockResolvedValue({ data: [{ b64_json: Buffer.from("fixture image").toString("base64") }] });
  (OpenAI as unknown as jest.Mock).mockImplementation(() => ({ images: { generate } }));
  (saveFile as jest.Mock).mockResolvedValue({ id: "66666666-6666-4666-8666-666666666666" });
  (signedAttachment as jest.Mock).mockResolvedValue({ url: "https://example.test/preview.webp" });
  (query as jest.Mock).mockImplementation(async (sql: string, params: any[] = []) => {
    statements.push(sql);
    if (sql.startsWith("SELECT * FROM public.ia_vendas_actions")) return { rows: [actions.get(params[1])].filter(Boolean) };
    if (sql.includes("SET status='applying'")) {
      const action = actions.get(params[0]);
      if (action?.status !== "pending") return { rows: [] };
      action.status = "applying"; action.attempts += 1;
      return { rows: [action] };
    }
    if (sql.includes("restaurant_addons")) return { rows: plus ? [{ status: "active" }] : [] };
    if (sql.includes("SELECT EXISTS")) return { rows: [{ used: false }] };
    if (sql.startsWith("SELECT kind")) return { rows: [{ kind: "chat" }] };
    if (sql.includes("sum(input_tokens + output_tokens)")) return { rows: [{ images: imageCount, tokens: 0 }] };
    if (sql.includes("sum(image_count),0) n")) return { rows: [{ n: imageCount }] };
    if (sql.startsWith("SELECT id FROM public.ia_vendas_runs"))
      return { rows: params[0] === restaurant && params[1] === run && params[2] === conversation ? [{ id: run }] : [] };
    if (sql.startsWith("SELECT 1 FROM public.ia_vendas_runs")) return { rows: [{}], rowCount: 1 };
    if (sql.includes("SET image_count=image_count+1")) {
      imageCount += 1;
      return { rows: [], rowCount: 1 };
    }
    if (sql.includes("SET image_count=greatest(image_count-1,0)")) {
      imageCount = Math.max(0, imageCount - 1);
      return { rows: [], rowCount: 1 };
    }
    if (sql.startsWith("SELECT id,name,image_path")) return { rows: [item] };
    if (sql.includes("SELECT t.*")) return { rows: [item] };
    if (sql.includes("count(*) n")) return { rows: [{ n: 0 }] };
    if (sql.startsWith("INSERT INTO public.ia_vendas_actions")) {
      const action = {
        id: params[6], restaurant_id: params[0], conversation_id: params[1],
        run_id: params[2], title: params[3], reason: params[4],
        operations: sql.includes("image_jobs") ? [] : JSON.parse(params[5]),
        image_jobs: sql.includes("image_jobs") ? JSON.parse(params[5]) : undefined,
        status: "pending", attempts: 0,
      };
      actions.set(action.id, action);
      return { rows: [action] };
    }
    if (sql.includes("SET generated_actions")) actions.get(params[1]).generated_actions = [...params[2]];
    if (sql.includes("SET status='applied'")) actions.get(params[1]).status = "applied";
    if (sql.includes("SET status='failed',error='O lote")) actions.get(params[1]).status = "failed";
    return { rows: [], rowCount: 0 };
  });
  (withTransaction as jest.Mock).mockImplementation(fn => fn({ query }));
});

test("chat-approved generation reuses its running chat, preserves image quotas and returns unpublished previews", async () => {
  const applied = await applyProposal(restaurant, proposal, conversation, "generate", run);
  expect(applied.status).toBe("applied");
  expect(applied.generated_actions).toHaveLength(1);
  const preview = actions.get(applied.generated_actions![0]);
  expect(preview).toMatchObject({ status: "pending", run_id: run, conversation_id: conversation });
  expect(imageCount).toBe(1);
  expect(generate).toHaveBeenCalledTimes(1);
  expect(statements.some(sql => sql.startsWith("INSERT INTO public.ia_vendas_runs"))).toBe(false);
  expect(statements.some(sql => sql.startsWith("UPDATE public.ia_vendas_runs SET status="))).toBe(false);
  expect(statements.some(sql => sql.startsWith("UPDATE public.items"))).toBe(false);
  expect((await aiAccess(restaurant)).free_applications_remaining).toBe(1);
});

test("without an existing chat run the separate image run still respects the active-run guard", async () => {
  await expect(applyProposal(restaurant, proposal, conversation, "generate"))
    .rejects.toThrow("Aguarde a resposta em andamento.");
  expect(generate).not.toHaveBeenCalled();
});

test("an unrelated run cannot be reused for image approval", async () => {
  await expect(applyProposal(restaurant, proposal, conversation, "generate", "77777777-7777-4777-8777-777777777777"))
    .rejects.toThrow("Conversa em processamento não encontrada.");
  expect(generate).not.toHaveBeenCalled();
});

test("free users cannot start an existing batch exceeding three images", async () => {
  const action = actions.get(proposal);
  action.image_jobs.push(...Array.from({ length: 3 }, () => ({ ...action.image_jobs[0] })));
  await expect(applyProposal(restaurant, proposal, conversation, "generate", run))
    .rejects.toThrow("até 3 imagens por lote");
  expect(action.status).toBe("pending");
  expect(action.generated_actions).toHaveLength(0);
  expect(generate).not.toHaveBeenCalled();
  expect(imageCount).toBe(0);
});

test("free proposals accept three images but reject four before saving a batch", async () => {
  const job = { target: "item", item_id: item.id, prompt: "Foto aprovada" };
  await expect(proposeImages(restaurant, conversation, run, { jobs: [job, job, job, job] }))
    .rejects.toThrow("até 3 imagens por lote");
  expect(statements.some((sql) => sql.startsWith("INSERT INTO public.ia_vendas_actions"))).toBe(false);
  const proposed = await proposeImages(restaurant, conversation, run, { jobs: [job, job, job] });
  expect(proposed.image_jobs).toHaveLength(3);
});

test("iMenu Plus can still propose eight images per batch, but not nine", async () => {
  plus = true;
  const jobs = Array.from({ length: LIMITS.imageBatch }, () => ({
    target: "item", item_id: item.id, prompt: "Foto aprovada",
  }));
  const proposed = await proposeImages(restaurant, conversation, run, { jobs });
  expect(proposed.image_jobs).toHaveLength(LIMITS.imageBatch);
  await expect(proposeImages(restaurant, conversation, run, { jobs: [...jobs, jobs[0]] }))
    .rejects.toThrow("até 8 imagens por lote");
});

test("failed image generation releases its reserved quota", async () => {
  generate.mockRejectedValueOnce(new Error("Generation failed"));
  await expect(applyProposal(restaurant, proposal, conversation, "generate", run)).rejects.toThrow("Generation failed");
  expect(imageCount).toBe(0);
  expect(statements.some((sql) => sql.includes("SET image_count=greatest(image_count-1,0)"))).toBe(true);
});
