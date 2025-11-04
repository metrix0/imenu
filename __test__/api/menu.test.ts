import { GET } from "@/app/api/menu/route";
import { query } from "@/lib/sql";

jest.mock("@/lib/sql");

describe("GET /api/menu", () => {
    it("returns categories and items ordered", async () => {
        const mockCategories = [
            { id: "cat-1", name: "Appetizers", position: 1 },
            { id: "cat-2", name: "Mains", position: 2 },
        ];

        const mockItems = [
            {
                id: "item-1",
                category_id: "cat-1",
                name: "Bruschetta",
                description: "Grilled bread with tomatoes",
                price_cents: 800,
                image_path: "/images/bruschetta.jpg",
                is_available: true,
                position: 1,
            },
            {
                id: "item-2",
                category_id: "cat-2",
                name: "Lasagna",
                description: "Baked pasta with cheese",
                price_cents: 1500,
                image_path: "/images/lasagna.jpg",
                is_available: true,
                position: 2,
            },
        ];

        const queryMock = query as jest.MockedFunction<typeof query>;
        queryMock.mockResolvedValueOnce({ rows: mockCategories });
        queryMock.mockResolvedValueOnce({ rows: mockItems });

        const res = await GET();

        expect(queryMock).toHaveBeenCalledTimes(2);

        const firstCallSql = queryMock.mock.calls[0][0];
        expect(firstCallSql).toContain("SELECT c.id, c.name, c.position");
        expect(firstCallSql).toContain("ORDER BY c.position ASC, c.name ASC");

        const secondCallSql = queryMock.mock.calls[1][0];
        expect(secondCallSql).toContain(
            "SELECT i.id, i.category_id, i.name, i.description, i.price_cents, i.image_path, i.is_available, i.position"
        );
        expect(secondCallSql).toContain("ORDER BY i.position ASC, i.name ASC");

        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({
            categories: mockCategories,
            items: mockItems,
        });
    });
});
