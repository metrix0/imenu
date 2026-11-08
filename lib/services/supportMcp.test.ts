import { query } from "@/lib/database/sql";
import { executeSupportMcpTool, searchSupportKnowledge, SUPPORT_MCP_TOOLS } from "./supportMcp";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/wahaClient", () => ({
    getWahaWebhookHmacKey: jest.fn(),
}));

const mockedQuery = query as jest.Mock;

beforeEach(() => {
    mockedQuery.mockReset();
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe("support knowledge search", () => {
    it.each(["Oi", "Ok", "Sim", "?"])(
        "uses a safe weighted fallback query for short/stop-word input %s",
        async (message) => {
            await expect(searchSupportKnowledge(message)).resolves.toEqual([]);

            expect(mockedQuery).toHaveBeenCalledTimes(1);
            const [sql, params] = mockedQuery.mock.calls[0];
            expect(sql).toContain("k.title ILIKE $1 OR k.content ILIKE $1");
            expect(sql).toContain("(k.title ILIKE $1) DESC");
            expect(sql).toContain("(k.content ILIKE $1) DESC");
            expect(sql).toContain("CASE WHEN k.title ILIKE '%' || term || '%' THEN 3");
            expect(sql).toContain("k.updated_at DESC");
            expect(sql).toContain("LIMIT $3");
            expect(params).toEqual([`%${message}%`, [], 8]);
        }
    );

    it("uses Portuguese full-text relevance and falls back to literal matches", async () => {
        await searchSupportKnowledge("adicionais");

        expect(mockedQuery).toHaveBeenCalledTimes(2);
        const [fullTextSql, fullTextParams] = mockedQuery.mock.calls[0];
        expect(fullTextSql).toContain("websearch_to_tsquery('portuguese', $1)");
        expect(fullTextSql).toContain("ORDER BY matched_terms DESC, title_matches DESC, relevance DESC");
        expect(fullTextParams).toEqual(["adicionais", 8, ["adicionais"]]);

        const [fallbackSql, fallbackParams] = mockedQuery.mock.calls[1];
        expect(fallbackSql).toContain("(k.title ILIKE $1) DESC");
        expect(fallbackSql).toContain("FROM unnest($2::text[]) AS term");
        expect(fallbackParams).toEqual(["%adicionais%", ["adicionais"], 8]);
    });
});


// A pending confirmed Pix order can have a future cycle without any payout row.
describe("Pix payout expectation for support", () => {
    const conversation = {
        id: "conversation-1",
        phone: "5599999999999",
        restaurant_id: "restaurant-1",
        handoff_prompted_at: null,
        blacklisted: false,
        blocked_handoff: false,
    };
    const nextCycle = {
        expected_at: "2026-11-09T15:00:00.000Z",
        gross_cents: "1900",
        order_count: 1,
    };

    beforeEach(() => {
        mockedQuery.mockReset();
        mockedQuery.mockImplementation(async (sql: string, params: unknown[]) => {
            if (sql.includes("FROM support_conversations")) return { rows: [conversation] };
            if (sql.includes("pix_key_configured")) {
                return { rows: [{
                    as_of: "2026-11-08T15:52:00.000Z",
                    pix_key_configured: true,
                    latest_payout: null,
                }] };
            }
            if (sql.includes("WITH last_payout AS")) {
                expect(params).toEqual(["restaurant-1"]);
                expect(sql).toContain("INTERVAL '90 minutes'");
                expect(sql).toContain("America/Sao_Paulo");
                expect(sql).toContain("o.restaurant_id = $1");
                expect(sql).toContain("COALESCE(lp.last_created_at");
                return { rows: [nextCycle] };
            }
            throw new Error("Unexpected query: " + sql);
        });
    });

    it("forecasts the next noon cycle rather than declaring no scheduled payout", async () => {
        expect(SUPPORT_MCP_TOOLS.some((tool) => tool.name === "get_pix_payout_expectation")).toBe(true);
        const result = await executeSupportMcpTool(
            conversation.id, "get_pix_payout_expectation", {}
        );
        expect(result).toMatchObject({
            pix_key_configured: true,
            latest_payout: null,
            next_expected_cycle: {
                expected_at: nextCycle.expected_at,
                order_count: 1,
                estimated_gross_cents: 1900,
                estimated_net_cents: 1881,
            },
            forecast_only: true,
        });
    });

    it("does not promise a payout date when a Pix key is missing", async () => {
        mockedQuery.mockImplementation(async (sql: string) => {
            if (sql.includes("FROM support_conversations")) return { rows: [conversation] };
            if (sql.includes("pix_key_configured")) {
                return { rows: [{
                    as_of: "2026-11-08T15:52:00.000Z",
                    pix_key_configured: false,
                    latest_payout: { status: "failed", amount_cents: 1881 },
                }] };
            }
            if (sql.includes("WITH last_payout AS")) return { rows: [nextCycle] };
            throw new Error("Unexpected query");
        });
        const result = await executeSupportMcpTool(
            conversation.id, "get_pix_payout_expectation", {}
        );
        expect(result).toMatchObject({
            blocked_reason: "Chave Pix de repasse não cadastrada.",
            next_expected_cycle: null,
            pending_cycles: [{ estimated_net_cents: 1881 }],
        });
    });
});
