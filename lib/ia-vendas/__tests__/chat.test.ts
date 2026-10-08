import {
  asksAboutWholeMenu,
  ensureSalesAnalysisBridge,
  runChat,
} from "../chat";
import {
  aiAccess,
  IaImageLimitReached,
  requireIaPlus,
  IaPlusRequired,
} from "../access";
jest.mock("../access", () => ({ ...jest.requireActual("../access"), aiAccess: jest.fn().mockResolvedValue({ plus: true }), requireIaPlus: jest.fn() }));
import { DIMENSIONS } from "../report";
import { PRODUCT_DIMENSIONS } from "../products";
import { potential } from "../peers";
import { LIMITS } from "../config";
import { query, withTransaction } from "@/lib/database/sql";
import { context, measure } from "../data";
import { beginRun, recordTokens, finishRun } from "../runs";
import { propose } from "../actions";
import { analysisPhotos, previewImage } from "../images";
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
jest.mock("../files", () => ({ attachment: jest.fn(), download: jest.fn() }));
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
const namedContext = () => {
  const items = [
    { id: "first", name: "Caseiro", description: "Carne 180g. " + "Receita confirmada. ".repeat(30), price_cents: 2500, category_id: "cat", position: 5 },
    { id: "second", name: "Segundo", description: "Carne 360g", price_cents: 1599, category_id: "cat", position: 0 },
  ];
  return {
    restaurant: { url_slug: "menu" }, items: { rows: items },
    entities: { items: { rows: items }, categories: { rows: [{ id: "cat", name: "Caseiros" }] } },
    coverage: {}, actions: [],
    sales: { start: "2026-09-01", end: "2026-09-29", days: 28, orders: 200, revenue_cents: 600000, ticket_cents: 3000, products: [
      { item_id: "first", gross_cents: 500000, units: 200 },
      { item_id: "second", gross_cents: 100000, units: 30 },
    ] },
  };
};
const namedResult = () => ({
  ...result(),
  product_reviews: ["first", "second"].map((item_id) => ({
    item_id,
    ...Object.fromEntries(PRODUCT_DIMENSIONS.map((dimension) => [dimension, { status: "keep", note: "Dados conferidos." }])),
    action_ids: item_id === "first" ? ["proposal"] : [],
  })),
});
test.each([
  "o que acha do meu cardápio?",
  "meu cardápio está bom?",
  "analise meu cardápio",
  "revise o menu completo",
  "Revise meus itens e melhore a descricao do meu cardápio",
  "melhore as descrições do meu cardápio",
  "do u think my menu is nice?",
  "review my entire menu",
])("whole-menu evaluation suggests Vendas IA: %s", (message) => {
  expect(asksAboutWholeMenu(message)).toBe(true);
});

test.each([
  "mude o preço deste item do meu cardápio",
  "adicione uma bebida ao menu",
  "troque a foto deste produto",
])("specific menu request does not suggest Vendas IA: %s", (message) => {
  expect(asksAboutWholeMenu(message)).toBe(false);
});

test("Vendas IA CTA always has a textual bridge", () => {
  const cards = [{ type: "sales_analysis_cta" }];

  expect(
    ensureSalesAnalysisBridge("Revisei os principais pontos.", cards),
  ).toContain("**Vendas IA**");
  expect(
    ensureSalesAnalysisBridge(
      "Para uma análise completa, a Vendas IA considera seus dados reais.",
      cards,
    ),
  ).toBe(
    "Para uma análise completa, a Vendas IA considera seus dados reais.",
  );
  expect(
    ensureSalesAnalysisBridge("Resposta sem CTA.", []),
  ).toBe("Resposta sem CTA.");
});

