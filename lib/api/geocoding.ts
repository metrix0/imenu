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
 * 2. Transforma Endereço (texto) em Coordenadas (Nominatim / OSM)
 */
export async function fetchCoordinates(fullAddress: string): Promise<{ latitude: number; longitude: number } | null> {

    const apiKey = GOOGLE_API_KEY;
    if (!apiKey) return null;

    const geocode = async (address: string): Promise<{ latitude: number; longitude: number } | null> => {
        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                    address
                )}&key=${apiKey}&language=pt-BR`
            );

            const json = await res.json();

            if (json.status !== "OK" || !json.results?.length) {
                return null;
            }

            const { lat, lng } = json.results[0].geometry.location;

            return {
                latitude: lat,
                longitude: lng
            };
        } catch {
            return null;
        }
    };

    const coords = await geocode(fullAddress);
    if (coords) return coords;

    const addressParts = fullAddress.split(",").map((part) => part.trim());
    if (addressParts.length >= 6) {
        const addressWithoutNumber = [addressParts[0], ...addressParts.slice(2)].join(", ");
        return geocode(addressWithoutNumber);
    }

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

