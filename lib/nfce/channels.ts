export type FiscalChannels = { salon: boolean; pickup: boolean; delivery: boolean };

export function fiscalChannels(value?: Partial<FiscalChannels> | null): FiscalChannels {
    return { salon: value?.salon !== false, pickup: value?.pickup !== false, delivery: value?.delivery === true };
}

export function fiscalOrderChannel(type?: string | null) {
    if (type === "mesa" || type === "balcao") return "salon";
    if (type === "retirada") return "pickup";
    if (type === "entrega" || type === "delivery") return "delivery";
    return null;
}

export function isFiscalChannelEnabled(channels: FiscalChannels | undefined, type?: string | null) {
    const channel = fiscalOrderChannel(type);
    if (channel === "delivery") return channels?.delivery === true;
    return (channel === "salon" || channel === "pickup") && channels?.[channel] !== false;
}
