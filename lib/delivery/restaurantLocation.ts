type RestaurantAddress = Partial<Record<
    "street" | "number" | "neighborhood" | "city" | "state" | "cep",
    string | number | null
>>;

function parseAddress(value: unknown): RestaurantAddress | null {
    if (typeof value === "string") {
        try {
            value = JSON.parse(value);
        } catch {
            return null;
        }
    }
    return value && typeof value === "object" && !Array.isArray(value)
        ? value as RestaurantAddress
        : null;
}

function parseCoordinate(value: unknown): number {
    if (typeof value === "number") return value;
    return typeof value === "string" && value.trim() ? Number(value) : NaN;
}

export function getRestaurantDeliveryLocation(restaurant: {
    address?: unknown;
    latitude?: unknown;
    longitude?: unknown;
}) {
    const address = parseAddress(restaurant.address);
    const hasAddress = Boolean(
        address &&
        [address.street, address.number, address.neighborhood, address.city, address.state, address.cep]
            .some((value) => String(value ?? "").trim().length > 0)
    );
    const latitude = parseCoordinate(restaurant.latitude);
    const longitude = parseCoordinate(restaurant.longitude);
    const hasRadiusOrigin = hasAddress &&
        Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 &&
        (latitude !== 0 || longitude !== 0);

    return { address, hasAddress, hasRadiusOrigin };
}
