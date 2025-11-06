const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
    createClient: createClientMock,
}));

describe("POST /api/menu/insert-item", () => {
    beforeAll(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.local";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    });

    afterEach(() => {
        jest.resetModules();
        createClientMock.mockReset();
    });

    const createRequest = (body: unknown) =>
        new Request("http://localhost/api/menu/insert-item", {
            method: "POST",
            body: JSON.stringify(body),
        });

    it("returns 400 when required fields are missing", async () => {
        const supabaseMock = {
            from: jest.fn(() => {
                throw new Error("should not access database when validation fails");
            }),
        } as any;

        createClientMock.mockReturnValue(supabaseMock);

        const { POST } = await import("@/app/api/menu/insert-item/route");

        const res = await POST(createRequest({}));
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toMatch(/menuId, restaurantId, categoryId, name and price_cents are required/);
        expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it("inserts a new item, associates it to the menu and stores media", async () => {
        const singleMock = jest.fn().mockResolvedValue({ data: { id: "item-123" }, error: null });
        const selectMock = jest.fn().mockReturnValue({ single: singleMock });
        const itemsInsertMock = jest.fn().mockReturnValue({ select: selectMock });

        const menuItemsInsertMock = jest.fn().mockResolvedValue({ error: null });
        const mediaInsertMock = jest.fn().mockResolvedValue({ error: null });

        const fromMock = jest.fn((table: string) => {
            if (table === "items") return { insert: itemsInsertMock };
            if (table === "menu_items") return { insert: menuItemsInsertMock };
            if (table === "item_media") return { insert: mediaInsertMock };
            throw new Error(`Unexpected table ${table}`);
        });

        const supabaseMock = { from: fromMock } as any;
        createClientMock.mockReturnValue(supabaseMock);

        const { POST } = await import("@/app/api/menu/insert-item/route");

        const payload = {
            menuId: "menu-1",
            restaurantId: "rest-9",
            categoryId: "cat-5",
            name: "  Pasta  ",
            description: "  Fresh pasta  ",
            price_cents: 1599,
            is_available: true,
            imageBase64: "data:image/png;base64,abc",
        };

        const res = await POST(createRequest(payload));
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, itemId: "item-123" });

        expect(itemsInsertMock).toHaveBeenCalledWith([
            expect.objectContaining({
                restaurant_id: "rest-9",
                category_id: "cat-5",
                name: "Pasta",
                description: "Fresh pasta",
                price_cents: 1599,
                is_available: true,
                image_path: "data:image/png;base64,abc",
            }),
        ]);

        expect(menuItemsInsertMock).toHaveBeenCalledWith([
            { menu_id: "menu-1", item_id: "item-123", position: 0 },
        ]);

        expect(mediaInsertMock).toHaveBeenCalledWith([
            { item_id: "item-123", media_type: "image", url: "data:image/png;base64,abc" },
        ]);
    });

    it("returns a warning when inserting item media fails", async () => {
        const singleMock = jest.fn().mockResolvedValue({ data: { id: "item-456" }, error: null });
        const selectMock = jest.fn().mockReturnValue({ single: singleMock });
        const itemsInsertMock = jest.fn().mockReturnValue({ select: selectMock });

        const menuItemsInsertMock = jest.fn().mockResolvedValue({ error: null });
        const mediaInsertMock = jest.fn().mockResolvedValue({ error: { message: "failed" } });

        const supabaseMock = {
            from: jest.fn((table: string) => {
                if (table === "items") return { insert: itemsInsertMock };
                if (table === "menu_items") return { insert: menuItemsInsertMock };
                if (table === "item_media") return { insert: mediaInsertMock };
                throw new Error(`Unexpected table ${table}`);
            }),
        } as any;

        createClientMock.mockReturnValue(supabaseMock);

        const { POST } = await import("@/app/api/menu/insert-item/route");

        const res = await POST(
            createRequest({
                menuId: "menu-1",
                restaurantId: "rest-1",
                categoryId: "cat-1",
                name: "Soup",
                price_cents: 800,
                imageBase64: "data:image/png;base64,zzz",
            })
        );

        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, itemId: "item-456", warning: "Falha ao salvar item_media" });
    });

    it("returns 500 when inserting the item fails", async () => {
        const singleMock = jest.fn().mockResolvedValue({ data: null, error: { message: "db-error" } });
        const selectMock = jest.fn().mockReturnValue({ single: singleMock });
        const itemsInsertMock = jest.fn().mockReturnValue({ select: selectMock });

        const supabaseMock = {
            from: jest.fn((table: string) => {
                if (table === "items") return { insert: itemsInsertMock };
                throw new Error(`Unexpected table ${table}`);
            }),
        } as any;

        createClientMock.mockReturnValue(supabaseMock);

        const { POST } = await import("@/app/api/menu/insert-item/route");

        const res = await POST(
            createRequest({
                menuId: "menu-1",
                restaurantId: "rest-1",
                categoryId: "cat-1",
                name: "Pizza",
                price_cents: 1200,
            })
        );

        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json.error).toBe("Erro ao inserir item");
    });

    it("returns 500 when associating the item to the menu fails", async () => {
        const singleMock = jest.fn().mockResolvedValue({ data: { id: "item-999" }, error: null });
        const selectMock = jest.fn().mockReturnValue({ single: singleMock });
        const itemsInsertMock = jest.fn().mockReturnValue({ select: selectMock });

        const menuItemsInsertMock = jest.fn().mockResolvedValue({ error: { message: "link-failed" } });

        const supabaseMock = {
            from: jest.fn((table: string) => {
                if (table === "items") return { insert: itemsInsertMock };
                if (table === "menu_items") return { insert: menuItemsInsertMock };
                throw new Error(`Unexpected table ${table}`);
            }),
        } as any;

        createClientMock.mockReturnValue(supabaseMock);

        const { POST } = await import("@/app/api/menu/insert-item/route");

        const res = await POST(
            createRequest({
                menuId: "menu-1",
                restaurantId: "rest-1",
                categoryId: "cat-1",
                name: "Salad",
                price_cents: 650,
            })
        );

        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json.error).toBe("Erro ao associar item ao menu");
    });
});
