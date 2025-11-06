const storageRemoveMock = jest.fn();
const storageFromMock = jest.fn(() => ({ remove: storageRemoveMock }));
const rpcMock = jest.fn();
const fromMock = jest.fn();
let createClientMock: jest.Mock;

jest.mock("@supabase/supabase-js", () => {
    createClientMock = jest.fn(() => ({
        from: fromMock,
        storage: {
            from: storageFromMock,
        },
        rpc: rpcMock,
    }));

    return {
        createClient: createClientMock,
    };
});

import { POST } from "@/app/api/menu/delete-item/route";

type SingleResult = { data: { image_path: string | null } | null; error: unknown };

describe("POST /api/menu/delete-item", () => {
    const defaultEnv = {
        NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    };

    let selectMock: jest.Mock;
    let eqMock: jest.Mock;
    let singleMock: jest.Mock<Promise<SingleResult>, []>;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env.NEXT_PUBLIC_SUPABASE_URL = defaultEnv.NEXT_PUBLIC_SUPABASE_URL;
        process.env.SUPABASE_SERVICE_ROLE_KEY = defaultEnv.SUPABASE_SERVICE_ROLE_KEY;

        singleMock = jest.fn();
        eqMock = jest.fn(() => ({ single: singleMock }));
        selectMock = jest.fn(() => ({ eq: eqMock }));

        fromMock.mockImplementation((table: string) => {
            if (table === "items") {
                return {
                    select: selectMock,
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        });

        storageRemoveMock.mockResolvedValue({ data: null, error: null });
        rpcMock.mockResolvedValue({ data: { deleted: true }, error: null });
    });

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it("returns 400 when itemId is missing", async () => {
        const req = new Request("http://localhost/api/menu/delete-item", {
            method: "POST",
            body: JSON.stringify({}),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json).toEqual({ error: "itemId required" });
    });

    it("removes storage image and calls RPC when image_path exists", async () => {
        singleMock.mockResolvedValue({ data: { image_path: "menu-images/item-123.png" }, error: null });

        const req = new Request("http://localhost/api/menu/delete-item", {
            method: "POST",
            body: JSON.stringify({ itemId: "item-123" }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, rpcData: { deleted: true } });

        expect(fromMock).toHaveBeenCalledWith("items");
        expect(selectMock).toHaveBeenCalledWith("image_path");
        expect(eqMock).toHaveBeenCalledWith("id", "item-123");

        expect(storageFromMock).toHaveBeenCalledWith("menu-images");
        expect(storageRemoveMock).toHaveBeenCalledTimes(1);
        expect(storageRemoveMock).toHaveBeenCalledWith(["menu-images/item-123.png"]);

        expect(rpcMock).toHaveBeenCalledWith("delete_item_completely", { p_item_id: "item-123" });
    });

    it("skips storage removal when image_path is absent", async () => {
        singleMock.mockResolvedValue({ data: { image_path: null }, error: null });

        const req = new Request("http://localhost/api/menu/delete-item", {
            method: "POST",
            body: JSON.stringify({ itemId: "item-456" }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true, rpcData: { deleted: true } });

        expect(storageFromMock).not.toHaveBeenCalled();
        expect(storageRemoveMock).not.toHaveBeenCalled();

        expect(rpcMock).toHaveBeenCalledWith("delete_item_completely", { p_item_id: "item-456" });
    });

    it("returns 500 when RPC returns an error", async () => {
        singleMock.mockResolvedValue({ data: { image_path: null }, error: null });
        rpcMock.mockResolvedValue({ data: null, error: { message: "RPC failed" } });

        const req = new Request("http://localhost/api/menu/delete-item", {
            method: "POST",
            body: JSON.stringify({ itemId: "item-789" }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json).toEqual({ error: "Erro ao deletar item no DB", detail: { message: "RPC failed" } });

        expect(rpcMock).toHaveBeenCalledWith("delete_item_completely", { p_item_id: "item-789" });
    });
});
