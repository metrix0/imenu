import { query } from "@/lib/database/sql";
import { pool } from "@/lib/database/db";

// Mock the DB client
jest.mock("@/lib/database/db", () => ({
    pool: {
        connect: jest.fn().mockResolvedValue({
            query: jest.fn().mockResolvedValue({ rows: [{ id: 1, name: "Test" }] }),
            release: jest.fn(),
        }),
    },
}));

describe("lib/sql query()", () => {
    it("runs SQL and returns rows", async () => {
        const result = await query("SELECT * FROM test");
        expect(result.rows[0].name).toBe("Test");
    });

    it("releases client after query", async () => {
        const mockClient = await pool.connect();
        await query("SELECT 1");
        expect(mockClient.release).toHaveBeenCalled();
    });
});
