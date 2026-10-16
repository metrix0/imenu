import { Resolver } from "node:dns/promises";
import { isIPv4 } from "node:net";

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
    const resolver = new Resolver({ timeout: 2000, tries: 1 });
    try {
        const [ipv4, ipv6] = await Promise.all([
            resolver.resolve4(domain).catch((error: NodeJS.ErrnoException) => {
                if (["ENODATA", "ENOTFOUND"].includes(error.code || "")) return [];
                throw error;
            }),
            resolver.resolve6(domain).catch((error: NodeJS.ErrnoException) => {
                if (["ENODATA", "ENOTFOUND"].includes(error.code || "")) return [];
                throw error;
            }),
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
