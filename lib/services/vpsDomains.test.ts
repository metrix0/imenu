import { getVpsDomainStatus } from "./vpsDomains";

const reply = (status: number, answers: Array<{ type: number; data: string }> = []) =>
    new Response(JSON.stringify({ Status: status, Answer: answers }));

beforeEach(() => {
    process.env.VPS_PUBLIC_IP = "177.153.39.121";
});

afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.VPS_PUBLIC_IP;
});

it("accepts a freshly updated A record without using the container DNS cache", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = new URL(String(input));
        return url.searchParams.get("type") === "A"
            ? reply(0, [{ type: 1, data: "177.153.39.121" }])
            : reply(0);
    });

    expect(await getVpsDomainStatus("johnvitor-mail.com")).toMatchObject({
        verified: true,
        configured: true,
        configurationChecked: true,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls.every(([input]) =>
        String(input).startsWith("https://cloudflare-dns.com/dns-query?")
    )).toBe(true);
});

it("rejects a domain that still has a wrong A record or an IPv6 record", async () => {
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = new URL(String(input));
        return url.searchParams.get("type") === "A"
            ? reply(0, [{ type: 1, data: "76.76.21.21" }])
            : reply(0);
    });
    expect((await getVpsDomainStatus("example.com")).configured).toBe(false);
    jest.restoreAllMocks();
    jest.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = new URL(String(input));
        return url.searchParams.get("type") === "A"
            ? reply(0, [{ type: 1, data: "177.153.39.121" }])
            : reply(0, [{ type: 28, data: "2001:db8::1" }]);
    });
    expect((await getVpsDomainStatus("example.com")).configured).toBe(false);
});

it("tries the alternate resolver if the first public resolver is unavailable", async () => {
    const spy = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.hostname === "cloudflare-dns.com") throw new Error("Unavailable");
        return url.searchParams.get("type") === "A"
            ? reply(0, [{ type: 1, data: "177.153.39.121" }])
            : reply(0);
    });
    expect((await getVpsDomainStatus("example.com")).configured).toBe(true);
    expect(spy).toHaveBeenCalledTimes(4);
});

it("reports DNS verification as unchecked if both public resolvers fail", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("Network unavailable"));
    expect(await getVpsDomainStatus("example.com")).toMatchObject({
        verified: false,
        configured: false,
        configurationChecked: false,
    });
});
