import { runChat } from "../chat";
import { aiAccess, requireIaPlus, IaPlusRequired } from "../access";
jest.mock("../access", () => ({ ...jest.requireActual("../access"), aiAccess: jest.fn().mockResolvedValue({ plus: true }), requireIaPlus: jest.fn() }));
import { DIMENSIONS } from "../report";
import { query, withTransaction } from "@/lib/database/sql";
import { context, measure } from "../data";
import { beginRun, recordTokens, finishRun } from "../runs";
import { propose } from "../actions";
import { analysisPhotos } from "../images";
import OpenAI from "openai";
import { batchResponse, readBatch, saveToolResult, BatchPending } from "../batch";
jest.mock("../batch", () => ({ ...jest.requireActual("../batch"), batchResponse: jest.fn(), readBatch: jest.fn(), saveToolResult: jest.fn() }));
jest.mock("openai", () => jest.fn());
jest.mock("@/lib/analytics/posthogConsumer", () => ({
  loadPostHogConsumerMetrics: jest.fn().mockResolvedValue({ available: false }),
}));
jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("../data", () => ({
  ...jest.requireActual("../data"),
  context: jest.fn(),
  measure: jest.fn(),
  readData: jest.fn(),
  metrics: jest.fn(),
}));
jest.mock("../runs", () => ({
  beginRun: jest.fn(),
  recordTokens: jest.fn(),
  finishRun: jest.fn(),
}));
jest.mock("../actions", () => ({ propose: jest.fn() }));
jest.mock("../images", () => ({
  previewImage: jest.fn(),
  proposeImages: jest.fn(),
  analysisPhotos: jest.fn(),
}));
jest.mock("../files", () => ({ download: jest.fn() }));
jest.mock("../peers", () => ({
  benchmark: jest.fn().mockResolvedValue({ available: false }),
  potential: jest.fn(),
}));
const create = jest.fn();
const args = {
  restaurant: "owner",
  conversation: "conversation",
  run: "run",
  text: "Analisar minhas vendas",
  attachments: [],
  deep: true,
  immediate: true,
  send: jest.fn(),
};
const result = () => ({
  headline: "Bebidas",
  summary: "Melhore o carrinho",
  inspection: Object.fromEntries(
    DIMENSIONS.map((d) => [d, { status: "inspected", note: "Verificado" }]),
  ),
  opportunities: [],
  review_items: [],
});
beforeEach(() => {
  (analysisPhotos as jest.Mock).mockReset().mockResolvedValue([]);
  create.mockReset();
  (batchResponse as jest.Mock).mockReset();
  (readBatch as jest.Mock).mockResolvedValue({});
  (saveToolResult as jest.Mock).mockResolvedValue(undefined);
  (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
    responses: { create },
  }));
  (beginRun as jest.Mock).mockResolvedValue(null);
  (query as jest.Mock).mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT * FROM public.ia_vendas_conversations")
      ? [{ kind: "analysis", summary: "OLD TRANSCRIPT" }]
      : sql.includes("RETURNING id")
        ? [{ id: "user" }]
        : sql.includes("SELECT id,run_id,title,reason")
          ? [
              {
                id: "proposal",
                run_id: "run",
                title: "Bebidas",
                reason: "Venda adicional",
              },
            ]
          : [],
  }));
  (withTransaction as jest.Mock).mockImplementation((fn) =>
    fn({ query: jest.fn().mockResolvedValue({ rows: [{ status: "running", locked: true }] }) }),
  );
  (context as jest.Mock).mockResolvedValue({
    restaurant: { url_slug: "menu" },
    items: {
      rows: Array.from({ length: 97 }, (_, i) => ({ id: `item-${i}` })),
    },
    entities: {
      items: {
        rows: Array.from({ length: 97 }, (_, i) => ({ id: `item-${i}` })),
      },
    },
    actions: [],
    coverage: { items: { loaded: 97, total: 97, complete: true } },
    sales: { start: "2026-09-01", end: "2026-09-29" },
    prior_analyses: [{ report: { headline: "previous structured" } }],
  });
  (measure as jest.Mock).mockResolvedValue({
    results: [{ id: "measured-action" }],
  });
  (propose as jest.Mock).mockResolvedValue({ id: "proposal", operations: [] });
});
test("deep analyst receives compact context while retaining coverage, measurement and structured history; report persists", async () => {
  create.mockResolvedValue({
    status: "completed",
    output: [],
    output_text: JSON.stringify(result()),
    usage: { input_tokens: 76210, output_tokens: 2914 },
  });
  await runChat(args);
  const request = create.mock.calls[0][0];
  expect(request.input[0].content).toContain("item-0");
  expect(request.input[0].content).not.toContain("item-96");
  expect(request.input[0].content).toContain('"loaded":97');
  expect(request.input[0].content).toContain("measured-action");
  expect(request.input[0].content).toContain("previous structured");
  expect(request.input[0].content).not.toContain("OLD TRANSCRIPT");
  expect(request.text.format.strict).toBe(true);
  expect(
    (query as jest.Mock).mock.calls.some(
      ([s]) => s.includes("LIMIT 18") || s.includes("SELECT title,summary"),
    ),
  ).toBe(false);
  expect((finishRun as jest.Mock).mock.calls.at(-1)[2].report.status).toBe(
    "complete",
  );
  expect((recordTokens as jest.Mock).mock.calls[0][4]).toMatchObject({
    round: 1,
    input_tokens: 76210,
    output_tokens: 2914,
  });
});
test("tools retain full results and reserve final synthesis inside the whole-run budget", async () => {
  create.mockResolvedValueOnce({
    status: "completed",
    output: [
      {
        type: "function_call",
        name: "propose_action",
        arguments: "{}",
        call_id: "call",
      },
    ],
    usage: { input_tokens: 45000, output_tokens: 2400 },
  });
  create.mockResolvedValueOnce({
    status: "completed",
    output: [],
    output_text: JSON.stringify(result()),
    usage: { input_tokens: 30000, output_tokens: 2500 },
  });
  await runChat(args);
  expect(create.mock.calls[0][0].max_output_tokens).toBeLessThanOrEqual(2500);
  expect(create.mock.calls[1][0].tool_choice).toBe("none");
  expect(create.mock.calls[1][0].max_output_tokens).toBeLessThanOrEqual(6000);
  expect(create.mock.calls[1][0].input).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "function_call_output",
        output: expect.stringContaining('"id":"proposal"'),
      }),
    ]),
  );
  expect(
    (finishRun as jest.Mock).mock.calls.at(-1)[2].report.review_items[0]
      .action_ids,
  ).toEqual(["proposal"]);
});
test("failed synthesis persists a partial report and proposals rather than losing the run", async () => {
  create.mockResolvedValueOnce({
    status: "completed",
    output: [
      {
        type: "function_call",
        name: "propose_action",
        arguments: "{}",
        call_id: "call",
      },
    ],
    usage: { input_tokens: 47313, output_tokens: 2000 },
  });
  create.mockRejectedValueOnce(new Error("provider failure"));
  await runChat(args);
  const finished = (finishRun as jest.Mock).mock.calls.at(-1);
  expect(finished[2].report.status).toBe("partial");
  expect(finished[2].report.review_items[0].action_ids).toEqual(["proposal"]);
  expect(finished[3]).toBeTruthy();
});

