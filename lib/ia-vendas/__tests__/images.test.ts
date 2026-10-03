import sharp from "sharp";
import { analysisPhotos } from "../images";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import type { Data } from "../types";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/database/supabaseServerClient", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("../data", () => ({ imageUrl: jest.fn() }));
jest.mock("../files", () => ({}));
jest.mock("../runs", () => ({}));
jest.mock("../actions", () => ({}));
const download = jest.fn();
let png: Buffer;
beforeAll(async () => {
  png = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "#b06020" } }).png().toBuffer();
});
beforeEach(() => {
  process.env.SUPABASE_URL = "https://own.supabase.co";
  download.mockReset().mockResolvedValue({ data: { arrayBuffer: async () => png }, error: null });
  (createSupabaseServerClient as jest.Mock).mockReturnValue({ storage: { from: jest.fn().mockReturnValue({ download }) } });
});
const context = (items: Data[], products: Data[] = []): Data => ({
  entities: { items: { rows: items } }, sales: { products }, coverage: {},
});
test("all menu photos become labelled visual inputs, best selling products first without a row cap", async () => {
  const items = Array.from({ length: 97 }, (_, i) => ({ id: `item-${i}`, name: `Produto ${i}`, image_path: `owner/${i}.png` }));
  const ctx = context(items, [
    { item_id: "item-96", units: 20, gross_cents: 20000 },
    { item_id: "item-0", units: 2, gross_cents: 90000 },
  ]);
  const parts = await analysisPhotos(ctx);
  expect(download).toHaveBeenCalledTimes(97);
  expect(parts.filter((p) => p.type === "input_image")).toHaveLength(97);
  expect(parts[0].text).toContain('"item_id":"item-96"');
  expect(parts[2].text).toContain('"item_id":"item-0"');
  expect(ctx.coverage.image_photos).toMatchObject({ loaded: 97, total: 97, complete: true });
  expect(ctx.image_review.photos[0]).toMatchObject({ width: 1200, height: 800, status: "loaded", units: 20 });
  expect(parts[1].detail).toBe("high");
  const actual = await sharp(Buffer.from(parts[1].image_url.split(",")[1], "base64")).metadata();
  expect(actual.width).toBe(768);
  expect(actual.height).toBe(512);
  expect(items[0].id).toBe("item-0");
});
test("missing, unreadable and external photos preserve the rest of the inspection and honest coverage", async () => {
  download.mockImplementation(async (path) => path === "owner/broken.png"
    ? { data: null, error: new Error("missing") }
    : { data: { arrayBuffer: async () => png }, error: null });
  const ctx = context([
    { id: "missing", image_path: null },
    { id: "broken", image_path: "owner/broken.png" },
    { id: "external", image_path: "https://other.example/photo.png" },
    { id: "unsafe", image_path: "http://127.0.0.1/photo" },
    { id: "valid", image_path: "https://own.supabase.co/storage/v1/object/public/menu-images/owner/good.png" },
  ]);
  const parts = await analysisPhotos(ctx);
  expect(download.mock.calls.map(([path]) => path)).toEqual(["owner/broken.png", "owner/good.png"]);
  expect(parts.filter((p) => p.type === "input_image")).toHaveLength(1);
  expect(ctx.coverage.image_photos).toMatchObject({ loaded: 1, total: 4, missing: 1, unavailable: 3, complete: false });
  expect(ctx.image_review.photos.map((p: Data) => p.status)).toEqual(["missing", "unavailable", "unavailable", "unavailable", "loaded"]);
});
test("corrupt image bytes are not marked as visually loaded", async () => {
  download.mockResolvedValue({ data: { arrayBuffer: async () => Buffer.from("not an image") }, error: null });
  const ctx = context([{ id: "broken", image_path: "owner/corrupt.png" }]);
  expect(await analysisPhotos(ctx)).toEqual([]);
  expect(ctx.coverage.image_photos).toMatchObject({ loaded: 0, unavailable: 1, complete: false });
});
