export type ItemChannelAvailability = {
    available_for_delivery?: boolean | null;
    available_for_salao?: boolean | null;
};

export function isItemAvailableForChannel(item: ItemChannelAvailability, destination: string | null | undefined): boolean {
    return destination === "mesa" || destination === "balcao"
        ? item.available_for_salao !== false
        : item.available_for_delivery !== false;
}