beforeEach(() => {
  (potential as jest.Mock).mockReset().mockImplementation(jest.requireActual("../peers").potential);
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
test.each([true, false])("every leading product is required through immediate and queued analysis (immediate=%s)", async (immediate) => {
  (context as jest.Mock).mockResolvedValue(namedContext());
  const research = (id: string) => ({ status: "completed", output: [{ type: "function_call", name: "measure_actions", arguments: "{}", call_id: id }], usage: { input_tokens: 1000, output_tokens: 100 } });
  const final = { status: "completed", output: [], output_text: JSON.stringify(namedResult()), usage: { input_tokens: 1000, output_tokens: 1000 } };
  if (immediate) create.mockResolvedValueOnce(research("r1")).mockResolvedValueOnce(research("r2")).mockResolvedValueOnce(final);
  else (batchResponse as jest.Mock).mockRejectedValueOnce(new BatchPending());
  await runChat({ ...args, immediate });
  const request = immediate ? create.mock.calls[0][0] : (batchResponse as jest.Mock).mock.calls[0][3];
  expect(request.text.format.schema.required).toContain("product_reviews");
  expect(request.text.format.schema.properties.product_reviews.items.properties.item_id.enum).toEqual(["first", "second"]);
  expect(request.input[0].content).toContain(namedContext().items.rows[0].description);
  expect(request.input[0].content).toContain('"candidate_cents":2499');
  if (!immediate) {
    let checkpoint = structuredClone((batchResponse as jest.Mock).mock.calls.at(-1)[4]);
    expect(checkpoint.ctx.product_review.targets.map((t: any) => t.item_id)).toEqual(["first", "second"]);
    for (const response of [research("r1"), research("r2")]) {
      (batchResponse as jest.Mock).mockResolvedValueOnce(response).mockRejectedValueOnce(new BatchPending());
      await runChat({ ...args, immediate, resume: checkpoint });
      checkpoint = structuredClone((batchResponse as jest.Mock).mock.calls.at(-1)[4]);
    }
    (batchResponse as jest.Mock).mockResolvedValueOnce(final);
    await runChat({ ...args, immediate, resume: checkpoint });
    expect(context).toHaveBeenCalledTimes(1);
  }
  const report = (finishRun as jest.Mock).mock.calls.at(-1)[2].report;
  expect(report.coverage.product_reviews).toEqual({ expected: 2, assessed: 2, complete: true });
  expect(report.product_reviews[0].name).toMatchObject({ status: "keep" });
});

test("failed product projection can be corrected after a real proposal without consuming the joint estimate", async () => {
  (context as jest.Mock).mockResolvedValue(namedContext());
  const originalQuery = (query as jest.Mock).getMockImplementation()!;
  const operations = [{ entity: "items", kind: "update", id: "first", before: { description: "Carne" }, values: { description: "Carne 180g" } }];
  (query as jest.Mock).mockImplementation((sql: string, ...params: any[]) => sql.includes("SELECT operations,image_jobs") ? Promise.resolve({ rows: [{ operations }] }) : originalQuery(sql, ...params));
  (propose as jest.Mock).mockResolvedValue({ id: "proposal", operations });
  const call = (name: string, params: any, call_id: string) => ({ type: "function_call", name, arguments: JSON.stringify(params), call_id });
  const first = call("estimate_revenue", { opportunities: [{ kind: "menu_clarity", eligible_revenue_cents: 599999 }] }, "invalid");
  const corrected = call("estimate_revenue", { opportunities: [{ kind: "menu_clarity", item_ids: ["first"], eligible_revenue_cents: 599999 }] }, "valid");
  create
    .mockResolvedValueOnce({ status: "completed", output: [first], usage: { input_tokens: 1000, output_tokens: 100 } })
    .mockResolvedValueOnce({ status: "completed", output: [call("propose_action", {}, "proposal-call"), corrected], usage: { input_tokens: 1000, output_tokens: 100 } })
    .mockResolvedValueOnce({ status: "completed", output: [], output_text: JSON.stringify(namedResult()), usage: { input_tokens: 1000, output_tokens: 1000 } });
  await runChat(args);
  expect(potential).toHaveBeenCalledTimes(1);
  const report = (finishRun as jest.Mock).mock.calls.at(-1)[2].report;
  expect(report.status).toBe("complete");
  expect(report.potential_estimate).toMatchObject({ min_cents: 10000, max_cents: 25000 });
  expect(create.mock.calls[1][0].input.find((i: any) => i.type === "function_call_output" && i.call_id === "invalid").output).toContain("quais produtos");
});

test("deep analyst requires research before final synthesis and persists only the final report", async () => {
  const toolRound = (callId: string, inputTokens: number) => ({
    status: "completed",
    output: [
      {
        type: "function_call",
        name: "measure_actions",
        arguments: "{}",
        call_id: callId,
      },
    ],
    usage: { input_tokens: inputTokens, output_tokens: 500 },
  });
  create
    .mockResolvedValueOnce(toolRound("verify-1", 20000))
    .mockResolvedValueOnce(toolRound("verify-2", 21000))
    .mockResolvedValueOnce({
      status: "completed",
      output: [],
      output_text: JSON.stringify(result()),
      usage: { input_tokens: 22000, output_tokens: 1600 },
    });
  await runChat(args);
  const research = create.mock.calls[0][0],
    secondResearch = create.mock.calls[1][0],
    synthesis = create.mock.calls[2][0];
  expect(research.input[0].content).toContain("item-0");
  expect(research.input[0].content).not.toContain("item-96");
  expect(research.input[0].content).toContain('"loaded":97');
  expect(research.input[0].content).toContain("measured-action");
  expect(research.input[0].content).toContain("previous structured");
  expect(research.input[0].content).not.toContain("OLD TRANSCRIPT");
  expect(research.text.format.strict).toBe(true);
  expect(research.tool_choice).toBe("required");
  expect(secondResearch.tool_choice).toBe("required");
  expect(synthesis.tool_choice).toBe("none");
  expect(
    (query as jest.Mock).mock.calls.some(
      ([sql]) => sql.includes("LIMIT 18") || sql.includes("SELECT title,summary"),
    ),
  ).toBe(false);
  expect((finishRun as jest.Mock).mock.calls.at(-1)[2].report.status).toBe(
    "complete",
  );
  const modelCycles = (recordTokens as jest.Mock).mock.calls
    .map((call) => call[4])
    .filter((cycle) => cycle?.model);
  expect(modelCycles).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ round: 1, input_tokens: 20000, final_synthesis: false }),
      expect.objectContaining({ round: 2, input_tokens: 21000, final_synthesis: false }),
      expect.objectContaining({ round: 3, input_tokens: 22000, final_synthesis: true }),
    ]),
  );
});
test("a first-round report without tool verification fails instead of being published", async () => {
  create.mockResolvedValueOnce({
    status: "completed",
    output: [],
    output_text: JSON.stringify(result()),
    usage: { input_tokens: 25501, output_tokens: 2352 },
  });
  await runChat(args);
  expect(create).toHaveBeenCalledTimes(1);
  expect(create.mock.calls[0][0].tool_choice).toBe("required");
  const finished = (finishRun as jest.Mock).mock.calls.at(-1);
  expect(finished[2].report.status).toBe("partial");
  expect(finished[3]).toContain("etapa de verificação");
});
test("budget pressure fails instead of publishing an early second-round synthesis", async () => {
  create
    .mockResolvedValueOnce({
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "propose_action",
          arguments: "{}",
          call_id: "call-1",
        },
      ],
      usage: { input_tokens: 45000, output_tokens: 1200 },
    })
    .mockResolvedValueOnce({
      status: "completed",
      output: [
        {
          type: "function_call",
          name: "measure_actions",
          arguments: "{}",
          call_id: "call-2",
        },
      ],
      usage: { input_tokens: LIMITS.analysisInput - 45_000 - 5_000, output_tokens: 500 },
    });
  await runChat(args);
  expect(create).toHaveBeenCalledTimes(2);
  expect(create.mock.calls[0][0].tool_choice).toBe("required");
  expect(create.mock.calls[1][0].tool_choice).toBe("required");
  const finished = (finishRun as jest.Mock).mock.calls.at(-1);
  expect(finished[2].report.status).toBe("partial");
  expect(finished[3]).toContain("orçamento máximo");
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
      inputTokens: LIMITS.analysisInput - 5_000,
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
  const scopedQuery = (query as jest.Mock).mock.calls.find(([sql]) =>
    sql.includes("SELECT id,result->'report' report"),
  )?.[0];
  expect(scopedQuery).toContain("status='completed'");
  expect(scopedQuery).toContain("result->'report'->>'status'='complete'");
});

