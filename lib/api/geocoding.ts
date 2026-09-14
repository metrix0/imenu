import {
    calculateDistanceKm,
    fetchAddressByCEP,
    fetchAddressByCoordinates as fetchAddressByCoordinatesBase,
    fetchCoordinates as fetchCoordinatesBase,
    type GeoAddress,
} from "./geocodingBase";

export type { GeoAddress } from "./geocodingBase";
export { calculateDistanceKm, fetchAddressByCEP };

type NeighborhoodValidationResult =
    | "valid"
    | "invalid-neighborhood"
    | "invalid-address";

type NeighborhoodValidator = (
    address: GeoAddress | null
) => NeighborhoodValidationResult;

let neighborhoodDeliveryBypass = false;
let neighborhoodDeliveryValidator: NeighborhoodValidator | null = null;
let neighborhoodDeliveryReferenceCoordinates: {
    latitude: number;
    longitude: number;
} | null = null;

export function setNeighborhoodDeliveryGeocodingBypass(
    enabled: boolean,
    validator?: NeighborhoodValidator
) {
    neighborhoodDeliveryBypass = enabled;
    neighborhoodDeliveryValidator = enabled ? validator || null : null;

    if (!enabled) {
        neighborhoodDeliveryReferenceCoordinates = null;
    }
}

export function getNeighborhoodDeliveryReferenceCoordinates() {
    return neighborhoodDeliveryReferenceCoordinates;
}

export async function fetchAddressByCoordinates(lat: number, lon: number) {
    const address = await fetchAddressByCoordinatesBase(lat, lon);

    if (neighborhoodDeliveryBypass) {
        neighborhoodDeliveryReferenceCoordinates = address
            ? { latitude: lat, longitude: lon }
            : null;
    }

    return address;
}

export async function fetchCoordinates(fullAddress: string) {
    if (!neighborhoodDeliveryBypass) {
        return fetchCoordinatesBase(fullAddress);
    }

    const initialValidation =
        neighborhoodDeliveryValidator?.(null) ?? "valid";

    if (initialValidation === "invalid-neighborhood") {
        neighborhoodDeliveryReferenceCoordinates = {
            latitude: 0,
            longitude: 0,
        };
        return neighborhoodDeliveryReferenceCoordinates;
    }

    if (initialValidation !== "valid") {
        neighborhoodDeliveryReferenceCoordinates = null;
        return null;
    }

    const cepMatch = fullAddress.match(/\b\d{5}-?\d{3}\b/);
    const cleanCep = cepMatch?.[0]?.replace(/\D/g, "") ?? "";

    if (cleanCep.length !== 8) {
        neighborhoodDeliveryReferenceCoordinates = null;
        return null;
    }

    const cepAddress = await fetchAddressByCEP(cleanCep);
    if (!cepAddress) {
        neighborhoodDeliveryReferenceCoordinates = null;
        return null;
    }

    const cepValidation =
        neighborhoodDeliveryValidator?.(cepAddress) ?? "valid";

    if (cepValidation === "invalid-neighborhood") {
        neighborhoodDeliveryReferenceCoordinates = {
            latitude: 0,
            longitude: 0,
        };
        return neighborhoodDeliveryReferenceCoordinates;
    }

    if (cepValidation !== "valid") {
        neighborhoodDeliveryReferenceCoordinates = null;
        return null;
    }

    const coordinates = await fetchCoordinatesBase(fullAddress);
    neighborhoodDeliveryReferenceCoordinates = coordinates;

    return coordinates;
}
