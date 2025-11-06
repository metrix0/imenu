const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
    createClient: createClientMock,
}));

describe("POST /api/menu/update-item", () => {
    beforeAll(() => {
        process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.local";
        process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    });

    afterEach(() => {
        jest.resetModules();
        createClientMock.mockReset();
    });

    const createRequest = (body: unknown) =>
        new Request("http://localhost/api/menu/update-item", {
            method: "POST",
            body: JSON.stringify(body),
        });

    it("returns 400 when itemId is missing", async () => {
        const supabaseMock = {
            from: jest.fn(),
            storage: { from: jest.fn() },
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/update-item/route");

        const res = await POST(createRequest({ name: "Pizza" }));
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("itemId is required");
        expect(supabaseMock.from).not.toHaveBeenCalled();
    });

    it("updates the item fields when no media changes are requested", async () => {
        const updateEqMock = jest.fn().mockResolvedValue({ error: null });
        const updateMock = jest
            .fn()
            .mockReturnValue({ eq: updateEqMock });

        const supabaseMock = {
            from: jest.fn(() => ({ update: updateMock })),
            storage: { from: jest.fn() },
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/update-item/route");

        const res = await POST(
            createRequest({
                itemId: "item-1",
                name: "Updated",
                description: "Desc",
                price_cents: 900,
                category_id: "cat",
                is_available: false,
            })
        );

        expect(updateMock).toHaveBeenCalledWith({
            name: "Updated",
            description: "Desc",
            price_cents: 900,
            category_id: "cat",
            is_available: false,
        });
        expect(updateEqMock).toHaveBeenCalledWith("id", "item-1");

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("replaces the existing image and removes the old storage object", async () => {
        const initialUpdateEqMock = jest.fn().mockResolvedValue({ error: null });
        const imageUpdateEqMock = jest.fn().mockResolvedValue({ error: null });
        const updateMock = jest
            .fn()
            .mockImplementationOnce(() => ({ eq: initialUpdateEqMock }))
            .mockImplementationOnce(() => ({ eq: imageUpdateEqMock }));

        const deleteEqSecondMock = jest.fn().mockResolvedValue({ error: null });
        const deleteEqFirstMock = jest.fn().mockReturnValue({ eq: deleteEqSecondMock });
        const deleteMock = jest.fn().mockReturnValue({ eq: deleteEqFirstMock });

        const mediaInsertMock = jest.fn().mockResolvedValue({ error: null });

        const storageRemoveMock = jest.fn().mockResolvedValue({ error: null });
        const storageFromMock = jest.fn().mockReturnValue({ remove: storageRemoveMock });

        const fromMock = jest.fn((table: string) => {
            if (table === "items") return { update: updateMock };
            if (table === "item_media")
                return {
                    delete: deleteMock,
                    insert: mediaInsertMock,
                };
            throw new Error(`Unexpected table ${table}`);
        });

        const supabaseMock = {
            from: fromMock,
            storage: { from: storageFromMock },
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/update-item/route");

        const res = await POST(
            createRequest({
                itemId: "item-77",
                name: "New",
                imageBase64: "data:image/png;base64,new",
                originalImagePath: "menu-images/old.png",
            })
        );

        expect(initialUpdateEqMock).toHaveBeenCalledWith("id", "item-77");
        expect(deleteMock).toHaveBeenCalled();
        expect(deleteEqFirstMock).toHaveBeenCalledWith("item_id", "item-77");
        expect(deleteEqSecondMock).toHaveBeenCalledWith("media_type", "image");
        expect(storageFromMock).toHaveBeenCalledWith("menu-images");
        expect(storageRemoveMock).toHaveBeenCalledWith(["menu-images/old.png"]);
        expect(mediaInsertMock).toHaveBeenCalledWith([
            { item_id: "item-77", media_type: "image", url: "data:image/png;base64,new" },
        ]);
        expect(imageUpdateEqMock).toHaveBeenCalledWith("id", "item-77");

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("removes media when requested and clears the item image path", async () => {
        const baseUpdateEqMock = jest.fn().mockResolvedValue({ error: null });
        const clearImageEqMock = jest.fn().mockResolvedValue({ error: null });
        const updateMock = jest
            .fn()
            .mockImplementationOnce(() => ({ eq: baseUpdateEqMock }))
            .mockImplementationOnce(() => ({ eq: clearImageEqMock }));

        const selectEqSecondMock = jest.fn().mockResolvedValue({
            data: [
                { url: "menu-images/image-a.png" },
                { url: "https://supabase.local/storage/v1/object/public/menu-images/image-b.png" },
            ],
            error: null,
        });
        const selectEqFirstMock = jest.fn().mockReturnValue({ eq: selectEqSecondMock });
        const selectMock = jest.fn().mockReturnValue({ eq: selectEqFirstMock });

        const deleteEqSecondMock = jest.fn().mockResolvedValue({ error: null });
        const deleteEqFirstMock = jest.fn().mockReturnValue({ eq: deleteEqSecondMock });
        const deleteMock = jest.fn().mockReturnValue({ eq: deleteEqFirstMock });

        const storageRemoveMock = jest.fn().mockResolvedValue({ error: null });
        const storageFromMock = jest.fn().mockReturnValue({ remove: storageRemoveMock });

        const fromMock = jest.fn((table: string) => {
            if (table === "items") return { update: updateMock };
            if (table === "item_media")
                return {
                    select: selectMock,
                    delete: deleteMock,
                };
            if (table === "order_items") return {};
            throw new Error(`Unexpected table ${table}`);
        });

        const supabaseMock = {
            from: fromMock,
            storage: { from: storageFromMock },
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/update-item/route");

        const res = await POST(
            createRequest({
                itemId: "item-12",
                imageDeleted: true,
                originalImagePath: "menu-images/original.png",
            })
        );

        expect(selectMock).toHaveBeenCalledWith("id, url");
        expect(selectEqFirstMock).toHaveBeenCalledWith("item_id", "item-12");
        expect(selectEqSecondMock).toHaveBeenCalledWith("media_type", "image");
        expect(storageRemoveMock).toHaveBeenCalledTimes(3);
        expect(storageRemoveMock).toHaveBeenNthCalledWith(1, ["menu-images/image-a.png"]);
        expect(storageRemoveMock).toHaveBeenNthCalledWith(2, ["image-b.png"]);
        expect(storageRemoveMock).toHaveBeenNthCalledWith(3, ["menu-images/original.png"]);
        expect(deleteEqFirstMock).toHaveBeenCalledWith("item_id", "item-12");
        expect(deleteEqSecondMock).toHaveBeenCalledWith("media_type", "image");
        expect(clearImageEqMock).toHaveBeenCalledWith("id", "item-12");

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true });
    });

    it("returns 500 when the initial update fails", async () => {
        const updateEqMock = jest.fn().mockResolvedValue({ error: { message: "failed" } });
        const updateMock = jest.fn().mockReturnValue({ eq: updateEqMock });

        const supabaseMock = {
            from: jest.fn(() => ({ update: updateMock })),
            storage: { from: jest.fn() },
        } as any;

        createClientMock.mockReturnValue(supabaseMock);
        const { POST } = await import("@/app/api/menu/update-item/route");

        const res = await POST(createRequest({ itemId: "bad" }));
        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json.error).toBe("Erro ao atualizar item");
    });
});
