import { get } from "node:https";
import puppeteer from "puppeteer";
import { startPublicMenuBrowserNetwork } from "./publicMenuBrowserNetwork";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { downloadPublicMenuPhoto, readPublicMenuLink, MenuLinkError } from "./readPublicMenuLink";

jest.mock("puppeteer", () => ({ __esModule: true, default: { launch: jest.fn() } }));
jest.mock("node:https", () => ({ get: jest.fn() }));
jest.mock("./publicMenuBrowserNetwork", () => ({
    isPublicMenuHostname: jest.fn((host: string) => host !== "127.0.0.1"),
    resolvePublicMenuIpv4: jest.fn(async () => "93.184.216.34"),
    startPublicMenuBrowserNetwork: jest.fn(),
}));

function mockDownload(data: Buffer, contentType: string) {
    (get as jest.Mock).mockImplementation((_url, _options, onResponse) => {
        const response = Object.assign(Readable.from([data]), {
            statusCode: 200,
            headers: { "content-type": contentType },
        });
        onResponse(response);
        return new EventEmitter();
    });
}

it.each(["application/octet-stream", "binary/octet-stream", ""])(
    "accepts raster photos with a generic content type (%s)", async contentType => {
        const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(20)]);
        mockDownload(jpeg, contentType);

        await expect(downloadPublicMenuPhoto("https://example.test/photo", AbortSignal.timeout(1000)))
            .resolves.toEqual(jpeg);
    }
);

it.each(["application/octet-stream", "text/html"])(
    "rejects HTML from a photo URL (%s)", async contentType => {
        mockDownload(Buffer.from("<html>Photo unavailable</html>"), contentType);

        await expect(downloadPublicMenuPhoto("https://example.test/photo", AbortSignal.timeout(1000)))
            .rejects.toBeInstanceOf(MenuLinkError);
    }
);

it("continues accepting explicit raster content types", async () => {
    const bytes = Buffer.from("raster image contents");
    mockDownload(bytes, "image/webp");

    await expect(downloadPublicMenuPhoto("https://example.test/photo.webp", AbortSignal.timeout(1000)))
        .resolves.toEqual(bytes);
});

type MockLinkResponse = { status: number; location?: string; body?: string; contentType?: string };

function mockLinkResponses(responses: MockLinkResponse[]) {
    const pending = [...responses];
    (get as jest.Mock).mockImplementation((_url, _options, onResponse) => {
        const next = pending.shift();
        if (!next) throw new Error("Unexpected link request");
        const response = Object.assign(Readable.from([Buffer.from(next.body ?? "")]), {
            statusCode: next.status,
            headers: {
                "content-type": next.contentType ?? "text/plain",
                ...(next.location ? { location: next.location } : {}),
            },
        });
        onResponse(response);
        return new EventEmitter();
    });
}

function mockShortLinkBrowser(destination: string) {
    const page = {
        createCDPSession: jest.fn(async () => ({ send: jest.fn() })),
        setBypassServiceWorker: jest.fn(async () => undefined),
        setRequestInterception: jest.fn(async () => undefined),
        on: jest.fn(),
        goto: jest.fn(async () => undefined),
        url: jest.fn(() => destination),
        waitForFunction: jest.fn(async () => undefined),
    };
    const close = jest.fn(async () => undefined);
    (puppeteer.launch as jest.Mock).mockResolvedValue({
        newPage: jest.fn(async () => page),
        close,
    });
    (startPublicMenuBrowserNetwork as jest.Mock).mockResolvedValue({
        url: "socks5://127.0.0.1:5555",
        close: jest.fn(async () => undefined),
    });
    return { page, close };
}

