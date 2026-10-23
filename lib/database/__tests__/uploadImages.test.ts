import { supabase } from "@/lib/database/supabaseClient";
import { compressImageForUpload } from "@/lib/utils/compressImageForUpload";
import { uploadBannerImage } from "../uploadBannerImage";
import { uploadLogoImage } from "../uploadLogoImage";

jest.mock("@/lib/database/supabaseClient", () => ({
    supabase: { storage: { from: jest.fn() } },
}));
jest.mock("@/lib/utils/compressImageForUpload", () => ({
    compressImageForUpload: jest.fn(),
}));

const from = supabase.storage.from as jest.Mock;
const compress = compressImageForUpload as jest.Mock;
const upload = jest.fn();
const optimized = { name: "image.webp", type: "image/webp" };

beforeEach(() => {
    jest.clearAllMocks();
    compress.mockResolvedValue(optimized);
    upload.mockResolvedValue({ error: null });
    from.mockReturnValue({ upload });
});

it("preserves banner compression settings, bucket and upload metadata", async () => {
    const file = { name: "banner.png" } as File;
    const key = await uploadBannerImage(file);
    expect(key).toMatch(/^[0-9a-f-]+-image\.webp$/);
    expect(compress).toHaveBeenCalledWith(file, {
        maxWidth: 1920, maxHeight: 1080, targetBytes: 450 * 1024,
        initialQuality: 0.84, minQuality: 0.56, outputType: "image/webp",
    });
    expect(from).toHaveBeenCalledWith("menu-banners");
    expect(upload).toHaveBeenCalledWith(key, optimized, {
        upsert: false, contentType: "image/webp", cacheControl: "31536000",
    });
});

it("preserves logo compression settings and bucket", async () => {
    const file = { name: "logo.png" } as File;
    await uploadLogoImage(file);
    expect(compress).toHaveBeenCalledWith(file, {
        maxWidth: 640, maxHeight: 640, targetBytes: 200 * 1024,
        initialQuality: 0.86, minQuality: 0.58, outputType: "image/webp",
    });
    expect(from).toHaveBeenCalledWith("restaurant-logos");
});

it("continues to propagate Storage upload failures", async () => {
    const error = new Error("failed");
    upload.mockResolvedValue({ error });
    await expect(uploadLogoImage({ name: "logo.png" } as File)).rejects.toBe(error);
});
