import { POST as queue } from "@/app/api/ia-vendas/analysis/route";
import { POST as immediate } from "@/app/api/ia-vendas/analysis/test/route";
import { GET as poll } from "@/app/api/cron/ia-vendas-analysis/route";
import { authorizeAnalysis } from "../analysis";
import { runChat } from "../chat";
import { query } from "@/lib/database/sql";
jest.mock("../chat", () => ({ runChat: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("../http", () => ({ failure: (e: any) => Response.json({ error: e.message }, { status: e.status || 500 }) }));
const id = "11111111-1111-4111-8111-111111111111";
const originalSecret = process.env.IA_VENDAS_ANALYSIS_SECRET;
const originalCron = process.env.CRON_SECRET;
afterAll(() => {
  if (originalSecret === undefined) delete process.env.IA_VENDAS_ANALYSIS_SECRET; else process.env.IA_VENDAS_ANALYSIS_SECRET = originalSecret;
  if (originalCron === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = originalCron;
});
beforeEach(() => {
  process.env.IA_VENDAS_ANALYSIS_SECRET = "internal-test";
  process.env.CRON_SECRET = "cron-test";
  (query as jest.Mock).mockResolvedValue({ rows: [{ id }], rowCount: 1 });
});
const request = (secret = "internal-test", body: any = { restaurant_id: id, run_id: id }) => new Request("https://example.test/api/ia-vendas/analysis", { method: "POST", headers: { Authorization: `Bearer ${secret}` }, body: JSON.stringify(body) });
test("both internal analysis routes reject paid model calls", async () => {
  expect((await queue(request())).status).toBe(410);
  expect((await immediate(request())).status).toBe(410);
  expect(query).not.toHaveBeenCalled();
  expect(runChat).not.toHaveBeenCalled();
});
test("both routes require a server secret before reading data or invoking models", async () => {
  expect((await queue(request("bad"))).status).toBe(401);
  expect((await immediate(request("bad"))).status).toBe(401);
  expect(query).not.toHaveBeenCalled();
  expect(runChat).not.toHaveBeenCalled();
});
test("missing configuration cannot authorize Bearer undefined", () => {
  delete process.env.CRON_SECRET; delete process.env.IA_VENDAS_ANALYSIS_SECRET;
  expect(() => authorizeAnalysis(request("undefined"))).toThrow("Não autorizado");
});
test("disabled analysis refuses requests before reading payloads", async () => {
  expect((await queue(request("internal-test", { restaurant_id: "bad" }))).status).toBe(410);
  expect(query).not.toHaveBeenCalled();
  expect(runChat).not.toHaveBeenCalled();
});
test("polling checks CRON_SECRET independently of the analysis secret", async () => {
  expect((await poll(request())).status).toBe(401);
  (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
  expect((await poll(request("cron-test"))).status).toBe(200);
});
test("polling is inert and never resumes paid Batch requests", async () => {
  const response = await poll(request("cron-test"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ processed: [] });
  expect(query).not.toHaveBeenCalled();
  expect(runChat).not.toHaveBeenCalled();
});
