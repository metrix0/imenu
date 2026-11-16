import sharp from "sharp";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { downloadPublicMenuPhoto } from "@/lib/menu/readPublicMenuLink";
import { importMenuPhotos } from "./importMenuPhotos";

jest.mock("@/lib/database/supabaseServerClient", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("@/lib/menu/readPublicMenuLink", () => ({ downloadPublicMenuPhoto: jest.fn() }));

const upload = jest.fn();
const photo = (filename: string, names: string[], area = 10_000) =>
    ({ url: "https://images.example.test/" + filename, names, area });
const item = (name: string) => ({ name, image_path: null as string | null });

beforeEach(() => {
    jest.resetAllMocks();
    (createSupabaseServerClient as jest.Mock).mockReturnValue({
        storage: {
            from: (bucket: string) => {
                expect(bucket).toBe("menu-images");
                return { upload };
            },
        },
    });
    upload.mockResolvedValue({ error: null });
});

it("stores a normalized WebP photo once for products sharing the source image", async () => {
    const image = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#802808" } })
        .png().toBuffer();
    (downloadPublicMenuPhoto as jest.Mock).mockResolvedValue(image);
    const items = [item("Guaraná Lata"), item("Guaraná Zero"), item("Água"), item("Outro"), item("Outro")];
    await importMenuPhotos("test-restaurant", items, [
        photo("small.jpg", ["Guaraná Lata"], 1500),
        photo("large.jpg", ["Guarana Lata", "Guaraná Zero"]),
        photo("logo.jpg", ["Logo da loja"]),
        photo("ambiguous.jpg", ["Outro"]),
    ]);

    expect(downloadPublicMenuPhoto).toHaveBeenCalledTimes(1);
    expect(downloadPublicMenuPhoto).toHaveBeenCalledWith("https://images.example.test/large.jpg", expect.any(AbortSignal));
    expect(upload).toHaveBeenCalledTimes(1);
    const [key, bytes, options] = upload.mock.calls[0];
    expect(key).toMatch(/^menu-images\/test-restaurant\/[0-9a-f]{64}\.webp$/);
    expect(await sharp(bytes).metadata()).toMatchObject({ format: "webp", width: 500, height: 333 });
    expect(options).toMatchObject({ contentType: "image/webp", upsert: false });
    expect(items.map(product => product.image_path)).toEqual([key, key, null, null, null]);
});

it("keeps an item without a corrupt photo and reuses an existing identical photo", async () => {
    const image = await sharp({ create: { width: 80, height: 80, channels: 3, background: "#0080aa" } })
        .png().toBuffer();
    (downloadPublicMenuPhoto as jest.Mock).mockImplementation(async (url: string) =>
        url.endsWith("bad.jpg") ? Buffer.from("not an image") : image);
    upload.mockResolvedValue({ error: { statusCode: "409" } });
    const items = [item("Café"), item("Suco")];

    await importMenuPhotos("test-restaurant", items, [
        photo("bad.jpg", ["Café"]),
        photo("suco.jpg", ["Suco"]),
    ]);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(items[0].image_path).toBeNull();
    expect(items[1].image_path).toBe(upload.mock.calls[0][0]);
});
