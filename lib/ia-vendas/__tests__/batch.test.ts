import { batchResponse, parseBatchOutput, actionId, BatchPending } from "../batch";
import { query } from "@/lib/database/sql";
import type OpenAI from "openai";
import type { BatchSnapshot } from "../batch";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
let state: any;
const snapshot: BatchSnapshot = { ctx: { entities: { items: { rows: Array.from({ length: 97 }, (_, i) => ({ id: i })) } } },
  input: [{ role: "user", content: "Analisar" }], cards: [], userMessageId: "user", inputTokens: 0, outputTokens: 0,
  example: false, estimated: false, round: 0 };
const request = { model: "gpt-5.6-terra", input: snapshot.input, store: false };
let create: jest.Mock, retrieve: jest.Mock, upload: jest.Mock, content: jest.Mock, ai: OpenAI;
const output = (status = 200, custom_id = "run:1") => JSON.stringify({ custom_id, response: { status_code: status, body: {
  id: "resp", status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: '{"summary":"Pronto"}' }] }],
  usage: { input_tokens: 76210, output_tokens: 2914 },
} } });
beforeEach(() => {
  state = { mode: "batch", args: { run: "run" } };
  (query as jest.Mock).mockImplementation(async (sql, params) => {
    if (sql.startsWith("SELECT")) return { rows: [{ batch: structuredClone(state) }] };
    state = { ...state, ...JSON.parse(params[2]) };
    return { rows: [], rowCount: 1 };
  });
  create = jest.fn().mockResolvedValue({ id: "batch-1", status: "validating" });
  retrieve = jest.fn().mockResolvedValue({ id: "batch-1", status: "in_progress" });
  upload = jest.fn().mockResolvedValue({ id: "file-1" });
  content = jest.fn().mockResolvedValue({ text: async () => output() });
  ai = { files: { create: upload, content }, batches: { create, retrieve } } as unknown as OpenAI;
});
test("queues Responses JSONL for Terra and checkpoints all entities without synchronous inference", async () => {
  await expect(batchResponse(ai, "owner", "run", request, snapshot)).rejects.toBeInstanceOf(BatchPending);
  expect(state.checkpoint.ctx.entities.items.rows).toHaveLength(97);
  expect(state.id).toBe("batch-1");
  expect(create).toHaveBeenCalledWith(expect.objectContaining({ endpoint: "/v1/responses", completion_window: "24h" }), expect.any(Object));
  const file = upload.mock.calls[0][0].file;
  const line = JSON.parse(await file.text());
  expect(line).toMatchObject({ custom_id: "run:1", method: "POST", url: "/v1/responses", body: request });
});
test("polling pending batches doesn't submit another job", async () => {
  await expect(batchResponse(ai, "owner", "run", request, snapshot)).rejects.toBeInstanceOf(BatchPending);
  await expect(batchResponse(ai, "owner", "run", request, snapshot)).rejects.toBeInstanceOf(BatchPending);
  expect(create).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledTimes(1);
});
test("completes from the matching custom ID and replays persisted output without refetch", async () => {
  await expect(batchResponse(ai, "owner", "run", request, snapshot)).rejects.toBeInstanceOf(BatchPending);
  retrieve.mockResolvedValue({ status: "completed", output_file_id: "output" });
  content.mockResolvedValue({ text: async () => output(200, "other") + "\n" + output() });
  const response = await batchResponse(ai, "owner", "run", request, snapshot);
  expect(response.output_text).toBe('{"summary":"Pronto"}');
  expect(response.usage?.input_tokens).toBe(76210);
  expect(await batchResponse(ai, "owner", "run", request, snapshot)).toEqual(response);
  expect(content).toHaveBeenCalledTimes(1);
});
test("next tool cycle queues a new batch with full tool output and new checkpoint", async () => {
  await expect(batchResponse(ai, "owner", "run", request, snapshot)).rejects.toBeInstanceOf(BatchPending);
  const next = { ...snapshot, round: 1, input: [...snapshot.input, { type: "function_call_output", call_id: "call", output: "large-complete-result" }] };
  await expect(batchResponse(ai, "owner", "run", { ...request, input: next.input }, next)).rejects.toBeInstanceOf(BatchPending);
  expect(create).toHaveBeenCalledTimes(2);
  expect(state.round).toBe(2);
  expect(state.checkpoint.input.at(-1).output).toBe("large-complete-result");
  expect(state.tool_results).toEqual({});
});
test("expired/cancelled jobs consume successful partial output before reporting failure", async () => {
  await expect(batchResponse(ai, "owner", "run", request, snapshot)).rejects.toBeInstanceOf(BatchPending);
  retrieve.mockResolvedValue({ status: "expired", output_file_id: "output" });
  expect((await batchResponse(ai, "owner", "run", request, snapshot)).id).toBe("resp");
  state.response = null;
  retrieve.mockResolvedValue({ status: "cancelled" });
  await expect(batchResponse(ai, "owner", "run", request, snapshot)).rejects.toThrow("relatório parcial");
});
test("submission interrupted after provider creation recovers the existing job", async () => {
  state = { ...state, round: 1, checkpoint: snapshot, request, input_file_id: "file-1", submitting_at: new Date().toISOString() };
  (ai.batches as any).list = () => (async function* () { yield { id: "recovered", status: "completed", created_at: Date.now()/1000, input_file_id: "file-1", metadata: { analysis_run: "run", round: "1" } }; })();
  await expect(batchResponse(ai, "owner", "run", request, snapshot)).rejects.toBeInstanceOf(BatchPending);
  expect(state.id).toBe("recovered");
  expect(create).not.toHaveBeenCalled();
});
test("tool action IDs are stable across retries and scoped to run/call", () => {
  expect(actionId("run", "call")).toBe(actionId("run", "call"));
  expect(actionId("run", "call")).not.toBe(actionId("other-run", "call"));
  expect(actionId("run", "call")).toMatch(/^[a-f0-9-]{36}$/);
});
test("missing, malformed and failed request outputs are handled", () => {
  expect(parseBatchOutput(output(200, "other"), "run:1")).toBeNull();
  expect(() => parseBatchOutput(output(400), "run:1")).toThrow("preservadas");
  expect(() => parseBatchOutput("{broken", "run:1")).toThrow("preservadas");
});
