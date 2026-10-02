import { POST } from "@/app/api/ia-vendas/chat/route";
import { authorize } from "../http";
import { runChat } from "../chat";

jest.mock("next/server", () => ({ after: jest.fn() }));
jest.mock("../http", () => ({
  authorize: jest.fn(),
  failure: (error: { message: string; status: number }) =>
    Response.json({ error: error.message }, { status: error.status }),
}));
jest.mock("../chat", () => ({ runChat: jest.fn().mockResolvedValue(undefined) }));

const id = "11111111-1111-4111-8111-111111111111";
const request = (deep: boolean) => new Request("https://example.test/api/ia-vendas/chat", {
  method: "POST",
  body: JSON.stringify({
    conversation_id: id,
    run_id: id,
    text: "Analisar minhas vendas",
    attachments: [],
    deep,
  }),
});

beforeEach(() => {
  (authorize as jest.Mock).mockResolvedValue(id);
});

test("customer route cannot launch deep analysis", async () => {
  const response = await POST(request(true));
  expect(response.status).toBe(403);
  expect(runChat).not.toHaveBeenCalled();
});

test("contextual questions continue through the normal chat flow", async () => {
  const response = await POST(request(false));
  expect(response.status).toBe(200);
  expect(runChat).toHaveBeenCalledWith(expect.objectContaining({ deep: false }));
});