describe("shortened menu URLs", () => {
    const shortUrl = "https://encurta.anota.ai/Ldgg-XB9Kfhj";
    const destination = "https://pedido.anota.ai/loja/example";
    const menu = "Açaí 300ml R$ 14,00\\nMilkshake Morango R$ 18,00\\n".repeat(3);

    beforeEach(() => jest.clearAllMocks());


    const readerMenu = [
        "Title: Tá na Mão Shakes e Açaí",
        "Final URL: https://pedido.anota.ai/loja/35515868-alexandre-gadiolli",
        "Markdown Content:",
        "## Shakes e Açaí 300ml",
        "### Shake Morango Supremo",
        "Shake de morango.",
        "R$15,00",
        "## Açaí Trufados",
        "### Açaí trufado Chocolate Intenso 300g",
        "Açaí com chocolate.",
        "R$20,00",
    ].join("\n");

    it("reads real product-like markdown from a blocked Anota shortlink", async () => {
        mockLinkResponses([{ status: 403 }, { status: 200, body: readerMenu }]);
        const extracted = jest.fn();
        await expect(readPublicMenuLink(shortUrl, extracted)).resolves.toEqual(expect.objectContaining({
            text: expect.stringContaining("Shake Morango Supremo"),
        }));
        expect(extracted).toHaveBeenCalledWith(expect.stringContaining("Açaí trufado Chocolate Intenso"));
        expect((get as jest.Mock).mock.calls.map(([url]) => String(url))).toEqual([
            shortUrl, "https://r.jina.ai/" + shortUrl,
        ]);
        expect(puppeteer.launch).not.toHaveBeenCalled();
    });

    it("uses the reader if Anota's HTML loads but the browser gets Cloudflare 403", async () => {
        mockLinkResponses([
            { status: 200, body: "<html>App</html>", contentType: "text/html" },
            { status: 200, body: readerMenu },
        ]);
        const { page, close } = mockShortLinkBrowser(destination);
        page.goto.mockResolvedValue({ status: () => 403 } as never);
        await expect(readPublicMenuLink(destination)).resolves.toEqual(expect.objectContaining({
            text: expect.stringContaining("Shake Morango Supremo"),
        }));
        expect(close).toHaveBeenCalledTimes(1);
        expect((get as jest.Mock).mock.calls.map(([url]) => String(url))).toEqual([
            destination, "https://r.jina.ai/" + destination,
        ]);
    });

    it("rejects empty reader output rather than returning a successful empty scan", async () => {
        mockLinkResponses([{ status: 403 }, { status: 200, body: "Markdown Content:\nLoja fechada\nPedido mín. R$10,00" }]);
        await expect(readPublicMenuLink(shortUrl)).rejects.toThrow("não retornou produtos");
    });

    it("does not send non-Anota blocked links to the reader", async () => {
        mockLinkResponses([{ status: 403 }]);
        await expect(readPublicMenuLink("https://example.test/menu")).rejects.toThrow("bloqueia a leitura automática");
        expect(get).toHaveBeenCalledTimes(1);
        expect(puppeteer.launch).not.toHaveBeenCalled();
    });
    it("follows normal HTTP redirects without starting a browser", async () => {
        mockLinkResponses([{ status: 302, location: destination }, { status: 200, body: menu }]);
        await expect(readPublicMenuLink(shortUrl)).resolves.toEqual(expect.objectContaining({
            text: expect.stringContaining("Açaí 300ml"),
        }));
        expect((get as jest.Mock).mock.calls.map(([url]) => String(url))).toEqual([shortUrl, destination]);
        expect(puppeteer.launch).not.toHaveBeenCalled();
    });

    it("uses an isolated browser to resolve a blocked shortlink before extracting the menu", async () => {
        mockLinkResponses([{ status: 403 }, { status: 200, body: menu }]);
        const { close } = mockShortLinkBrowser(destination);
        await expect(readPublicMenuLink("https://bit.ly/generic-menu")).resolves.toEqual(expect.objectContaining({
            text: expect.stringContaining("Milkshake Morango"),
        }));
        expect((get as jest.Mock).mock.calls.map(([url]) => String(url))).toEqual(["https://bit.ly/generic-menu", destination]);
        expect(puppeteer.launch).toHaveBeenCalledTimes(1);
        expect(close).toHaveBeenCalledTimes(1);
    });

    it("rejects a blocked shortlink when the browser cannot leave the shortener", async () => {
        mockLinkResponses([{ status: 403 }]);
        mockShortLinkBrowser("https://bit.ly/generic-menu");
        await expect(readPublicMenuLink("https://bit.ly/generic-menu")).rejects.toThrow("encurtador bloqueou");
    });

    it("rejects browser-resolved destinations pointing to private addresses", async () => {
        mockLinkResponses([{ status: 403 }]);
        mockShortLinkBrowser("http://127.0.0.1/private");
        await expect(readPublicMenuLink("https://bit.ly/generic-menu")).rejects.toBeInstanceOf(MenuLinkError);
        expect(get).toHaveBeenCalledTimes(1);
    });
});
