import { query } from "@/lib/database/sql";
import { searchSupportKnowledge } from "./supportMcp";

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
