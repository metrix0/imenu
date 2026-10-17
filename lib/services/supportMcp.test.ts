import { query } from "@/lib/database/sql";
import { searchSupportKnowledge } from "./supportMcp";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/wahaClient", () => ({
    getWahaWebhookHmacKey: jest.fn(),
}));

const mockedQuery = query as jest.Mock;

beforeEach(() => {
    mockedQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe("support knowledge search", () => {
    it.each(["Oi", "Ok", "Sim", "?"])(
        "uses an expression instead of ORDER BY position zero for %s",
        async (message) => {
            await expect(searchSupportKnowledge(message)).resolves.toEqual([]);

            expect(mockedQuery).toHaveBeenCalledTimes(1);
            const [sql, params] = mockedQuery.mock.calls[0];
            expect(sql).toContain(
                "ORDER BY CASE WHEN title ILIKE $1 THEN 0 WHEN content ILIKE $1 THEN 1 ELSE 2 END, (0::integer) DESC, updated_at DESC"
            );
            expect(params).toEqual([`%${message}%`, 8]);
        }
    );

    it("preserves relevance scoring for searches with meaningful terms", async () => {
        await searchSupportKnowledge("adicionais");

        const [sql, params] = mockedQuery.mock.calls[0];
        expect(sql).toContain(
            "(CASE WHEN title ILIKE $2 THEN 3 WHEN content ILIKE $2 THEN 1 ELSE 0 END) DESC"
        );
        expect(params).toEqual(["%adicionais%", "%adicionais%", 8]);
    });
});
