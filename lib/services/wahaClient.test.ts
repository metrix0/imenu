import sharp from "sharp";
import { findWahaSentTextSince, sendWahaImage } from "./wahaClient";
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

test("WAHA confirmation matches only a recent outgoing message with the exact text", async () => {
  process.env.WAHA_API_URL = "http://waha.test";
  process.env.WAHA_API_KEY = "test-only";
  const started = Date.now();
  const timestamp = Math.floor(started / 1000);
  const messages = [
    { id: "old", timestamp: timestamp - 120, fromMe: true, body: "Olá! 👋" },
    { id: "incoming", timestamp, fromMe: false, body: "Olá! 👋" },
    { id: "other", timestamp, fromMe: true, body: "Outra mensagem" },
    { id: "confirmed", timestamp: timestamp + 1, fromMe: true, body: "Olá! 👋" },
  ];
  global.fetch = jest.fn().mockResolvedValue(
    new Response(JSON.stringify(messages), { status: 200 })
  );
  const confirmed = await findWahaSentTextSince("session", "123@lid", "Olá! 👋", started);
  expect(confirmed?.id).toBe("confirmed");
});

test("WAHA confirmation is unknown when its recent history has no matching outgoing text", async () => {
  process.env.WAHA_API_URL = "http://waha.test";
  process.env.WAHA_API_KEY = "test-only";
  const started = Date.now();
  global.fetch = jest.fn().mockResolvedValue(
    new Response(JSON.stringify([{ id: "inbound", timestamp: Math.floor(started / 1000), fromMe: false, body: "Bem-vindo" }]), { status: 200 })
  );
  await expect(findWahaSentTextSince("session", "123@lid", "Bem-vindo", started)).resolves.toBeNull();
});
