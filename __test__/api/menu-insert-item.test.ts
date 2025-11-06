const fromMock = jest.fn();
let createClientMock: jest.Mock;

jest.mock("@supabase/supabase-js", () => {
    createClientMock = jest.fn(() => ({
        from: fromMock,
    }));

    return {
        createClient: createClientMock,
    };
});

const defaultEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

process.env.NEXT_PUBLIC_SUPABASE_URL = defaultEnv.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = defaultEnv.SUPABASE_SERVICE_ROLE_KEY;

import { POST } from "@/app/api/menu/insert-item/route";

type ItemsInsertResult = { data: { id: string } | null; error: unknown };

describe("POST /api/menu/insert-item", () => {
    let itemsInsertResult: ItemsInsertResult;
    let menuItemsInsertError: unknown;
    let itemMediaInsertError: unknown;

    let itemsInsertMock: jest.Mock;
    let itemsSelectMock: jest.Mock;
    let itemsSingleMock: jest.Mock;
    let menuItemsInsertMock: jest.Mock;
    let itemMediaInsertMock: jest.Mock;

    let itemsInsertPayload: unknown;
    let menuItemsInsertPayload: unknown;
    let itemMediaInsertPayload: unknown;

    beforeEach(() => {
        jest.clearAllMocks();

        itemsInsertResult = { data: { id: "new-item-id" }, error: null };
        menuItemsInsertError = null;
        itemMediaInsertError = null;

        itemsSingleMock = jest.fn(async () => itemsInsertResult);
        itemsSelectMock = jest.fn(() => ({ single: itemsSingleMock }));
        itemsInsertMock = jest.fn((payload: unknown) => {
            itemsInsertPayload = payload;
            return { select: itemsSelectMock };
        });

        menuItemsInsertMock = jest.fn(async (payload: unknown) => {
            menuItemsInsertPayload = payload;
            return { error: menuItemsInsertError };
        });

        itemMediaInsertMock = jest.fn(async (payload: unknown) => {
            itemMediaInsertPayload = payload;
            return { error: itemMediaInsertError };
        });

        itemsInsertPayload = undefined;
        menuItemsInsertPayload = undefined;
        itemMediaInsertPayload = undefined;

        fromMock.mockImplementation((table: string) => {
            switch (table) {
                case "items":
                    return { insert: itemsInsertMock };
                case "menu_items":
                    return { insert: menuItemsInsertMock };
                case "item_media":
                    return { insert: itemMediaInsertMock };
                default:
                    throw new Error(`Unexpected table: ${table}`);
            }
        });
    });

    afterAll(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it("returns 400 when required fields are missing", async () => {
        const req = new Request("http://localhost/api/menu/insert-item", {
            method: "POST",
            body: JSON.stringify({
                restaurantId: "rest-1",
                categoryId: "cat-1",
                name: "Item",
                price_cents: 1000,
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json).toEqual({
            error: "menuId, restaurantId, categoryId, name and price_cents are required",
        });
        expect(itemsInsertMock).not.toHaveBeenCalled();
        expect(menuItemsInsertMock).not.toHaveBeenCalled();
    });

    it("inserts the item, menu association, media and returns success", async () => {
        itemsInsertResult = { data: { id: "item-123" }, error: null };

        const imageBase64 = "data:image/png;base64,abc";
        const req = new Request("http://localhost/api/menu/insert-item", {
            method: "POST",
            body: JSON.stringify({
                menuId: "menu-1",
                restaurantId: "rest-1",
                categoryId: "cat-1",
                name: "  Fancy Item  ",
                description: "  Description text  ",
                price_cents: 1599,
                is_available: "",
                imageBase64,
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, itemId: "item-123" });

        expect(itemsInsertMock).toHaveBeenCalledTimes(1);
        expect(itemsInsertPayload).toEqual([
            {
                restaurant_id: "rest-1",
                category_id: "cat-1",
                name: "Fancy Item",
                description: "Description text",
                price_cents: 1599,
                is_available: false,
                image_path: imageBase64,
                position: 0,
            },
        ]);
        expect(itemsSelectMock).toHaveBeenCalledWith("id");

        expect(menuItemsInsertMock).toHaveBeenCalledTimes(1);
        expect(menuItemsInsertPayload).toEqual([
            { menu_id: "menu-1", item_id: "item-123", position: 0 },
        ]);

        expect(itemMediaInsertMock).toHaveBeenCalledTimes(1);
        expect(itemMediaInsertPayload).toEqual([
            { item_id: "item-123", media_type: "image", url: imageBase64 },
        ]);
    });

    it("returns success with warning when media insertion fails", async () => {
        itemsInsertResult = { data: { id: "item-999" }, error: null };
        itemMediaInsertError = { message: "media failed" };

        const imageBase64 = "data:image/png;base64,xyz";
        const req = new Request("http://localhost/api/menu/insert-item", {
            method: "POST",
            body: JSON.stringify({
                menuId: "menu-9",
                restaurantId: "rest-9",
                categoryId: "cat-9",
                name: "Menu Item",
                price_cents: 500,
                is_available: true,
                imageBase64,
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, itemId: "item-999", warning: "Falha ao salvar item_media" });

        expect(itemsInsertPayload).toEqual([
            {
                restaurant_id: "rest-9",
                category_id: "cat-9",
                name: "Menu Item",
                description: null,
                price_cents: 500,
                is_available: true,
                image_path: imageBase64,
                position: 0,
            },
        ]);

        expect(menuItemsInsertMock).toHaveBeenCalledTimes(1);
        expect(itemMediaInsertMock).toHaveBeenCalledTimes(1);
        expect(itemMediaInsertPayload).toEqual([
            { item_id: "item-999", media_type: "image", url: imageBase64 },
        ]);
    });
});
