const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
    createClient: createClientMock,
}));

describe("POST /api/menu/delete-item", () => {
    beforeAll(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.local";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    });

    afterEach(() => {
        jest.resetModules();
        createClientMock.mockReset();
    });

    const createRequest = (body: unknown) =>
        new Request("http://localhost/api/menu/delete-item", {
            method: "POST",
            body: JSON.stringify(body),
        });

    it("returns 400 when itemId is missing", async () => {
        const supabaseMock = {
            from: jest.fn(),
            storage: { from: jest.fn() },
            rpc: jest.fn(),
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/delete-item/route");

        const res = await POST(createRequest({}));
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("itemId required");
        expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it("deletes the item and its media successfully", async () => {
        const singleMock = jest.fn().mockResolvedValue({
            data: { image_path: "menu-images/item.png" },
            error: null,
        });
        const selectEqMock = jest.fn().mockReturnValue({ single: singleMock });
        const selectMock = jest.fn().mockReturnValue({ eq: selectEqMock });

        const storageRemoveMock = jest.fn().mockResolvedValue({ error: null });
        const storageFromMock = jest.fn().mockReturnValue({ remove: storageRemoveMock });

        const rpcMock = jest.fn().mockResolvedValue({ data: { success: true }, error: null });

        const fromMock = jest.fn((table: string) => {
            if (table === "items") return { select: selectMock };
            throw new Error(`Unexpected table ${table}`);
        });

        const supabaseMock = {
            from: fromMock,
            storage: { from: storageFromMock },
            rpc: rpcMock,
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/delete-item/route");

        const res = await POST(createRequest({ itemId: "item-1" }));
        const json = await res.json();

        expect(selectMock).toHaveBeenCalledWith("image_path");
        expect(selectEqMock).toHaveBeenCalledWith("id", "item-1");
        expect(storageFromMock).toHaveBeenCalledWith("menu-images");
        expect(storageRemoveMock).toHaveBeenCalledWith(["menu-images/item.png"]);
        expect(rpcMock).toHaveBeenCalledWith("delete_item_completely", { p_item_id: "item-1" });

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, rpcData: { success: true } });
    });

    it("returns 500 when the item lookup fails", async () => {
        const singleMock = jest.fn().mockResolvedValue({ data: null, error: { message: "nope" } });
        const selectEqMock = jest.fn().mockReturnValue({ single: singleMock });
        const selectMock = jest.fn().mockReturnValue({ eq: selectEqMock });

        const supabaseMock = {
            from: jest.fn((table: string) => ({ select: selectMock })),
            storage: { from: jest.fn() },
            rpc: jest.fn(),
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/delete-item/route");

        const res = await POST(createRequest({ itemId: "bad" }));
        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json.error).toBe("Erro ao buscar item");
    });

    it("returns 500 when the RPC fails", async () => {
        const singleMock = jest.fn().mockResolvedValue({ data: { image_path: null }, error: null });
        const selectEqMock = jest.fn().mockReturnValue({ single: singleMock });
        const selectMock = jest.fn().mockReturnValue({ eq: selectEqMock });

        const rpcMock = jest.fn().mockResolvedValue({ data: null, error: { message: "fail" } });

        const supabaseMock = {
            from: jest.fn((table: string) => ({ select: selectMock })),
            storage: { from: jest.fn(() => ({ remove: jest.fn().mockResolvedValue({ error: null }) })) },
            rpc: rpcMock,
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/delete-item/route");

        const res = await POST(createRequest({ itemId: "item-3" }));
        const json = await res.json();

        expect(rpcMock).toHaveBeenCalledWith("delete_item_completely", { p_item_id: "item-3" });
        expect(res.status).toBe(500);
        expect(json.error).toBe("Erro ao deletar item no DB");
    });
});