test("deep analysis never makes more than three model rounds", async () => {
  const toolResponse = (call: string) => ({
    status: "completed",
    output: [
      {
        type: "function_call",
        name: "propose_action",
        arguments: "{}",
        call_id: call,
      },
    ],
    usage: { input_tokens: 5000, output_tokens: 500 },
  });
  create
    .mockResolvedValueOnce(toolResponse("call-1"))
    .mockResolvedValueOnce(toolResponse("call-2"))
    .mockResolvedValueOnce({
      status: "completed",
      output: [],
      output_text: JSON.stringify(result()),
      usage: { input_tokens: 5000, output_tokens: 1000 },
    });
  await runChat(args);
  expect(create).toHaveBeenCalledTimes(3);
  expect(create.mock.calls[2][0].tool_choice).toBe("none");
});

test("deep analysis refuses another request once the whole-run input budget is exhausted", async () => {
  await runChat({
    ...args,
    resume: {
      ctx: {
        restaurant: { url_slug: "menu" },
        entities: { items: { rows: [] } },
        coverage: { items: { loaded: 0, total: 0, complete: true } },
        sales: { start: "2026-09-01", end: "2026-09-29", products: [] },
      },
      input: [{ role: "user", content: "Finalize" }],
      cards: [],
      userMessageId: "user",
      inputTokens: 85_000,
      outputTokens: 0,
      example: false,
      estimated: false,
      round: 1,
    },
  });
  expect(create).not.toHaveBeenCalled();
  expect((finishRun as jest.Mock).mock.calls.at(-1)[3]).toContain(
    "orçamento máximo",
  );
});

test("requesting analysis in contextual chat stays a normal chat run", async () => {
  create.mockResolvedValue({
    status: "completed",
    output: [],
    output_text: JSON.stringify({ reply: "Vamos conversar sobre o relatório.", summary: "" }),
    usage: { input_tokens: 100, output_tokens: 20 },
  });
  await runChat({ ...args, deep: false });
  expect(beginRun).toHaveBeenCalledWith("owner", "conversation", "run", "chat", undefined);
  expect(context).toHaveBeenCalledWith("owner", false);
  expect(analysisPhotos).not.toHaveBeenCalled();
  expect(create.mock.calls[0][0].text.format).toEqual({ type: "json_object" });
});

