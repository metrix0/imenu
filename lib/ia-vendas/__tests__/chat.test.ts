import { runChat } from "../chat";
import { DIMENSIONS } from "../report";
import { query, withTransaction } from "@/lib/database/sql";
import { context, measure } from "../data";
import { beginRun, recordTokens, finishRun } from "../runs";
import { propose } from "../actions";
import OpenAI from "openai";
jest.mock("openai", () => jest.fn());
jest.mock("@/lib/analytics/posthogConsumer", () => ({
  loadPostHogConsumerMetrics: jest.fn().mockResolvedValue({ available: false }),
}));
jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("../data", () => ({
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
  create.mockReset();
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
    fn({ query: jest.fn().mockResolvedValue({ rows: [] }) }),
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
test("deep analyst sees all 97 items, measurement and structured history without transcript; report persists", async () => {
  create.mockResolvedValue({
    status: "completed",
    output: [],
    output_text: JSON.stringify(result()),
    usage: { input_tokens: 76210, output_tokens: 2914 },
  });
  await runChat(args);
  const request = create.mock.calls[0][0];
  expect(request.input[0].content).toContain("item-96");
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
test("tools retain full results and reserve final synthesis when cumulative output approaches budget", async () => {
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
    usage: { input_tokens: 47313, output_tokens: 6500 },
  });
  create.mockResolvedValueOnce({
    status: "completed",
    output: [],
    output_text: JSON.stringify(result()),
    usage: { input_tokens: 55000, output_tokens: 2500 },
  });
  await runChat(args);
  expect(create.mock.calls[1][0].tool_choice).toBe("none");
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
    usage: { input_tokens: 47313, output_tokens: 6500 },
  });
  create.mockRejectedValueOnce(new Error("provider failure"));
  await runChat(args);
  const finished = (finishRun as jest.Mock).mock.calls.at(-1);
  expect(finished[2].report.status).toBe("partial");
  expect(finished[2].report.review_items[0].action_ids).toEqual(["proposal"]);
  expect(finished[3]).toBeTruthy();
});
