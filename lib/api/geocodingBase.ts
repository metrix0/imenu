import { cities, states } from "./brazilianMunicipalities";
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


// Bound both connection and JSON parsing: one hung provider must not block checkout.
const requestJson = async (url: string): Promise<any> => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    try {
        return await Promise.race([
            (async () => {
                const response = await fetch(url, { signal: controller.signal });
                return response.ok ? await response.json() : null;
            })(),
            new Promise<null>((resolve) => {
                timer = setTimeout(() => { controller.abort(); resolve(null); }, 4000);
            }),
        ]);
    } catch { return null; }
    finally { clearTimeout(timer!); }
};

/**
 * 1. Busca dados do endereço via CEP (BrasilAPI)
 */
export async function fetchAddressByCEP(cep: string): Promise<GeoAddress | null> {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return null;

    try {
        const data = await requestJson(`https://brasilapi.com.br/api/cep/v1/${cleanCep}`);
        if (!data?.city || !data?.state) return null;

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
export async function fetchCoordinates(fullAddress: string): Promise<{ latitude: number; longitude: number }> {
    const TOMTOM_API_KEY = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
    const ARCGIS_API_KEY = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;

    const parts = fullAddress.split(",").map((part) => part.trim());
    const cepIndex = parts.findIndex((part) => /^\d{5}-?\d{3}$/.test(part));
    const hasNumberField = cepIndex === 4 || (cepIndex < 0 && parts.length >= 5);
    const wantedStreet = parts[0] || "";
    const wantedNumber = hasNumberField ? parts[1].match(/^\d+[a-z]?/i)?.[0] || "" : "";
    const wantedCity = (parts[hasNumberField ? 3 : 2] || "").split(/\s+-\s+/)[0];
    const wantedState = (parts[hasNumberField ? 3 : 2] || "").split(/\s+-\s+/).slice(1).join(" - ");
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

    const state = states.find(([uf, name]) => normalize(uf) === normalize(wantedState) || normalize(name) === normalize(wantedState));
    const stateMatches = (actual: unknown) => !actual || !state ||
        normalize(actual).replace(/^br /, "") === normalize(state[0]) || normalize(actual) === normalize(state[1]);

    const position = (lat: unknown, lon: unknown) => {
        if (lat == null || lon == null || String(lat).trim() === "" || String(lon).trim() === "") return null;
        const latitude = Number(lat);
        const longitude = Number(lon);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            latitude < -34 || latitude > 6 || longitude < -74 || longitude > -28) return null;
        return { latitude, longitude };
    };

    const geocodeTomTom = async () => {
        if (!TOMTOM_API_KEY) return null;
        try {
            const json = await requestJson(
                "https://api.tomtom.com/search/2/geocode/" + encodeURIComponent(fullAddress) +
                ".json?key=" + TOMTOM_API_KEY + "&countrySet=BR&limit=5&language=pt-BR"
            );
            const match = json?.results?.find((result: any) => {
                const address = result.address || {};
                const confidence = result.matchConfidence?.score;
                return streetMatches(address.streetName) &&
                    cityMatches(address.municipality) && stateMatches(address.countrySubdivisionCode || address.countrySubdivision) &&
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

    let postalCandidate: { latitude: number; longitude: number } | null = null;
    let interpolated: { latitude: number; longitude: number } | null = null;
    const arcgisResponses = new Map<string, any[]>();
    const geocodeArcGIS = async (approximate = false) => {
        try {
            const search = async (address: string): Promise<any[]> => {
                if (arcgisResponses.has(address)) return arcgisResponses.get(address)!;
                const params = new URLSearchParams({
                    SingleLine: address,
                    f: "json",
                    outFields: "Addr_type,StName,AddNum,City,Postal,Match_addr,RegionAbbr",
                    sourceCountry: "BRA",
                    maxLocations: "5",
                    forStorage: "false",
                });
                if (ARCGIS_API_KEY) params.set("token", ARCGIS_API_KEY);
                const host = ARCGIS_API_KEY ? "https://geocode-api.arcgis.com" : "https://geocode.arcgis.com";
                const json = await requestJson(
                    host + "/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?" + params.toString()
                );
                const results = Array.isArray(json?.candidates) ? json.candidates : [];
                arcgisResponses.set(address, results);
                return results;
            };

            const candidates = await search(fullAddress);
            const postal = candidates.find((candidate: any) =>
                candidate.attributes?.Addr_type === "Postal" && candidate.score >= 70 &&
                cityMatches(candidate.attributes.City) && stateMatches(candidate.attributes.RegionAbbr) &&
                wantedCEP && String(candidate.attributes.Postal).replace(/\D/g, "").startsWith(wantedCEP.slice(0, 5)) &&
                position(candidate.location?.y, candidate.location?.x));
            if (postal) postalCandidate = position(postal.location.y, postal.location.x);
            const exact = [...candidates].sort((a, b) => b.score - a.score).find((candidate: any) => {
                const details = candidate.attributes || {};
                const type = details.Addr_type;
                return candidate.score >= 95 &&
                    streetMatches(details.StName) &&
                    cityMatches(details.City) && stateMatches(details.RegionAbbr) &&
                    (!wantedNumber ||
                        (["PointAddress", "Subaddress", "PointAddressInt"].includes(type) &&
                            normalize(details.AddNum) === normalize(wantedNumber))) &&
                    (wantedNumber || ["PointAddress", "StreetAddress", "StreetAddressExt", "StreetName"].includes(type)) &&
                    position(candidate.location?.y, candidate.location?.x);
            });
            if (exact && position(exact.location?.y, exact.location?.x)) {
                console.log("[geocoding] resolved with ArcGIS", {
                    type: exact.attributes.Addr_type, score: exact.score,
                });
                return position(exact.location?.y, exact.location?.x);
            }

            const numberedStreet = candidates.find((candidate: any) => candidate.score >= 90 &&
                candidate.attributes?.Addr_type === "StreetAddress" && wantedNumber &&
                normalize(candidate.attributes.AddNum) === normalize(wantedNumber) &&
                streetMatches(candidate.attributes.StName) && cityMatches(candidate.attributes.City) &&
                stateMatches(candidate.attributes.RegionAbbr) && position(candidate.location?.y, candidate.location?.x));
            if (numberedStreet) interpolated = position(numberedStreet.location.y, numberedStreet.location.x);
            if (!approximate) return null;
            // Retry without the number AND CEP: a stale/mistyped CEP must not veto
            // a matching street in the explicitly entered city.
            const streetQuery = [wantedStreet, parts[hasNumberField ? 2 : 1],
                [wantedCity, wantedState].filter(Boolean).join(" - "), "Brasil"].join(", ");
            const streets = [...candidates, ...await search(streetQuery)];
            const street = streets
                .filter((candidate: any) => candidate.score >= 70 &&
                    streetMatches(candidate.attributes?.StName) &&
                    cityMatches(candidate.attributes?.City) && stateMatches(candidate.attributes?.RegionAbbr) &&
                    ["StreetAddress", "StreetAddressExt", "StreetName", "PointAddress", "Subaddress", "PointAddressInt"]
                        .includes(candidate.attributes?.Addr_type) &&
                    position(candidate.location?.y, candidate.location?.x))
                .sort((a: any, b: any) => b.score - a.score)[0];
            if (street) return position(street.location.y, street.location.x);
            console.log("[geocoding] ArcGIS rejected: no verified address or street match");
            return null;
        } catch (error) {
            console.log("[geocoding] ArcGIS failed", error);
            return null;
        }
    };

    const geocodeNominatim = async (approximate = false) => {
        try {
            const results = await requestJson(
                "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=br&q=" +
                encodeURIComponent(approximate ? addressWithoutNumber : fullAddress)
            );
            if (!Array.isArray(results)) return null;
            const match = results.find((result: any) => {
                const address = result.address || {};
                return streetMatches(address.road || address.pedestrian || address.residential) &&
                    cityMatches(address.city || address.town || address.village || address.municipality) &&
                    stateMatches(address["ISO3166-2-lvl4"] || address.state) &&
                    (approximate || !wantedNumber || normalize(address.house_number) === normalize(wantedNumber));
            });
            if (!match) return null;
            return position(match.lat, match.lon);
        } catch (error) {
            console.log("[geocoding] Nominatim failed", error);
            return null;
        }
    };

    // Resolve all numbered candidates before accepting ANY less precise fallback.
    // Google forward lookup remains disabled.
    const exact = await Promise.all([geocodeArcGIS(), geocodeTomTom(), geocodeNominatim()]);
    const bestExact = exact.find(Boolean);
    if (bestExact) return bestExact;
    if (interpolated) return interpolated;

    const street = await geocodeArcGIS(true) || await geocodeNominatim(true);
    if (street) return street;

    // BrasilAPI v2 may have CEP coordinates even when no house/street is mapped.
    if (wantedCEP) {
        const postal = await requestJson(`https://brasilapi.com.br/api/cep/v2/${wantedCEP}`);
        if (postal && cityMatches(postal.city) && stateMatches(postal.state)) {
            const coords = position(postal.location?.coordinates?.latitude, postal.location?.coordinates?.longitude);
            if (coords) return coords;
        }
    }

    if (postalCandidate) return postalCandidate;

    // This final reference is bundled with the app: outages, rejected credentials,
    // missing CEPs and unmapped streets must NEVER turn a complete address into null.
    const city = cities.find(([name, uf]) => normalize(name) === normalize(wantedCity) && (!state || uf === state[0]));
    const reference = city || state;
    console.warn("[geocoding] using approximate offline reference", { city: wantedCity, state: wantedState, level: city ? "city" : state ? "state" : "country" });
    return reference
        ? { latitude: reference[2], longitude: reference[3] }
        : { latitude: -14.235, longitude: -51.9253 };

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

