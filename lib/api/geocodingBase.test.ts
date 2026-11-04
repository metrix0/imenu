import { fetchCoordinates } from "./geocodingBase";

const input = "Rua Otávio Alves Ourique, 90, Canudos, Novo Hamburgo - Rio Grande do Sul, 93544425, Brasil";
const street = {
    score: 98,
    attributes: {
        Addr_type: "StreetName",
        StName: "Rua Otávio Alves Ourique",
        City: "Novo Hamburgo",
        Postal: "93500-000",
    },
    location: { y: -29.686, x: -51.12 },
};
const postal = {
    state: "RS",
    city: "Novo Hamburgo",
    neighborhood: "Canudos",
    street: "Rua Otávio Alves Ourique",
};

const originalFetch = global.fetch;
const originalArcGIS = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
const originalTomTom = process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
const originalGoogle = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

beforeEach(() => {
    process.env.NEXT_PUBLIC_ARCGIS_API_KEY = "";
    process.env.NEXT_PUBLIC_TOMTOM_API_KEY = "";
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = "";
    jest.spyOn(console, "log").mockImplementation(() => undefined);
});

afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
    if (originalArcGIS === undefined) delete process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
    else process.env.NEXT_PUBLIC_ARCGIS_API_KEY = originalArcGIS;
    if (originalTomTom === undefined) delete process.env.NEXT_PUBLIC_TOMTOM_API_KEY;
    else process.env.NEXT_PUBLIC_TOMTOM_API_KEY = originalTomTom;
    if (originalGoogle === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    else process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = originalGoogle;
});

function mockProviders(confirmedStreet = postal, candidate = street) {
    const requests: string[] = [];
    global.fetch = jest.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        requests.push(url.toString());
        if (url.hostname === "brasilapi.com.br") {
            return { ok: true, json: async () => confirmedStreet } as Response;
        }
        if (url.hostname.includes("arcgis.com")) {
            const line = url.searchParams.get("SingleLine") || "";
            return {
                ok: true,
                json: async () => ({ candidates: line.includes(", 90,") ? [] : [candidate] }),
            } as Response;
        }
        if (url.hostname === "nominatim.openstreetmap.org") {
            return { ok: true, json: async () => [] } as Response;
        }
        throw new Error("Unexpected provider: " + url.hostname);
    }) as typeof fetch;
    return requests;
}

it("resolves a street when the building number is not mapped but CEP, city and street agree", async () => {
    const requests = mockProviders();
    expect(await fetchCoordinates(input)).toEqual({
        latitude: -29.686,
        longitude: -51.12,
    });
    expect(requests.some((url) => url.includes("brasilapi.com.br/api/cep/v1/93544425"))).toBe(true);
    expect(requests.filter((url) => url.includes("arcgis.com"))).toHaveLength(2);
});

it("rejects street-level coordinates when the CEP names a different street", async () => {
    const requests = mockProviders({ ...postal, street: "Rua de Outra Região" });
    expect(await fetchCoordinates(input)).toBeNull();
    expect(requests.filter((url) => url.includes("arcgis.com"))).toHaveLength(1);
});

it("does not accept a different numbered address as an exact match", async () => {
    const requests = mockProviders();
    (global.fetch as jest.Mock).mockImplementation(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        requests.push(url.toString());
        if (url.hostname === "brasilapi.com.br") return { ok: false } as Response;
        if (url.hostname.includes("arcgis.com")) return {
            ok: true,
            json: async () => ({ candidates: [{
                score: 100,
                attributes: {
                    Addr_type: "PointAddress", StName: "Rua Otávio Alves Ourique",
                    City: "Novo Hamburgo", Postal: "93544425", AddNum: "92",
                },
                location: { y: -29.68, x: -51.13 },
            }] }),
        } as Response;
        return { ok: true, json: async () => [] } as Response;
    });
    expect(await fetchCoordinates(input)).toBeNull();
});

it("keeps exact numbered ArcGIS matches without invoking the CEP fallback", async () => {
    const requests: string[] = [];
    global.fetch = jest.fn(async (input: string | URL | Request) => {
        const url = new URL(String(input));
        requests.push(url.toString());
        if (url.hostname.includes("arcgis.com")) return {
            ok: true,
            json: async () => ({ candidates: [{
                score: 100,
                attributes: {
                    Addr_type: "PointAddress", StName: "Rua Otávio Alves Ourique",
                    City: "Novo Hamburgo", Postal: "93544425", AddNum: "90",
                },
                location: { y: -29.687, x: -51.121 },
            }] }),
        } as Response;
        throw new Error("The exact match should not need another provider");
    }) as typeof fetch;
    expect(await fetchCoordinates(input)).toEqual({
        latitude: -29.687,
        longitude: -51.121,
    });
    expect(requests).toHaveLength(1);
});

it("rejects the reported Novo Hamburgo address when the CEP belongs to another street", async () => {
    const mismatchedCepInput = input.replace("93544425", "93544385");
    mockProviders({ ...postal, street: "Rua João Antônio Alves" });
    expect(await fetchCoordinates(mismatchedCepInput)).toBeNull();
});
