import sharp from "sharp";
import { sendWahaImage } from "./wahaClient";
const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
test("cart images are bounded and converted to WAHA JPEG attachments", async () => {
  process.env.WAHA_API_URL = "http://waha.test";
  process.env.WAHA_API_KEY = "test-only";
  const png = await sharp({
    create: {
      width: 8,
      height: 8,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  const fetchMock = jest
    .fn()
    .mockResolvedValueOnce(new Response(new Uint8Array(png), { status: 200 }))
    .mockResolvedValueOnce(new Response('{"id":"test"}', { status: 200 }));
  global.fetch = fetchMock;
  await sendWahaImage(
    "test-session",
    "5511999991234@c.us",
    "https://storage.test/own-image.png",
    "Seu pedido",
  );
  const payload = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(payload.file).toMatchObject({
    mimetype: "image/jpeg",
    filename: "produto.jpg",
  });
  expect(
    (await sharp(Buffer.from(payload.file.data, "base64")).metadata()).format,
  ).toBe("jpeg");
  expect(payload.caption).toBe("Seu pedido");
});
