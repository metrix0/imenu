import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { POST } from "./route";

jest.mock("@/lib/auth/restaurantOwner", () => ({
    ...jest.requireActual("@/lib/auth/restaurantOwner"),
    requireRestaurantOwner: jest.fn(),
}));
jest.mock("@/lib/database/supabaseServerClient", () => ({ createSupabaseServerClient: jest.fn() }));

const restaurant = "30000000-0000-4000-8000-000000000001";
const item = "30000000-0000-4000-8000-000000000002";
const cover = "menu-images/legacy-cover.webp";
const request = (path = cover) => new Request(
    "http://localhost:3000/api/menu/item-media?restaurantId=" + restaurant + "&itemId=" + item,
    { method: "POST", body: JSON.stringify({ path }) },
);

const copy = jest.fn();
const exists = jest.fn();
const maybeSingle = jest.fn();
const eq = jest.fn();

beforeEach(() => {
    jest.clearAllMocks();
    (requireRestaurantOwner as jest.Mock).mockResolvedValue({});
    maybeSingle.mockResolvedValue({ data: { image_path: cover, gallery_media: [] }, error: null });
    copy.mockResolvedValue({ error: null });
    exists.mockResolvedValue({ data: false });
    eq.mockReturnValue({ eq, maybeSingle });
    (createSupabaseServerClient as jest.Mock).mockReturnValue({
        from: () => ({ select: () => ({ eq }) }),
        storage: { from: () => ({ copy, exists }) },
    });
});

it("copies the current cover to the gallery after verifying the restaurant and item", async () => {
    const response = await POST(request());
    const { path } = await response.json();

    expect(response.status).toBe(200);
    expect(requireRestaurantOwner).toHaveBeenCalledWith(expect.any(Request), restaurant);
    expect(eq.mock.calls).toEqual([["restaurant_id", restaurant], ["id", item]]);
    expect(copy).toHaveBeenCalledWith(cover, path);
    expect(path).toMatch(new RegExp("^menu-gallery/" + restaurant + "/legacy-[a-f0-9]{64}\\.webp$"));
});

it("rejects an unreferenced cover before calling storage", async () => {
    const response = await POST(request("menu-images/other.webp"));
    expect(response.status).toBe(409);
    expect(copy).not.toHaveBeenCalled();
});

it("rejects a caller who does not own the restaurant before calling storage", async () => {
    (requireRestaurantOwner as jest.Mock).mockRejectedValueOnce(new RestaurantOwnerAuthError("Acesso negado.", 403));
    expect((await POST(request())).status).toBe(403);
    expect(copy).not.toHaveBeenCalled();
});

it("reuses the same destination when a prior request already copied the cover", async () => {
    const original = await POST(request());
    const { path } = await original.json();
    copy.mockResolvedValueOnce({ error: new Error("Asset already exists") });
    exists.mockResolvedValueOnce({ data: true });

    const retry = await POST(request());
    expect(retry.status).toBe(200);
    expect(exists).toHaveBeenCalledWith(path);
    await expect(retry.json()).resolves.toEqual({ path });
});

it("returns a readable error when the storage copy fails", async () => {
    copy.mockResolvedValueOnce({ error: new TypeError("Failed to fetch") });
    const warning = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
        const response = await POST(request());
        expect(response.status).toBe(502);
        await expect(response.json()).resolves.toEqual({ error: "Não foi possível mover a foto principal." });
    } finally {
        warning.mockRestore();
    }
});