test.each([true, false])("deep photo inputs reach the model and survive Batch resume (immediate=%s)", async (immediate) => {
  const photo = { type: "input_image", image_url: "data:image/jpeg;base64,cGhvdG8=", detail: "high" };
  (analysisPhotos as jest.Mock).mockImplementation(async (ctx) => {
    ctx.coverage.image_photos = { loaded: 1, total: 1, complete: true };
    ctx.image_review = { loaded: 1, unavailable: 0, missing: 0, photos: [{ item_id: "item-96", status: "loaded" }] };
    return [{ type: "input_text", text: "Foto do item-96" }, photo];
  });
  const research = (callId: string) => ({
    status: "completed",
    output: [{ type: "function_call", name: "measure_actions", arguments: "{}", call_id: callId }],
    usage: { input_tokens: 1000, output_tokens: 100 },
  });
  const response = { status: "completed", output: [], output_text: JSON.stringify(result()), usage: { input_tokens: 1000, output_tokens: 100 } };
  if (immediate)
    create
      .mockResolvedValueOnce(research("photo-check-1"))
      .mockResolvedValueOnce(research("photo-check-2"))
      .mockResolvedValueOnce(response);
  else (batchResponse as jest.Mock).mockRejectedValueOnce(new BatchPending());
  await runChat({ ...args, immediate });
  const request = immediate ? create.mock.calls[0][0] : (batchResponse as jest.Mock).mock.calls[0][3];
  expect(
    request.input.some((message: any) =>
      Array.isArray(message.content) &&
      message.content.some((part: any) => part.type === "input_image" && part.image_url === photo.image_url),
    ),
  ).toBe(true);
  expect(request.input[0].content).toContain('"image_review"');
  if (!immediate) {
    const firstCheckpoint = structuredClone((batchResponse as jest.Mock).mock.calls[0][4]);
    (batchResponse as jest.Mock)
      .mockResolvedValueOnce(research("photo-check-1"))
      .mockRejectedValueOnce(new BatchPending());
    await runChat({ ...args, immediate, resume: firstCheckpoint });
    const secondCheckpoint = structuredClone((batchResponse as jest.Mock).mock.calls.at(-1)[4]);
    (batchResponse as jest.Mock)
      .mockResolvedValueOnce(research("photo-check-2"))
      .mockRejectedValueOnce(new BatchPending());
    await runChat({ ...args, immediate, resume: secondCheckpoint });
    const finalCheckpoint = structuredClone((batchResponse as jest.Mock).mock.calls.at(-1)[4]);
    (batchResponse as jest.Mock).mockResolvedValueOnce(response);
    await runChat({ ...args, immediate, resume: finalCheckpoint });
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
  const firstCheckpoint = structuredClone((batchResponse as jest.Mock).mock.calls[0][4]);
  expect(firstCheckpoint.ctx.entities.items.rows).toHaveLength(97);

  (batchResponse as jest.Mock)
    .mockResolvedValueOnce({
      id: "response-1",
      status: "completed",
      output: [{ type: "function_call", name: "measure_actions", arguments: "{}", call_id: "verify-1" }],
      usage: { input_tokens: 20000, output_tokens: 500 },
    })
    .mockRejectedValueOnce(new BatchPending());
  await runChat({ ...args, immediate: false, resume: firstCheckpoint });
  const secondCheckpoint = structuredClone((batchResponse as jest.Mock).mock.calls.at(-1)[4]);

  (batchResponse as jest.Mock)
    .mockResolvedValueOnce({
      id: "response-2",
      status: "completed",
      output: [{ type: "function_call", name: "measure_actions", arguments: "{}", call_id: "verify-2" }],
      usage: { input_tokens: 21000, output_tokens: 500 },
    })
    .mockRejectedValueOnce(new BatchPending());
  await runChat({ ...args, immediate: false, resume: secondCheckpoint });
  const finalCheckpoint = structuredClone((batchResponse as jest.Mock).mock.calls.at(-1)[4]);

  (batchResponse as jest.Mock).mockResolvedValueOnce({
    id: "response-3",
    status: "completed",
    output: [],
    output_text: JSON.stringify(result()),
    usage: { input_tokens: 22000, output_tokens: 1600 },
  });
  await runChat({ ...args, immediate: false, resume: finalCheckpoint });

  expect(context).toHaveBeenCalledTimes(1);
  expect(measure).toHaveBeenCalledTimes(3);
  expect((finishRun as jest.Mock).mock.calls.at(-1)[2].report.status).toBe("complete");
  expect((recordTokens as jest.Mock).mock.calls.at(-1)[4]).toMatchObject({
    transport: "batch",
    response_id: "response-3",
    final_synthesis: true,
  });
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

test("free chat does not count restaurant context toward the per-message cap", async () => {
  (args.send as jest.Mock).mockClear();
  (context as jest.Mock).mockClear();
  (aiAccess as jest.Mock).mockResolvedValueOnce({ plus: false });
  (query as jest.Mock).mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT * FROM public.ia_vendas_conversations")
      ? [{ kind: "chat", summary: "" }]
      : sql.includes("RETURNING id")
        ? [{ id: "user" }]
        : [],
  }));
  (context as jest.Mock).mockResolvedValueOnce({
    restaurant: { padding: "x".repeat(100_000) },
    items: { rows: [] },
    categories: { rows: [] },
    sales: { products: [] },
    instructions: "",
    actions: [],
    last_analysis: null,
  });
  create.mockResolvedValueOnce({
    status: "completed",
    output: [],
    output_text: JSON.stringify({ reply: "Certo.", summary: "" }),
    usage: { input_tokens: 61_000, output_tokens: 100 },
  });

  await runChat({
    ...args,
    deep: false,
    text: "adicione um horário para hoje das 01 da manha as 03",
  });

  expect(create).toHaveBeenCalledTimes(1);
  expect(args.send).not.toHaveBeenCalledWith(
    "error",
    expect.objectContaining({ message: expect.any(String) }),
  );
  expect(args.send).toHaveBeenCalledWith("done", expect.any(Object));
  expect((finishRun as jest.Mock).mock.calls.at(-1)[3]).toBeUndefined();
});

