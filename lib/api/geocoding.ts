import {
    calculateDistanceKm,
    fetchAddressByCEP,
    fetchAddressByCoordinates,
    fetchCoordinates as fetchCoordinatesBase,
} from "./geocodingBase";

export type { GeoAddress } from "./geocodingBase";
export { calculateDistanceKm, fetchAddressByCEP, fetchAddressByCoordinates };

let neighborhoodDeliveryBypass = false;

export function setNeighborhoodDeliveryGeocodingBypass(enabled: boolean) {
    neighborhoodDeliveryBypass = enabled;
}

export async function fetchCoordinates(fullAddress: string) {
    if (neighborhoodDeliveryBypass) {
        return { latitude: 0, longitude: 0 };
    }

    return fetchCoordinatesBase(fullAddress);
}
