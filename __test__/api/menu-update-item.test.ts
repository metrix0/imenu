const storageRemoveMock = jest.fn();
const storageFromMock = jest.fn(() => ({ remove: storageRemoveMock }));
const fromMock = jest.fn();
let createClientMock: jest.Mock;

jest.mock("@supabase/supabase-js", () => {
    createClientMock = jest.fn(() => ({
        from: fromMock,
        storage: {
            from: storageFromMock,
        },
    }));

    return {
        createClient: createClientMock,
    };
});

import { POST } from "@/app/api/menu/update-item/route";

type UpdateCall = {
    data: Record<string, unknown>;
    eq: jest.Mock;
};

const defaultEnv = {
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

function createEqChain<T>(finalResult: T, requiredCalls: number): { eq: jest.Mock } {
    const chain: { eq: jest.Mock } = {
        eq: jest.fn(() => {
            const calls = chain.eq.mock.calls.length;
            if (calls >= requiredCalls) {
                return Promise.resolve(finalResult);
            }
            return chain;
        }),
    };

    return chain;
}

describe("POST /api/menu/update-item", () => {
    let itemsUpdateCalls: UpdateCall[];
    let selectResult: { data: Array<{ id: string; url: string }>; error: null };
    let deleteResult: { error: null };

    beforeEach(() => {
        jest.clearAllMocks();
        storageRemoveMock.mockResolvedValue({ data: null, error: null });
        process.env.NEXT_PUBLIC_SUPABASE_URL = defaultEnv.NEXT_PUBLIC_SUPABASE_URL;
        process.env.SUPABASE_SERVICE_ROLE_KEY = defaultEnv.SUPABASE_SERVICE_ROLE_KEY;

        itemsUpdateCalls = [];
        selectResult = { data: [], error: null };
        deleteResult = { error: null };

        fromMock.mockImplementation((table: string) => {
            if (table === "items") {
                return {
                    update: jest.fn((data: Record<string, unknown>) => {
                        const chain = createEqChain({ error: null }, 1);
                        itemsUpdateCalls.push({ data, eq: chain.eq });
                        return chain;
                    }),
                };
            }

            if (table === "item_media") {
                return {
                    select: jest.fn(() => {
                        const chain = createEqChain(selectResult, 2);
                        return chain;
                    }),
                    delete: jest.fn(() => {
                        const chain = createEqChain(deleteResult, 2);
                        return chain;
                    }),
                };
            }

            throw new Error(`Unexpected table: ${table}`);
        });
    });

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    });

    it("removes media when requested and clears the item image path", async () => {
        selectResult = {
            data: [
                { id: "media-1", url: "menu-images/item-1.png" },
                { id: "media-2", url: "menu-images/item-2.png" },
            ],
            error: null,
        };

        const req = new Request("http://localhost/api/menu/update-item", {
            method: "POST",
            body: JSON.stringify({
                itemId: "item-123",
                name: "Updated Item",
                imageDeleted: true,
                originalImagePath: "menu-images/original.png",
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true });

        // initial fields update + image_path cleanup
        expect(itemsUpdateCalls).toHaveLength(2);
        expect(itemsUpdateCalls[1].data).toEqual({ image_path: null });

        expect(storageFromMock).toHaveBeenCalledTimes(2);
        expect(storageRemoveMock).toHaveBeenCalledTimes(2);
        expect(storageRemoveMock).toHaveBeenNthCalledWith(1, ["menu-images/item-1.png"]);
        expect(storageRemoveMock).toHaveBeenNthCalledWith(2, ["menu-images/item-2.png"]);
    });

    it("falls back to removing the original image path when no media rows are found", async () => {
        selectResult = {
            data: [],
            error: null,
        };

        const originalUrl =
            "https://supabase.test/storage/v1/object/public/menu-images/original%20image.png";

        const req = new Request("http://localhost/api/menu/update-item", {
            method: "POST",
            body: JSON.stringify({
                itemId: "item-123",
                name: "Updated Item",
                imageDeleted: true,
                originalImagePath: originalUrl,
            }),
            headers: { "Content-Type": "application/json" },
        });

        const res = await POST(req);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json).toEqual({ ok: true });

        expect(storageFromMock).toHaveBeenCalledTimes(1);
        expect(storageFromMock).toHaveBeenCalledWith("menu-images");
        expect(storageRemoveMock).toHaveBeenCalledTimes(1);
        expect(storageRemoveMock).toHaveBeenCalledWith(["original image.png"]);
    });
});
