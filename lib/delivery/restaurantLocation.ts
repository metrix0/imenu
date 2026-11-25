import { calculateDistanceKm } from "../api/geocodingBase";

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

export function getCheckoutFulfillment(
    restaurant: Parameters<typeof getRestaurantDeliveryLocation>[0] & {
        delivery_disabled?: boolean | null;
        delivery_fee_mode?: string | null;
        pickup_enabled?: boolean | null;
    },
    isTableOrder: boolean,
    pickupSelected: boolean,
    neighborhoodMode = restaurant.delivery_fee_mode === "neighborhood",
) {
    const location = getRestaurantDeliveryLocation(restaurant);
    const deliveryDisabled = !isTableOrder && restaurant.delivery_disabled === true;
    const missingDeliveryOrigin = !isTableOrder && !deliveryDisabled && !neighborhoodMode && !location.hasRadiusOrigin;
    const pickupAvailable = !isTableOrder && restaurant.pickup_enabled === true;
    const pickupRequired = deliveryDisabled;

    return {
        ...location,
        deliveryDisabled,
        missingDeliveryOrigin,
        pickupAvailable,
        pickupRequired,
        isPickup: pickupRequired || (pickupAvailable && pickupSelected),
    };
}

/** Neighborhood delivery is priced by bairro, never by physical distance. */
export function getCheckoutDeliveryDistanceKm(
    neighborhoodMode: boolean,
    originLat: number,
    originLon: number,
    destinationLat: number,
    destinationLon: number,
): number {
    return neighborhoodMode ? 0 : calculateDistanceKm(originLat, originLon, destinationLat, destinationLon);
}

export function findCheckoutDeliveryTier(distanceKm: number, tiersAny: any) {
    if (typeof tiersAny === "string") {
        try { tiersAny = JSON.parse(tiersAny); }
        catch { return null; }
    }
    if (!tiersAny) return null;

    let tiers = Array.isArray(tiersAny)
        ? tiersAny
        : Array.isArray(tiersAny.entrega)
            ? tiersAny.entrega.map((t: any) => ({
                fee_cents: t.taxa !== undefined ? Math.round(t.taxa * 100) : t.fee_cents,
                radius_km: t.distancia_km ?? t.radius_km,
                time_minutes: t.time_minutes ?? 0,
            }))
            : null;

    if (!tiers?.length) return null;

    return [...tiers]
        .sort((a, b) => (a.radius_km ?? 0) - (b.radius_km ?? 0))
        .find(tier => distanceKm <= tier.radius_km) ?? null;
}

