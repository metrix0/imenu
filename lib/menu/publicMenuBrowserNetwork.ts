import { lookup } from "node:dns/promises";
import { BlockList, createServer, isIP, Socket } from "node:net";

const blockedIps = new BlockList();
for (const [subnet, prefix] of [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
    ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
    ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24], ["192.168.0.0", 16],
    ["198.18.0.0", 15], ["198.51.100.0", 24],
    ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as Array<[string, number]>) {
    blockedIps.addSubnet(subnet, prefix, "ipv4");
}

const MAX_CONNECTIONS = 160;
const MAX_ACTIVE_CONNECTIONS = 32;
const MAX_NETWORK_BYTES = 48 * 1024 * 1024;
const HANDSHAKE_TIMEOUT_MS = 5_000;
const SOCKET_IDLE_TIMEOUT_MS = 20_000;
const denied = Buffer.from([5, 2, 0, 1, 0, 0, 0, 0, 0, 0]);
const connected = Buffer.from([5, 0, 0, 1, 0, 0, 0, 0, 0, 0]);

export function isPublicMenuHostname(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/\.$/, "");
    const ending = host.split(".").at(-1) ?? "";
    return host.length <= 253 && host.includes(".") && isIP(host) === 0 &&
        host.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
        !["local", "localhost", "internal", "onion"].includes(ending) &&
        !host.endsWith(".home.arpa");
}

export async function resolvePublicMenuIpv4(host: string): Promise<string | null> {
    if (!isPublicMenuHostname(host)) return null;
    const { address } = await lookup(host, { family: 4 });
    return blockedIps.check(address, "ipv4") ? null : address;
}

// SOCKS keeps Chromium's HTTP, TLS and streaming behavior intact. Each connection
// uses the checked IPv4 address and only the page's isolated browser can use it.
export async function startPublicMenuBrowserNetwork() {
    const clients = new Set<Socket>();
    let connections = 0;
    let remaining = MAX_NETWORK_BYTES;
    const server = createServer(client => {
        if (++connections > MAX_CONNECTIONS || clients.size >= MAX_ACTIVE_CONNECTIONS || remaining <= 0) {
            client.destroy();
            return;
        }
        clients.add(client);
        client.once("close", () => clients.delete(client));
        client.on("error", () => client.destroy());
        client.setTimeout(HANDSHAKE_TIMEOUT_MS, () => client.destroy());
        let greeting = true;
        let input = Buffer.alloc(0);

        const onHandshake = (chunk: Buffer) => {
            input = Buffer.concat([input, chunk]);
            if (input.length > 520 || input[0] !== 5) {
                client.destroy();
                return;
            }
            if (greeting) {
                if (input.length < 2 || input.length < 2 + input[1]) return;
                if (!input.subarray(2, 2 + input[1]).includes(0)) {
                    client.end(Buffer.from([5, 255]));
                    return;
                }
                client.write(Buffer.from([5, 0]));
                input = input.subarray(2 + input[1]);
                greeting = false;
            }
            if (input.length < 5) return;
            if (input[0] !== 5 || input[1] !== 1 || input[2] !== 0 || input[3] !== 3) {
                client.end(denied);
                return;
            }
            const endHost = 5 + input[4];
            if (input.length < endHost + 2) return;
            const host = input.toString("latin1", 5, endHost);
            const port = input.readUInt16BE(endHost);
            client.pause();
            client.off("data", onHandshake);
            if ((port !== 80 && port !== 443) || input.length !== endHost + 2) {
                client.end(denied);
                return;
            }

            void resolvePublicMenuIpv4(host).then(ip => {
                if (client.destroyed) return;
                if (!ip) {
                    client.end(denied);
                    return;
                }
                const upstream = new Socket({ allowHalfOpen: false });
                client.once("close", () => upstream.destroy());
                upstream.once("close", () => client.destroy());
                upstream.on("error", () => upstream.destroy());
                upstream.setTimeout(HANDSHAKE_TIMEOUT_MS, () => upstream.destroy());
                upstream.connect(port, ip, () => {
                    client.setTimeout(SOCKET_IDLE_TIMEOUT_MS);
                    upstream.setTimeout(SOCKET_IDLE_TIMEOUT_MS);
                    const countBytes = (data: Buffer) => {
                        remaining -= data.length;
                        if (remaining <= 0) for (const socket of clients) socket.destroy();
                    };
                    client.on("data", countBytes);
                    upstream.on("data", countBytes);
                    client.write(connected);
                    upstream.pipe(client);
                    client.pipe(upstream);
                    client.resume();
                });
            }).catch(() => client.end(denied));
        };
        client.on("data", onHandshake);
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            server.off("error", reject);
            resolve();
        });
    });
    const address = server.address();
    if (!address || typeof address === "string") {
        server.close();
        throw new Error("Não foi possível iniciar a leitura do cardápio.");
    }
    return {
        url: "socks5://127.0.0.1:" + address.port,
        close: () => {
            for (const client of clients) client.destroy();
            return new Promise<void>(resolve => server.close(() => resolve()));
        },
    };
}
