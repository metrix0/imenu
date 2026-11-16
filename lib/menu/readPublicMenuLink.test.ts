import { get } from "node:https";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { downloadPublicMenuPhoto, MenuLinkError } from "./readPublicMenuLink";

jest.mock("puppeteer", () => ({}));
jest.mock("node:https", () => ({ get: jest.fn() }));
jest.mock("./publicMenuBrowserNetwork", () => ({
    isPublicMenuHostname: jest.fn(() => true),
    resolvePublicMenuIpv4: jest.fn(async () => "93.184.216.34"),
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
