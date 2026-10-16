import { isIPv4 } from "node:net";

type DnsResponse = {
    Status?: number;
    Answer?: Array<{ type?: number; data?: string }>;
};

async function resolvePublicDns(domain: string, type: "A" | "AAAA"): Promise<string[]> {
    for (const endpoint of ["https://cloudflare-dns.com/dns-query", "https://dns.google/resolve"]) {
        try {
            const url = new URL(endpoint);
            url.searchParams.set("name", domain);
            url.searchParams.set("type", type);
            const response = await fetch(url, {
                headers: { accept: "application/dns-json" },
                cache: "no-store",
                signal: AbortSignal.timeout(4000),
            });
            if (!response.ok) continue;
            const result = (await response.json()) as DnsResponse;
            if (result.Status === 3) return [];
            if (result.Status !== 0) continue;
            const recordType = type === "A" ? 1 : 28;
            return (result.Answer || []).flatMap((record) =>
                record.type === recordType && typeof record.data === "string"
                    ? [record.data]
                    : []
            );
        } catch {
            // Try the alternate public resolver if this one is unavailable.
        }
    }
    throw new Error("Public DNS lookup failed");
}

export function usesVpsDomains(): boolean {
    return process.env.CUSTOM_DOMAIN_PROVIDER === "vps";
}

export async function getVpsDomainStatus(domain: string) {
    const address = process.env.VPS_PUBLIC_IP?.trim() || "";
    if (!isIPv4(address)) {
        throw new Error("Configuração do IP do servidor indisponível.");
    }
    let configured = false;
    let configurationChecked = true;
    try {
        const [ipv4, ipv6] = await Promise.all([
            resolvePublicDns(domain, "A"),
            resolvePublicDns(domain, "AAAA"),
        ]);
        // Every DNS address must reach this server; stale IPv6 can break clients.
        configured = ipv4.length > 0 && ipv4.every(ip => ip === address) && ipv6.length === 0;
    } catch {
        configurationChecked = false;
    }
    return {
        domain, added: true, verified: configured, configured,
        configurationChecked, configuredBy: configured ? "A" : null,
        verification: [],
        dns: { type: "A", name: domain, value: address },
    };
}
