const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
    createClient: createClientMock,
}));

describe("POST /api/menu/delete-category", () => {
    beforeAll(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.local";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    });

    afterEach(() => {
        jest.resetModules();
        createClientMock.mockReset();
    });

    const createRequest = (body: unknown) =>
        new Request("http://localhost/api/menu/delete-category", {
            method: "POST",
            body: JSON.stringify(body),
        });

    it("returns 400 when categoryId is missing", async () => {
        const supabaseMock = {
            from: jest.fn(),
            rpc: jest.fn(),
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/delete-category/route");

        const res = await POST(createRequest({}));
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("categoryId required");
        expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it("deletes the category using RPC for each item when available", async () => {
        const selectMock = jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [{ id: "item-1" }, { id: "item-2" }], error: null }),
        });

        const deleteEqMock = jest.fn().mockResolvedValue({ error: null });
        const deleteMock = jest.fn().mockReturnValue({ eq: deleteEqMock });

        const rpcMock = jest
            .fn()
            .mockResolvedValue({ data: { ok: true }, error: null });

        const fromMock = jest.fn((table: string) => {
            if (table === "items") return { select: selectMock };
            if (table === "categories") return { delete: deleteMock };
            throw new Error(`Unexpected table ${table}`);
        });

        const supabaseMock = {
            from: fromMock,
            rpc: rpcMock,
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/delete-category/route");

        const res = await POST(createRequest({ categoryId: "cat-1" }));
        const json = await res.json();

        expect(selectMock).toHaveBeenCalledWith("id");
        expect(rpcMock).toHaveBeenCalledTimes(2);
        expect(rpcMock).toHaveBeenNthCalledWith(1, "delete_item_completely", { p_item_id: "item-1" });
        expect(rpcMock).toHaveBeenNthCalledWith(2, "delete_item_completely", { p_item_id: "item-2" });
        expect(deleteMock).toHaveBeenCalled();
        expect(deleteEqMock).toHaveBeenCalledWith("id", "cat-1");

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, deleted_items: 2 });
    });

    it("falls back to manual deletion when the RPC fails", async () => {
        const selectMock = jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [{ id: "item-99" }], error: null }),
        });

        const rpcMock = jest.fn().mockResolvedValue({ data: null, error: { message: "rpc failed" } });

        const orderUpdateInMock = jest.fn().mockResolvedValue({ error: null });
        const orderUpdateMock = jest.fn().mockReturnValue({ in: orderUpdateInMock });

        const mediaDeleteInMock = jest.fn().mockResolvedValue({ error: null });
        const mediaDeleteMock = jest.fn().mockReturnValue({ in: mediaDeleteInMock });

        const menuItemsDeleteInMock = jest.fn().mockResolvedValue({ error: null });
        const menuItemsDeleteMock = jest.fn().mockReturnValue({ in: menuItemsDeleteInMock });

        const itemsDeleteInMock = jest.fn().mockResolvedValue({ error: null });
        const itemsDeleteMock = jest.fn().mockReturnValue({ in: itemsDeleteInMock });

        const catDeleteEqMock = jest.fn().mockResolvedValue({ error: null });
        const catDeleteMock = jest.fn().mockReturnValue({ eq: catDeleteEqMock });

        const fromMock = jest.fn((table: string) => {
            if (table === "items") return { select: selectMock, delete: itemsDeleteMock };
            if (table === "order_items") return { update: orderUpdateMock };
            if (table === "item_media") return { delete: mediaDeleteMock };
            if (table === "menu_items") return { delete: menuItemsDeleteMock };
            if (table === "categories") return { delete: catDeleteMock };
            throw new Error(`Unexpected table ${table}`);
        });

        const supabaseMock = {
            from: fromMock,
            rpc: rpcMock,
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/delete-category/route");

        const res = await POST(createRequest({ categoryId: "cat-99" }));
        const json = await res.json();

        expect(rpcMock).toHaveBeenCalledWith("delete_item_completely", { p_item_id: "item-99" });
        expect(orderUpdateMock).toHaveBeenCalledWith({ item_id: null });
        expect(orderUpdateInMock).toHaveBeenCalledWith("item_id", ["item-99"]);
        expect(mediaDeleteInMock).toHaveBeenCalledWith("item_id", ["item-99"]);
        expect(menuItemsDeleteInMock).toHaveBeenCalledWith("item_id", ["item-99"]);
        expect(itemsDeleteInMock).toHaveBeenCalledWith("id", ["item-99"]);
        expect(catDeleteEqMock).toHaveBeenCalledWith("id", "cat-99");

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, deleted_items: 1 });
    });

    it("returns 500 when fallback order item nullification fails", async () => {
        const selectMock = jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: [{ id: "item-77" }], error: null }),
        });

        const rpcMock = jest.fn().mockResolvedValue({ data: null, error: { message: "rpc failed" } });

        const orderUpdateInMock = jest.fn().mockResolvedValue({ error: { message: "order fail" } });
        const orderUpdateMock = jest.fn().mockReturnValue({ in: orderUpdateInMock });

        const catDeleteMock = jest.fn();

        const fromMock = jest.fn((table: string) => {
            if (table === "items") return { select: selectMock };
            if (table === "order_items") return { update: orderUpdateMock };
            if (table === "categories") return { delete: catDeleteMock };
            throw new Error(`Unexpected table ${table}`);
        });

        const supabaseMock = {
            from: fromMock,
            rpc: rpcMock,
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/delete-category/route");

        const res = await POST(createRequest({ categoryId: "cat-err" }));
        const json = await res.json();

        expect(orderUpdateInMock).toHaveBeenCalledWith("item_id", ["item-77"]);
        expect(res.status).toBe(500);
        expect(json.error).toBe("Failed to nullify order_items");
    });
});
