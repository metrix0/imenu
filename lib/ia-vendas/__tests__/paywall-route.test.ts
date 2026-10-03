import { GET, POST } from "@/app/api/ia-vendas/route";
import { query } from "@/lib/database/sql";
import { apply } from "../actions";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("../http", () => ({ ...jest.requireActual("../http"), authorize: jest.fn().mockResolvedValue("restaurant") }));
jest.mock("@/lib/auth/restaurantOwner", () => ({ RestaurantOwnerAuthError: class extends Error {} }));
jest.mock("../files", () => ({ signedAttachment: jest.fn() }));
jest.mock("../actions", () => ({ apply: jest.fn(), execute: jest.fn() }));
jest.mock("../images", () => ({ applyImages: jest.fn(), publishImage: jest.fn() }));
jest.mock("../data", () => ({ imageUrl: jest.fn() }));
const conversation = "11111111-1111-4111-8111-111111111111";
const first = "22222222-2222-4222-8222-222222222222";
const second = "33333333-3333-4333-8333-333333333333";
const report = { headline: "Mais vendas", summary: "Resumo gratuito", opportunities: [
  { id: "one", title: "Prévia", action_ids: [first] },
  { id: "two", title: "OPORTUNIDADE PRIVADA", action_ids: [second] },
], review_items: [{ title: "REVISÃO PRIVADA" }], sales_snapshot: { private: true } };
let plus = false;
beforeEach(() => {
  plus = false;
  (query as jest.Mock).mockImplementation(async (sql: string) => ({
    rows: sql.includes("restaurant_addons") ? (plus ? [{ status: "active" }] : [])
      : sql.includes("FILTER (WHERE kind='chat')") ? [{ tokens: 0, images: 0 }]
      : sql.startsWith("SELECT id,kind,title") ? [{ id: conversation, kind: "analysis" }]
      : sql.startsWith("SELECT * FROM public.ia_vendas_actions") ? [first, second].map(id => ({ id, conversation_id: conversation, status: "pending", attempts: 0, operations: [] }))
      : sql.includes("(result-'batch')") ? [{ id: "run", result: { report, reply: "TRANSCRIÇÃO PRIVADA" } }]
      : sql.startsWith("SELECT m.*") ? [{ id: "msg", content: "CONVERSA PRIVADA", attachment_ids: [], cards: [] }]
      : [],
    rowCount: sql.startsWith("SELECT 1 FROM public.ia_vendas_conversations") ? 1 : 0,
  }));
});
test("free API response contains a preview and conceals the remaining report, actions and chat", async () => {
  const data = await (await GET(new Request("https://example.test/api/ia-vendas"))).json();
  expect(data.access.plus).toBe(false);
  expect(data.analyses[0].result.report.opportunity_count).toBe(2);
  expect(data.actions.map((a: any) => a.id)).toEqual([first]);
  expect(data.messages).toEqual([]);
  expect(JSON.stringify(data)).not.toMatch(/OPORTUNIDADE PRIVADA|REVISÃO PRIVADA|TRANSCRIÇÃO PRIVADA|CONVERSA PRIVADA|sales_snapshot/);
});
test("Plus returns the complete report and proposals", async () => {
  plus = true;
  const data = await (await GET(new Request("https://example.test/api/ia-vendas"))).json();
  expect(data.analyses[0].result.report.opportunities).toHaveLength(2);
  expect(data.actions).toHaveLength(2);
  expect(data.messages).toHaveLength(1);
});
test.each(["apply", "undo", "reject"])("direct %s requests cannot bypass the analysis paywall", async command => {
  const response = await POST(new Request("https://example.test/api/ia-vendas", { method: "POST", body: JSON.stringify({ command, ids: [first, second] }) }));
  expect(response.status).toBe(402);
  expect(await response.json()).toMatchObject({ code: "IA_PLUS_REQUIRED" });
  expect(apply).not.toHaveBeenCalled();
});
test("Plus can apply a reviewed analysis proposal", async () => {
  plus = true;
  const response = await POST(new Request("https://example.test/api/ia-vendas", { method: "POST", body: JSON.stringify({ command: "apply", ids: [first, second] }) }));
  expect(response.status).toBe(200);
  expect(apply).toHaveBeenCalledTimes(2);
});