test("free chat blocks only an oversized user message and persists the explanation as the assistant reply", async () => {
  (args.send as jest.Mock).mockClear();
  (context as jest.Mock).mockClear();
  (aiAccess as jest.Mock).mockResolvedValueOnce({ plus: false });
  (query as jest.Mock).mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT * FROM public.ia_vendas_conversations")
      ? [{ kind: "chat", summary: "" }]
      : sql.includes("RETURNING id")
        ? [{ id: "user" }]
        : [],
  }));

  await runChat({
    ...args,
    deep: false,
    text: "x".repeat(120_001),
  });

  expect(create).not.toHaveBeenCalled();
  expect(context).not.toHaveBeenCalled();
  expect(args.send).not.toHaveBeenCalledWith(
    "error",
    expect.any(Object),
  );
  expect(args.send).toHaveBeenCalledWith("done", expect.any(Object));
  const finished = (finishRun as jest.Mock).mock.calls.at(-1);
  expect(finished[2].reply).toBe(
    "Esta mensagem ficou grande demais para ser processada de uma vez. Envie o pedido em partes menores para continuar.",
  );
  expect(finished[2].reply).not.toMatch(/token|nova conversa/i);
  expect(finished[3]).toBeUndefined();
});

test("free chat turns an internal response limit into a normal assistant reply without consuming the weekly quota", async () => {
  (args.send as jest.Mock).mockClear();
  (aiAccess as jest.Mock).mockResolvedValueOnce({ plus: false });
  (query as jest.Mock).mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT * FROM public.ia_vendas_conversations")
      ? [{ kind: "chat", summary: "" }]
      : sql.includes("RETURNING id")
        ? [{ id: "user" }]
        : [],
  }));
  (context as jest.Mock).mockResolvedValueOnce({
    restaurant: { url_slug: "menu" },
    items: { rows: [] },
    categories: { rows: [] },
    sales: { products: [] },
    instructions: "",
    actions: [],
    last_analysis: null,
  });
  create.mockResolvedValueOnce({
    status: "incomplete",
    output: [],
    output_text: "",
    usage: { input_tokens: 58_000, output_tokens: 2_500 },
  });

  await runChat({
    ...args,
    deep: false,
    text: "Faça uma auditoria detalhada do meu restaurante.",
  });

  expect(args.send).not.toHaveBeenCalledWith(
    "error",
    expect.any(Object),
  );
  expect(args.send).toHaveBeenCalledWith("done", expect.any(Object));
  const finished = (finishRun as jest.Mock).mock.calls.at(-1);
  expect(finished[2]).toMatchObject({
    reply:
      "Não consegui concluir tudo em uma única resposta. Divida o pedido em partes menores para continuar.",
    quota_exempt: true,
  });
  expect(finished[2].reply).not.toContain(
    "A resposta atingiu o limite. As propostas prontas foram salvas.",
  );
  expect(finished[3]).toBeUndefined();
});