test.each([true, false])("deep photo inputs reach the model and survive Batch resume (immediate=%s)", async (immediate) => {
  const photo = { type: "input_image", image_url: "data:image/jpeg;base64,cGhvdG8=", detail: "high" };
  (analysisPhotos as jest.Mock).mockImplementation(async (ctx) => {
    ctx.coverage.image_photos = { loaded: 1, total: 1, complete: true };
    ctx.image_review = { loaded: 1, unavailable: 0, missing: 0, photos: [{ item_id: "item-96", status: "loaded" }] };
    return [{ type: "input_text", text: "Foto do item-96" }, photo];
  });
  const response = { status: "completed", output: [], output_text: JSON.stringify(result()), usage: { input_tokens: 1000, output_tokens: 100 } };
  if (immediate) create.mockResolvedValue(response);
  else (batchResponse as jest.Mock).mockRejectedValueOnce(new BatchPending());
  await runChat({ ...args, immediate });
  const request = immediate ? create.mock.calls[0][0] : (batchResponse as jest.Mock).mock.calls[0][3];
  expect(request.input.at(-1).content).toContainEqual(photo);
  expect(request.input[0].content).toContain('"image_review"');
  if (!immediate) {
    const checkpoint = structuredClone((batchResponse as jest.Mock).mock.calls[0][4]);
    expect(checkpoint.input.at(-1).content).toContainEqual(photo);
    (batchResponse as jest.Mock).mockResolvedValueOnce(response);
    await runChat({ ...args, immediate, resume: checkpoint });
    expect(analysisPhotos).toHaveBeenCalledTimes(1);
  }
  expect((finishRun as jest.Mock).mock.calls.at(-1)[2].report.coverage.image_photos.loaded).toBe(1);
});

test("default deep analysis queues Batch and resumes to persist a strict report without reloading context", async () => {
  (batchResponse as jest.Mock).mockRejectedValueOnce(new BatchPending());
  await runChat({ ...args, immediate: false });
  expect(create).not.toHaveBeenCalled();
  expect(finishRun).not.toHaveBeenCalled();
  expect(args.send).toHaveBeenCalledWith("queued", expect.objectContaining({ run_id: "run" }));
  const snapshot = structuredClone((batchResponse as jest.Mock).mock.calls[0][4]);
  expect(snapshot.ctx.entities.items.rows).toHaveLength(97);
  (batchResponse as jest.Mock).mockResolvedValueOnce({ id: "response-1", status: "completed", output: [], output_text: JSON.stringify(result()), usage: { input_tokens: 76210, output_tokens: 2914 } });
  await runChat({ ...args, immediate: false, resume: snapshot });
  expect(context).toHaveBeenCalledTimes(1);
  expect(measure).toHaveBeenCalledTimes(1);
  expect((finishRun as jest.Mock).mock.calls.at(-1)[2].report.status).toBe("complete");
  expect((recordTokens as jest.Mock).mock.calls.at(-1)[4]).toMatchObject({ transport: "batch", response_id: "response-1" });
});
test("Batch tool replay uses saved proposals and full output without creating another action", async () => {
  (batchResponse as jest.Mock).mockRejectedValueOnce(new BatchPending());
  await runChat({ ...args, immediate: false });
  const snapshot = structuredClone((batchResponse as jest.Mock).mock.calls[0][4]);
  (readBatch as jest.Mock).mockResolvedValue({ tool_results: { call: { result: { id: "proposal", operations: [{ values: { full: "preserved" } }] }, cards: [{ type: "action", id: "proposal" }], example: false, estimated: false } } });
  (batchResponse as jest.Mock).mockResolvedValueOnce({ id: "response-1", status: "completed", output: [{ type: "function_call", name: "propose_action", arguments: "{}", call_id: "call" }], usage: { input_tokens: 47313, output_tokens: 2367 } }).mockRejectedValueOnce(new BatchPending());
  await runChat({ ...args, immediate: false, resume: snapshot });
  expect(propose).not.toHaveBeenCalled();
  expect(saveToolResult).not.toHaveBeenCalled();
  const next = (batchResponse as jest.Mock).mock.calls.at(-1)[4];
  expect(next.cards).toContainEqual({ type: "action", id: "proposal" });
  expect(next.input).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: "function_call_output",
        output: expect.stringContaining('"full":"preserved"'),
      }),
    ]),
  );
  expect(next.round).toBe(1);
});


test("free users cannot discuss analysis through a direct chat request", async () => {
  (requireIaPlus as jest.Mock).mockRejectedValueOnce(new IaPlusRequired());
  await runChat({ ...args, deep: false });
  expect(create).not.toHaveBeenCalled();
  expect(beginRun).not.toHaveBeenCalled();
  expect(args.send).toHaveBeenCalledWith("error", expect.objectContaining({ code: "IA_PLUS_REQUIRED" }));
});
