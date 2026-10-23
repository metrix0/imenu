jest.mock("@/lib/database/sql", () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));
jest.mock("@/lib/services/wahaClient", () => ({
  getIMenuPublicUrl: () => "https://test.invalid",
  sendWahaText: jest.fn(),
  sendWahaList: jest.fn(),
  sendWahaImage: jest.fn(),
}));
jest.mock("@/lib/database/supabaseServerClient", () => ({
  createSupabaseServerClient: () => ({
    storage: {
      from: () => ({
        getPublicUrl: () => ({
          data: { publicUrl: "https://test.invalid/image.png" },
        }),
      }),
    },
  }),
}));
import { query, withTransaction } from "@/lib/database/sql";
import { sendWahaText, sendWahaList } from "./wahaClient";
import { processCustomerAutomations, getCrmReply } from "./crmAutomations";
const id = "30000000-0000-4000-8000-000000000001";
beforeEach(() => {
  jest.resetAllMocks();
});
test("a rejected database claim sends nothing", async () => {
  (query as jest.Mock).mockImplementation(async (sql: string) => ({
    rows: sql.includes("s.automations,r.name")
      ? [
          {
            restaurant_id: id,
            name: "Test",
            automations: { cart: { enabled: true } },
            session_name: "test",
          },
        ]
      : sql.includes("count(*)::int n")
        ? [{ n: 0 }]
        : [
            {
              phone: "5519999991234",
              identity: "session",
              session_id: "40000000-0000-4000-8000-000000000001",
            },
          ],
  }));
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  };
  (withTransaction as jest.Mock).mockImplementation((fn) => fn(client));
  await processCustomerAutomations();
  expect(sendWahaText).not.toHaveBeenCalled();
  expect(sendWahaList).not.toHaveBeenCalled();
  expect(client.query.mock.calls[0][0]).toContain("pg_advisory_xact_lock");
});
test("a full restaurant daily budget avoids candidate scanning", async () => {
  (query as jest.Mock).mockImplementation(async (sql: string) => ({
    rows: sql.includes("s.automations,r.name")
      ? [
          {
            restaurant_id: id,
            name: "Test",
            automations: { reactivation: { enabled: true } },
            session_name: "test",
          },
        ]
      : [{ n: 2 }],
  }));
  expect(await processCustomerAutomations()).toEqual({ sent: 0, failed: 0 });
  expect(withTransaction).not.toHaveBeenCalled();
  expect(sendWahaText).not.toHaveBeenCalled();
});
test("SAIR persists opt-out without requiring campaign context", async () => {
  (query as jest.Mock).mockResolvedValue({ rows: [] });
  const result = await getCrmReply(id, "5519999991234", "SAIR");
  expect(result?.text).toContain("não receberá mais");
  expect((query as jest.Mock).mock.calls[0][0]).toContain("opted_out_at=now()");
  expect((query as jest.Mock).mock.calls[1][0]).toContain(
    "marketing_consent=false",
  );
});
