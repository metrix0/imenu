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
    console.log("[geocoding] start", { fullAddress, hasGoogleKey: Boolean(GOOGLE_API_KEY) });
    let googleQuotaExceeded = false;

    const geocodeGoogle = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
        if (!GOOGLE_API_KEY) {
            console.log("[geocoding] Google skipped: no key");
            return null;
        }

        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                    address
                )}&key=${GOOGLE_API_KEY}&language=pt-BR`
            );

            const json = await res.json();
            console.log("[geocoding] Google response", {
                address,
                httpStatus: res.status,
                status: json.status,
                resultCount: json.results?.length ?? 0,
                errorMessage: json.error_message ?? null,
            });

            if (json.status === "OVER_QUERY_LIMIT") {
                googleQuotaExceeded = true;
            }

            if (json.status !== "OK" || !json.results?.length) {
                return null;
            }

            const { lat, lng } = json.results[0].geometry.location;

            return {
                latitude: lat,
                longitude: lng
            };
        } catch (error) {
            console.log("[geocoding] Google request failed", { address, error });
            return null;
        }
    };

    const geocodeTomTom = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
        if (!TOMTOM_API_KEY) {
            console.log("[geocoding] TomTom skipped: no key");
            return null;
        }

        try {
            const res = await fetch(
                `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(address)}.json?key=${TOMTOM_API_KEY}&countrySet=BR&limit=1&language=pt-BR`
            );

            if (!res.ok) {
                console.log("[geocoding] TomTom HTTP failure", { address, status: res.status });
                return null;
            }

            const json = await res.json();
            console.log("[geocoding] TomTom response", {
                address,
                resultCount: json.results?.length ?? 0,
            });

            const latitude = Number(json.results?.[0]?.position?.lat);
            const longitude = Number(json.results?.[0]?.position?.lon);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

            return { latitude, longitude };
        } catch (error) {
            console.log("[geocoding] TomTom request failed", { address, error });
            return null;
        }
    };

    const geocodeNominatim = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
        try {
            const res = await fetch(
                `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&q=${encodeURIComponent(address)}`
            );
            if (!res.ok) {
                console.log("[geocoding] Nominatim HTTP failure", { address, status: res.status });
                return null;
            }

            const results = await res.json();
            console.log("[geocoding] Nominatim response", {
                address,
                resultCount: Array.isArray(results) ? results.length : 0,
            });
            if (!Array.isArray(results) || !results.length) return null;

            const latitude = Number(results[0].lat);
            const longitude = Number(results[0].lon);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

            return { latitude, longitude };
        } catch (error) {
            console.log("[geocoding] Nominatim request failed", { address, error });
            return null;
        }
    };

    const coords = await geocodeGoogle(fullAddress);
    if (coords) {
        console.log("[geocoding] resolved with Google full address", coords);
        return coords;
    }

    const addressParts = fullAddress.split(",").map((part) => part.trim());
    const addressWithoutNumber = addressParts.length >= 6
        ? [addressParts[0], ...addressParts.slice(2)].join(", ")
        : fullAddress;

    if (!googleQuotaExceeded && addressWithoutNumber !== fullAddress) {
        const googleFallback = await geocodeGoogle(addressWithoutNumber);
        if (googleFallback) {
            console.log("[geocoding] resolved with Google without number", googleFallback);
            return googleFallback;
        }
    }

    const tomTomFallback = await geocodeTomTom(fullAddress);
    if (tomTomFallback) {
        console.log("[geocoding] resolved with TomTom", tomTomFallback);
        return tomTomFallback;
    }

    const nominatimFallback = await geocodeNominatim(addressWithoutNumber);
    if (nominatimFallback) {
        console.log("[geocoding] resolved with Nominatim", nominatimFallback);
        return nominatimFallback;
    }

    const cepMatch = fullAddress.match(/\b\d{5}-?\d{3}\b/);
    const cleanCep = cepMatch?.[0]?.replace(/\D/g, "") ?? "";
    if (cleanCep.length === 8) {
        try {
            const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
            const data = res.ok ? await res.json() : null;
            const latitude = Number(data?.location?.coordinates?.latitude);
            const longitude = Number(data?.location?.coordinates?.longitude);

            console.log("[geocoding] BrasilAPI CEP V2 fallback", {
                cep: cleanCep,
                status: res.status,
                latitude: Number.isFinite(latitude) ? latitude : null,
                longitude: Number.isFinite(longitude) ? longitude : null,
            });

            if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                return { latitude, longitude };
            }
        } catch (error) {
            console.log("[geocoding] BrasilAPI CEP V2 request failed", { cep: cleanCep, error });
        }
    }

    console.log("[geocoding] failed to resolve coordinates", { fullAddress });
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

