import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type DeliveryConfig = {
    ifood: { enabled: boolean; merchantId: string; clientId: string; clientSecret: string };
    machine: { enabled: boolean; apiKey: string; username: string; password: string; companyId: string; payment: string; categoryId: string };
};
export const emptyDeliveryConfig: DeliveryConfig = {
    ifood: { enabled: false, merchantId: "", clientId: "", clientSecret: "" },
    machine: { enabled: false, apiKey: "", username: "", password: "", companyId: "", payment: "", categoryId: "" },
};
function encryptionKey() {
    const key = Buffer.from(process.env.DELIVERY_INTEGRATIONS_KEY || "", "base64");
    if (key.length !== 32) throw new Error("Integrações Delivery aguardando liberação. Contate o suporte.");
    return key;
}
export function seal(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
export function unseal(value: string): DeliveryConfig {
    const bytes = Buffer.from(value, "base64");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8"));
}
export function validSignature(raw: string | Uint8Array, signature: string, secret: string) {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    return timingSafeEqual(createHmac("sha256", secret).update(raw).digest(), Buffer.from(signature, "hex"));
}
export async function ifoodRequest(config: DeliveryConfig["ifood"], path: string, action?: "confirm" | "startPreparation" | "readyToPickup" | "dispatch") {
    const tokenResponse = await fetch("https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token", {
        method: "POST", body: new URLSearchParams({ grantType: "client_credentials", clientId: config.clientId, clientSecret: config.clientSecret }),
        cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!tokenResponse.ok) throw new Error("Não foi possível autenticar no iFood.");
    const token = await tokenResponse.json();
    const response = await fetch(`https://merchant-api.ifood.com.br${path}`, {
        method: action ? "POST" : "GET",
        ...(action === "dispatch" ? { body: JSON.stringify({ deliveredBy: "MERCHANT" }) } : {}),
        headers: { Authorization: `Bearer ${token.accessToken}`, ...(action ? { "Content-Type": "application/json" } : {}) }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(action ? `O iFood recusou a atualização (${response.status}). O status anterior foi mantido.` : "Não foi possível consultar o iFood. Confira as credenciais e a autorização da loja.");
    return action ? undefined : response.json();
}
export function machinePayload(order: any, config: DeliveryConfig["machine"]) {
    // Only the Machine payload interprets the stored address; checkout and orders remain unchanged.
    const savedAddress = String(order.customer_address || "").trim()
        .replace(/\s+-\s+Refer[eê]ncia:\s*.*$/i, "");
    const sections = savedAddress.split(/\s+-\s+/);
    const streetNumber = sections[0]?.match(/^(.+?),\s*([^,]+)$/);
    const neighborhood = sections[1]?.match(/^(.+?)(?:\s*\(([^()]*)\))?$/);
    const postal = sections[2]?.match(/^\d{5}-?\d{3}(?:\s*\(([^()]*)\))?$/);
    const checkoutAddress = streetNumber && neighborhood && (sections.length === 2 || (sections.length === 3 && postal))
        ? { rua: streetNumber[1].trim(), numero: streetNumber[2].trim(), bairro: neighborhood[1].trim(),
            complemento: postal?.[1] || neighborhood[2] || "" }
        : null;
    const parts = savedAddress.split(",").map(part => part.trim());
    const manualAddress = !checkoutAddress && parts.length === 4 && parts.every(Boolean)
        ? { rua: parts[0], numero: parts[1], bairro: parts[2], cidade: parts[3], complemento: "" }
        : null;
    const address = order.delivery_address || checkoutAddress || manualAddress;
    const city = address?.cidade || order.city;
    const state = address?.estado || order.state;
    if (!address?.rua || !address?.numero || !address?.bairro || !city || !state)
        throw new Error("Endereço incompleto para a Machine. Confira rua, número, bairro, cidade e estado.");
    return {
        empresa_id: Number(config.companyId), forma_pagamento: config.payment,
        ...(config.categoryId ? { categoria_id: Number(config.categoryId) } : {}),
        paradas: [{
            id_externo: order.id,
            endereco_parada: `${address.rua}, ${address.numero}`,
            bairro_parada: address.bairro, cidade_parada: city,
            estado_parada: state, complemento_parada: address.complemento || "",
            nome_cliente_parada: order.customer_name || "", telefone_cliente_parada: order.customer_phone || "",
            observacao_parada: `Pedido iMenu #${order.display_id}`,
        }],
    };
}
export function mapIfoodOrder(data: any) {
    const cents = (value: unknown) => {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 0) throw new Error("Valor inválido no pedido iFood.");
        return Math.round(number * 100);
    };
    if (!Array.isArray(data.items) || !data.items.length) throw new Error("Pedido iFood sem itens.");
    if (!["DELIVERY", "TAKEOUT"].includes(data.orderType)) throw new Error("Tipo de pedido iFood não suportado.");
    const address = data.delivery?.deliveryAddress;
    return {
        subtotal: cents(data.total?.itemsPrice), delivery: cents(data.total?.deliveryFee || 0), total: cents(data.total?.orderAmount),
        type: data.orderType === "DELIVERY" ? "entrega" : "retirada",
        address: address ? { rua: address.streetName, numero: address.streetNumber, bairro: address.neighborhood, cidade: address.city, estado: address.state, complemento: address.complement || "" } : null,
        items: data.items.map((item: any, index: number) => {
            if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error("Quantidade inválida no pedido iFood.");
            return { name: String(item.name), quantity: item.quantity, price: Math.round(cents(item.totalPrice) / item.quantity),
                total: cents(item.totalPrice), observation: [
                    index === 0 ? `iFood #${data.displayId || data.id}` : "",
                    item.observations || "", ...(item.options || []).map((option: any) => `${option.quantity}x ${option.name}`),
                    index === 0 ? `Pagamento iFood: ${(data.payments?.methods || []).map((p: any) => `${p.method} (${p.type})`).join(", ")}` : "",
                ].filter(Boolean).join("\n") };
        }),
    };
}
