const rpcMock = jest.fn();
const fromMock = jest.fn();
let createClientMock: jest.Mock;

const mockClient = {
    rpc: rpcMock,
    from: fromMock,
};

jest.mock("@supabase/supabase-js", () => {
    createClientMock = jest.fn(() => mockClient);

    return {
        createClient: createClientMock,
    };
});

const defaultEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

type SupabaseResult<T = unknown> = Promise<{ data?: T; error: any }>;

describe("POST /api/menu/delete-category", () => {
    let POST: typeof import("@/app/api/menu/delete-category/route").POST;

    let itemsSelectResponse: { data: Array<{ id: string }>; error: any };
    let itemsDeleteResponse: { error: any };
    let orderItemsUpdateResponse: { error: any };
    let itemMediaDeleteResponse: { error: any };
    let menuItemsDeleteResponse: { error: any };
    let categoriesDeleteResponse: { error: any };

    let itemsSelectMock: jest.Mock;
    let itemsSelectEqMock: jest.Mock<
        SupabaseResult<Array<{ id: string }>>,
        [string, string]
    >;
    let itemsDeleteMock: jest.Mock;
    let itemsDeleteInMock: jest.Mock<SupabaseResult, [string, string[]]>;

    let orderItemsUpdateMock: jest.Mock;
    let orderItemsInMock: jest.Mock<SupabaseResult, [string, string[]]>;

    let itemMediaDeleteMock: jest.Mock;
    let itemMediaInMock: jest.Mock<SupabaseResult, [string, string[]]>;

    let menuItemsDeleteMock: jest.Mock;
    let menuItemsInMock: jest.Mock<SupabaseResult, [string, string[]]>;

    let categoriesDeleteMock: jest.Mock;
    let categoriesEqMock: jest.Mock<SupabaseResult, [string, string]>;

    let rpcResponses: Array<{ data?: unknown; error: any }>;

    async function importRoute() {
        ({ POST } = await import("@/app/api/menu/delete-category/route"));
    }

    beforeEach(async () => {
        jest.resetModules();
        jest.clearAllMocks();

        process.env.NEXT_PUBLIC_SUPABASE_URL = defaultEnv.NEXT_PUBLIC_SUPABASE_URL;
        process.env.SUPABASE_SERVICE_ROLE_KEY = defaultEnv.SUPABASE_SERVICE_ROLE_KEY;

        rpcResponses = [];

        rpcMock.mockImplementation(() => {
            const result = rpcResponses.shift() ?? { data: null, error: null };
            return Promise.resolve(result);
        });

        itemsSelectResponse = { data: [], error: null };
        itemsDeleteResponse = { error: null };
        orderItemsUpdateResponse = { error: null };
        itemMediaDeleteResponse = { error: null };
        menuItemsDeleteResponse = { error: null };
        categoriesDeleteResponse = { error: null };

        itemsSelectEqMock = jest.fn(async (column: string, value: string) => {
            return { ...itemsSelectResponse };
        });
        itemsSelectMock = jest.fn(() => ({ eq: itemsSelectEqMock }));

        itemsDeleteInMock = jest.fn(async (column: string, values: string[]) => {
            return { ...itemsDeleteResponse };
        });
        itemsDeleteMock = jest.fn(() => ({ in: itemsDeleteInMock }));

        orderItemsInMock = jest.fn(async (column: string, values: string[]) => {
            return { ...orderItemsUpdateResponse };
        });
        orderItemsUpdateMock = jest.fn((data: Record<string, unknown>) => ({
            in: orderItemsInMock,
        }));

        itemMediaInMock = jest.fn(async (column: string, values: string[]) => {
            return { ...itemMediaDeleteResponse };
        });
        itemMediaDeleteMock = jest.fn(() => ({ in: itemMediaInMock }));

        menuItemsInMock = jest.fn(async (column: string, values: string[]) => {
            return { ...menuItemsDeleteResponse };
        });
        menuItemsDeleteMock = jest.fn(() => ({ in: menuItemsInMock }));

        categoriesEqMock = jest.fn(async (column: string, value: string) => {
            return { ...categoriesDeleteResponse };
        });
        categoriesDeleteMock = jest.fn(() => ({ eq: categoriesEqMock }));

        fromMock.mockImplementation((table: string) => {
            switch (table) {
                case "items":
                    return {
                        select: itemsSelectMock,
                        delete: itemsDeleteMock,
                    };
                case "order_items":
                    return {
                        update: orderItemsUpdateMock,
                    };
                case "item_media":
                    return {
                        delete: itemMediaDeleteMock,
                    };
                case "menu_items":
                    return {
                        delete: menuItemsDeleteMock,
                    };
                case "categories":
                    return {
                        delete: categoriesDeleteMock,
                    };
                default:
                    throw new Error(`Unexpected table: ${table}`);
            }
        });

        await importRoute();
    });

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it("returns 400 when categoryId is missing", async () => {
        const req = new Request("http://localhost/api/menu/delete-category", {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json).toEqual({ error: "categoryId required" });
        expect(fromMock).not.toHaveBeenCalled();
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it("uses the delete_item_completely RPC for each item and deletes the category", async () => {
        itemsSelectResponse = {
            data: [
                { id: "item-1" },
                { id: "item-2" },
            ],
            error: null,
        };
        categoriesDeleteResponse = { error: null };

        rpcResponses.push({ data: { ok: true }, error: null });
        rpcResponses.push({ data: { ok: true }, error: null });

        const req = new Request("http://localhost/api/menu/delete-category", {
            method: "POST",
            body: JSON.stringify({ categoryId: "cat-123" }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, deleted_items: 2 });

        expect(createClientMock).toHaveBeenCalledWith(
            defaultEnv.NEXT_PUBLIC_SUPABASE_URL,
            defaultEnv.SUPABASE_SERVICE_ROLE_KEY,
        );

        expect(itemsSelectMock).toHaveBeenCalledTimes(1);
        expect(itemsSelectEqMock).toHaveBeenCalledWith("category_id", "cat-123");

        expect(rpcMock).toHaveBeenCalledTimes(2);
        expect(rpcMock).toHaveBeenNthCalledWith(1, "delete_item_completely", { p_item_id: "item-1" });
        expect(rpcMock).toHaveBeenNthCalledWith(2, "delete_item_completely", { p_item_id: "item-2" });

        expect(orderItemsUpdateMock).not.toHaveBeenCalled();
        expect(itemMediaDeleteMock).not.toHaveBeenCalled();
        expect(menuItemsDeleteMock).not.toHaveBeenCalled();
        expect(itemsDeleteMock).not.toHaveBeenCalled();

        expect(categoriesDeleteMock).toHaveBeenCalledTimes(1);
        expect(categoriesEqMock).toHaveBeenCalledWith("id", "cat-123");
    });

    it("falls back to manual deletions when the RPC fails", async () => {
        itemsSelectResponse = {
            data: [{ id: "item-1" }],
            error: null,
        };

        rpcResponses.push({ data: null, error: { message: "RPC failure" } });

        const req = new Request("http://localhost/api/menu/delete-category", {
            method: "POST",
            body: JSON.stringify({ categoryId: "cat-456" }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, deleted_items: 1 });

        expect(rpcMock).toHaveBeenCalledTimes(1);
        expect(rpcMock).toHaveBeenCalledWith("delete_item_completely", { p_item_id: "item-1" });

        expect(orderItemsUpdateMock).toHaveBeenCalledWith({ item_id: null });
        expect(orderItemsInMock).toHaveBeenCalledWith("item_id", ["item-1"]);

        expect(itemMediaDeleteMock).toHaveBeenCalledTimes(1);
        expect(itemMediaInMock).toHaveBeenCalledWith("item_id", ["item-1"]);

        expect(menuItemsDeleteMock).toHaveBeenCalledTimes(1);
        expect(menuItemsInMock).toHaveBeenCalledWith("item_id", ["item-1"]);

        expect(itemsDeleteMock).toHaveBeenCalledTimes(1);
        expect(itemsDeleteInMock).toHaveBeenCalledWith("id", ["item-1"]);

        expect(categoriesDeleteMock).toHaveBeenCalledTimes(1);
        expect(categoriesEqMock).toHaveBeenCalledWith("id", "cat-456");
    });
});
