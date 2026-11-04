// lib/geocoding.ts

// ^ Nota: Se AddressData for usado em muitos lugares, considere mover para types.ts. 
// Por enquanto, vou redefinir um tipo genérico aqui para desacoplar.

export type GeoAddress = {
    cep: string;
    state: string;
    city: string;
    neighborhood: string;
    street: string;
    number?: string;
    complement?: string;
    latitude?: number | null;
    longitude?: number | null;
};

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const TOMTOM_API_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;

/**
 * 1. Busca dados do endereço via CEP (BrasilAPI)
 */
export async function fetchAddressByCEP(cep: string): Promise<GeoAddress | null> {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return null;

    try {
        const res = await fetch(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
        if (!res.ok) return null;

        const data = await res.json();

        return {
            cep: cleanCep,
            state: data.state,
            city: data.city,
            neighborhood: data.neighborhood,
            street: data.street,
            latitude: null,
            longitude: null
        };
    } catch {
        return null;
    }
}


/**
 * 2. Transforma Endereço (texto) em Coordenadas
 */
export async function fetchCoordinates(fullAddress: string): Promise<{ latitude: number; longitude: number } | null> {
    const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    const TOMTOM_API_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
    const ARCGIS_API_KEY = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

    const parts = fullAddress.split(",").map((part) => part.trim());
    const cepIndex = parts.findIndex((part) => /^\d{5}-?\d{3}$/.test(part));
    const hasNumberField = cepIndex === 4;
    const wantedStreet = parts[0] || "";
    const wantedNumber = hasNumberField ? parts[1].match(/^\d+[a-z]?/i)?.[0] || "" : "";
    const wantedCity = (parts[hasNumberField ? 3 : 2] || "").split(/\s+-\s+/)[0];
    const wantedCEP = cepIndex >= 0 ? parts[cepIndex].replace(/\D/g, "") : "";
    const addressWithoutNumber = hasNumberField
        ? [parts[0], ...parts.slice(2)].join(", ")
        : fullAddress;

    const normalize = (value: unknown) => String(value ?? "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

    const normalizeStreet = (value: unknown) => normalize(value)
        .replace(/\b(rua|avenida|av|r|travessa|estrada|rodovia|praca|alameda|doutor|dr|de|da|do|dos|das)\b/g, " ")
        .replace(/\s+/g, " ").trim();

    const streetMatches = (actual: unknown) => {
        const expected = normalizeStreet(wantedStreet);
        const found = normalizeStreet(actual);
        if (!expected || !found) return false;
        if (expected === found) return true;
        if (Math.min(expected.length, found.length) < 8 || Math.abs(expected.length - found.length) > 1) return false;
        // Permit one spelling difference (e.g. Sodero/Sodrero), not a different street.
        let a = 0, b = 0, differences = 0;
        while (a < expected.length && b < found.length) {
            if (expected[a] === found[b]) { a++; b++; continue; }
            if (++differences > 1) return false;
            if (expected.length > found.length) a++;
            else if (found.length > expected.length) b++;
            else { a++; b++; }
        }
        return differences + Number(a < expected.length) + Number(b < found.length) <= 1;
    };

    const cityMatches = (actual: unknown) =>
        Boolean(wantedCity) && normalize(actual) === normalize(wantedCity);

    const postcodeMatches = (actual: unknown, allowGeneric = false) => {
        if (!wantedCEP) return true;
        const values = String(actual ?? "").match(/\d{5}-?\d{3}/g) || [];
        return values.some((value) => {
            const cep = value.replace(/\D/g, "");
            return cep === wantedCEP ||
                (allowGeneric && cep.endsWith("000") && cep.slice(0, 5) === wantedCEP.slice(0, 5));
        });
    };

    const position = (lat: unknown, lon: unknown) => {
        const latitude = Number(lat);
        const longitude = Number(lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
        return { latitude, longitude };
    };

    console.log("[geocoding] start", { fullAddress, hasGoogleKey: Boolean(GOOGLE_API_KEY) });
    let googleQuotaExceeded = false;

    const geocodeGoogle = async (address: string) => {
        if (!GOOGLE_API_KEY) return null;
        try {
            const res = await fetch(
                "https://maps.googleapis.com/maps/api/geocode/json?address=" +
                encodeURIComponent(address) + "&key=" + GOOGLE_API_KEY + "&language=pt-BR"
            );
            const json = await res.json();
            console.log("[geocoding] Google response", {
                httpStatus: res.status, status: json.status, resultCount: json.results?.length ?? 0,
            });
            if (json.status === "OVER_QUERY_LIMIT") googleQuotaExceeded = true;
            if (json.status !== "OK" || !json.results?.length) return null;
            return position(json.results[0].geometry?.location?.lat, json.results[0].geometry?.location?.lng);
        } catch (error) {
            console.log("[geocoding] Google failed", error);
            return null;
        }
    };

    const geocodeTomTom = async () => {
        if (!TOMTOM_API_KEY) return null;
        try {
            const res = await fetch(
                "https://api.tomtom.com/search/2/geocode/" + encodeURIComponent(fullAddress) +
                ".json?key=" + TOMTOM_API_KEY + "&countrySet=BR&limit=5&language=pt-BR"
            );
            if (!res.ok) return null;
            const json = await res.json();
            const match = json.results?.find((result: any) => {
                const address = result.address || {};
                const confidence = result.matchConfidence?.score;
                return streetMatches(address.streetName) &&
                    cityMatches(address.municipality) &&
                    postcodeMatches(address.extendedPostalCode || address.postalCode) &&
                    (!wantedNumber || normalize(address.streetNumber) === normalize(wantedNumber)) &&
                    (typeof confidence !== "number" || confidence >= 0.7);
            });
            if (!match) {
                console.log("[geocoding] TomTom rejected: no matching street, city, number and CEP");
                return null;
            }
            return position(match.position?.lat, match.position?.lon);
        } catch (error) {
            console.log("[geocoding] TomTom failed", error);
            return null;
        }
    };

    const geocodeArcGIS = async () => {
        try {
            const params = new URLSearchParams({
                SingleLine: fullAddress,
                f: "json",
                outFields: "Addr_type,StName,AddNum,City,Postal,Match_addr",
                maxLocations: "5",
                forStorage: "false",
            });
            if (ARCGIS_API_KEY) params.set("token", ARCGIS_API_KEY);
            const host = ARCGIS_API_KEY ? "https://geocode-api.arcgis.com" : "https://geocode.arcgis.com";
            const res = await fetch(
                host + "/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?" + params.toString()
            );
            if (!res.ok) return null;
            const json = await res.json();
            const match = json.candidates?.find((candidate: any) => {
                const details = candidate.attributes || {};
                const type = details.Addr_type;
                return candidate.score >= 95 &&
                    streetMatches(details.StName) &&
                    cityMatches(details.City) &&
                    postcodeMatches(details.Postal, true) &&
                    (!wantedNumber ||
                        (["PointAddress", "Subaddress"].includes(type) &&
                            normalize(details.AddNum) === normalize(wantedNumber))) &&
                    (wantedNumber || ["PointAddress", "StreetAddress", "StreetAddressExt", "StreetName"].includes(type));
            });
            if (!match) {
                console.log("[geocoding] ArcGIS rejected: no sufficiently precise address match");
                return null;
            }
            console.log("[geocoding] resolved with ArcGIS", {
                type: match.attributes.Addr_type, score: match.score,
            });
            return position(match.location?.y, match.location?.x);
        } catch (error) {
            console.log("[geocoding] ArcGIS failed", error);
            return null;
        }
    };

    const geocodeNominatim = async () => {
        try {
            const res = await fetch(
                "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=br&q=" +
                encodeURIComponent(fullAddress)
            );
            if (!res.ok) return null;
            const results = await res.json();
            if (!Array.isArray(results)) return null;
            const match = results.find((result: any) => {
                const address = result.address || {};
                return streetMatches(address.road || address.pedestrian || address.residential) &&
                    cityMatches(address.city || address.town || address.village || address.municipality) &&
                    postcodeMatches(address.postcode, true) &&
                    (!wantedNumber || normalize(address.house_number) === normalize(wantedNumber));
            });
            if (!match) return null;
            return position(match.lat, match.lon);
        } catch (error) {
            console.log("[geocoding] Nominatim failed", error);
            return null;
        }
    };

    // Google forward geocoding is disabled; keep its implementation and retry code for later.
    /*
    const google = await geocodeGoogle(fullAddress);
    if (google) return google;
    if (!googleQuotaExceeded && addressWithoutNumber !== fullAddress) {
        const googleWithoutNumber = await geocodeGoogle(addressWithoutNumber);
        if (googleWithoutNumber) return googleWithoutNumber;
    }
    */

    const arcgis = await geocodeArcGIS();
    if (arcgis) return arcgis;

    const tomtom = await geocodeTomTom();
    if (tomtom) return tomtom;

    const nominatim = await geocodeNominatim();
    if (nominatim) return nominatim;

    // CEP lookup is for address verification; generic BrasilAPI coordinates are not precise enough for fees.
    console.log("[geocoding] failed to resolve precise coordinates", { fullAddress });
    return null;
}


/**
 * 3. Transforma Coordenadas em Endereço (Reverse Geocoding)
 * Tenta Google Maps primeiro (se tiver chave), fallback para Nominatim.
 */
export async function fetchAddressByCoordinates(lat: number, lon: number): Promise<GeoAddress | null> {
    // Tenta Google Maps API primeiro se a chave existir
    if (GOOGLE_API_KEY) {
        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${GOOGLE_API_KEY}&language=pt-BR`
            );
            const json = await res.json();
            
            if (json.results && json.results.length > 0) {
                const result = json.results[0];
                const components = result.address_components;
                
                const getComp = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || "";

                return {
                    cep: getComp("postal_code").replace("-", ""),
                    street: getComp("route"),
                    number: getComp("street_number"),
                    neighborhood: getComp("sublocality") || getComp("neighborhood") || getComp("sublocality_level_1"),
                    city: getComp("administrative_area_level_2") || getComp("locality"),
                    state: getComp("administrative_area_level_1"),
                    latitude: lat,
                    longitude: lon
                };
            }
        } catch (e) {
            console.warn("Google Maps falhou, tentando Nominatim...", e);
        }
    }

    // Fallback: Nominatim (OpenStreetMap)
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
            { headers: { "User-Agent": "AppDelivery/1.0" } }
        );
        if (!response.ok) return null;
        
        const data = await response.json();
        const addr = data.address || {};

        return {
            cep: (addr.postcode || "").replace(/\D/g, ""),
            street: addr.road || "",
            neighborhood: addr.suburb || addr.neighbourhood || "",
            city: addr.city || addr.town || addr.village || "",
            state: addr.state || "",
            number: addr.house_number || "",
            latitude: lat,
            longitude: lon
        };
    } catch (error) {
        console.error("Erro no Reverse Geocoding:", error);
        return null;
    }
}

/**
 * 4. Calcula distância entre dois pontos (Haversine)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const R = 6371; // Raio da terra em KM
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

