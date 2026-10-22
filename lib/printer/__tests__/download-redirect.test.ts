import { GET } from "../../../app/downloads/[filename]/route";

function get(filename: string) {
    return GET(new Request("https://www.imenuapp.com.br/downloads/" + encodeURIComponent(filename)), {
        params: Promise.resolve({ filename }),
    });
}

describe("printer installer redirects", () => {
    it.each([
        [
            "iMenu Impressora Setup 1.4.4.exe",
            "https://github.com/metrix0/imenu-printer/releases/download/v1.4.4/iMenu-Impressora-Setup-1.4.4.exe",
        ],
        [
            "iMenu Impressora Legacy Setup 1.4.4.exe",
            "https://github.com/metrix0/imenu-printer-windows7-legacy/releases/download/v1.4.4/iMenu.Impressora.Legacy.Setup.1.4.4.exe",
        ],
        [
            "iMenu Impressora Legacy Setup 1.1.5.exe",
            "https://github.com/metrix0/imenu-printer-windows7-legacy/releases/download/v1.1.5/iMenu.Impressora.Legacy.Setup.1.1.5.exe",
        ],
        [
            "iMenu Impressora Setup 1.4.3.exe",
            "https://github.com/metrix0/imenu-printer/releases/download/v1.4.3/iMenu-Impressora-Setup-1.4.3.exe",
        ],
    ])("preserves installer URL %s", async (filename, expected) => {
        const response = await get(filename);
        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(expected);
        expect(response.headers.get("cache-control")).toBe("no-store");
    });

    it.each(["invalid.exe", "iMenu Impressora Setup ../1.4.4.exe", "imenu-printer.json"])(
        "does not redirect unrelated downloads: %s",
        async (filename) => {
            const response = await get(filename);
            expect(response.status).toBe(404);
            expect(response.headers.get("location")).toBeNull();
        },
    );
});