test("weekly image exhaustion stops only image generation and does not trigger the global Plus limit", async () => {
  (args.send as jest.Mock).mockClear();
  (aiAccess as jest.Mock).mockResolvedValueOnce({ plus: false });
  (query as jest.Mock).mockImplementation(async (sql: string) => ({
    rows: sql.includes("SELECT * FROM public.ia_vendas_conversations")
      ? [{ kind: "chat", summary: "" }]
      : sql.includes("RETURNING id")
        ? [{ id: "user" }]
        : [],
  }));
  create.mockResolvedValueOnce({
    status: "completed",
    output: [
      {
        type: "function_call",
        name: "image_example",
        arguments: JSON.stringify({
          target: "item",
          item_id: "item",
          prompt: "Melhorar a foto",
        }),
        call_id: "image-limit",
      },
    ],
    usage: { input_tokens: 1000, output_tokens: 100 },
  });
  (previewImage as jest.Mock).mockRejectedValueOnce(new IaImageLimitReached());

  await runChat({ ...args, deep: false });

  expect(create).toHaveBeenCalledTimes(1);
  const errorEvent = (args.send as jest.Mock).mock.calls.find(
    ([event]) => event === "error",
  )?.[1];
  expect(errorEvent?.message).toContain(
    "Seu limite semanal de geração de imagens foi atingido",
  );
  expect(errorEvent?.code).toBeUndefined();
});
