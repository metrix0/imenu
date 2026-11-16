import { lookup } from "node:dns/promises";
import { Socket } from "node:net";
import { isPublicMenuHostname, resolvePublicMenuIpv4, startPublicMenuBrowserNetwork } from "./publicMenuBrowserNetwork";

jest.mock("node:dns/promises", () => ({ lookup: jest.fn() }));

const dns = jest.mocked(lookup);

beforeEach(() => dns.mockReset());

it.each(["localhost", "printer.local", "router.home.arpa", "metadata.internal", "169.254.169.254", "127.0.0.1.", "[::1]"])(
    "rejects non-public host %s before DNS", async host => {
        expect(isPublicMenuHostname(host)).toBe(false);
        await expect(resolvePublicMenuIpv4(host)).resolves.toBeNull();
        expect(dns).not.toHaveBeenCalled();
    }
);

it.each(["10.0.0.1", "100.100.100.100", "127.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.0.1"])(
    "rejects public names resolving to %s", async address => {
        (dns as jest.Mock).mockResolvedValue({ address, family: 4 });
        await expect(resolvePublicMenuIpv4("example.com")).resolves.toBeNull();
    }
);

it("resolves a public domain to the checked address", async () => {
    (dns as jest.Mock).mockResolvedValue({ address: "93.184.216.34", family: 4 });
    await expect(resolvePublicMenuIpv4("menu.example.com")).resolves.toBe("93.184.216.34");
    expect(dns).toHaveBeenCalledWith("menu.example.com", { family: 4 });
});

it("closes the per-scan network listener", async () => {
    const network = await startPublicMenuBrowserNetwork();
    const port = Number(new URL(network.url).port);
    expect(new URL(network.url).hostname).toBe("127.0.0.1");
    await network.close();

    const socket = new Socket();
    try {
        const connect = new Promise<void>((resolve, reject) => {
            socket.once("connect", resolve);
            socket.once("error", reject);
            socket.connect(port, "127.0.0.1");
        });
        await expect(connect).rejects.toHaveProperty("code", "ECONNREFUSED");
    } finally {
        socket.destroy();
    }
});
