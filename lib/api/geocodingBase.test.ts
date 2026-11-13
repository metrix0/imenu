import { fetchCoordinates, fetchAddressByCEP } from "./geocodingBase";
import { cities, states } from "./brazilianMunicipalities";

const cases = [
    { input: "Rua Otavio Alves Ourique, 90, Canudos, Novo Hamburgo - Rio Grande do Sul, 93544385, Brasil", city: "Novo Hamburgo", street: "Rua Otavio Alves Ourique", number: "90", uf: "RS", lat: -29.686, lon: -51.12 },
    { input: "Rua Lucas Carneiro, 116, Recanto Tranquilo, Lavrinhas - SP, 12760-142, Brasil", city: "Lavrinhas", street: "Rua Lucas Carneiro", number: "116", uf: "SP", lat: -22.572, lon: -44.902 },
    { input: "Rua das Araras, 64, Jardim Mavisou, Lavrinhas - SP, 12760-246, Brasil", city: "Lavrinhas", street: "Rua das Araras", number: "64", uf: "SP", lat: -22.57, lon: -44.9 },
];
const originalFetch = global.fetch;
const keys = ["NEXT_PUBLIC_ARCGIS_API_KEY", "NEXT_PUBLIC_TOMTOM_API_KEY", "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"];
const originalKeys = keys.map(k => process.env[k]);
const reply = (data: unknown, ok = true) => ({ ok, json: async () => data }) as Response;
function candidate(c = cases[0], type = "PointAddress", overrides = {}) {
    return { score: 100, attributes: { Addr_type: type, StName: c.street, AddNum: c.number, City: c.city, RegionAbbr: c.uf, Postal: "", ...overrides }, location: { y: c.lat, x: c.lon } };
}
function providers(handler: (url: URL) => Response | Promise<Response>) {
    global.fetch = jest.fn(async input => handler(new URL(String(input)))) as typeof fetch;
}
function arcgisOnly(data: unknown[]) {
    providers(url => reply(url.hostname.includes("arcgis.com") ? { candidates: data } : []));
}
beforeEach(() => {
    keys.forEach(k => process.env[k] = "");
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
    global.fetch = originalFetch;
    keys.forEach((k, i) => originalKeys[i] === undefined ? delete process.env[k] : process.env[k] = originalKeys[i]);
    jest.restoreAllMocks();
    jest.useRealTimers();
});

describe.each(cases)("reported address: $street", c => {
    it("retains an exact number even with missing/stale provider CEP", async () => {
        arcgisOnly([candidate(c)]);
        expect(await fetchCoordinates(c.input)).toEqual({ latitude: c.lat, longitude: c.lon });
    });
    it("accepts a street if the building number is not mapped", async () => {
        arcgisOnly([candidate(c, "StreetName", { AddNum: "" })]);
        expect(await fetchCoordinates(c.input)).toEqual({ latitude: c.lat, longitude: c.lon });
    });
    it("returns the correct municipal reference when every provider is down", async () => {
        providers(() => { throw new Error("offline"); });
        const city = cities.find(([name, uf]) => name === c.city && uf === c.uf)!;
        expect(await fetchCoordinates(c.input)).toEqual({ latitude: city[2], longitude: city[3] });
    });
});

it("uses public ArcGIS without a token even when an API key is set", async () => {
    process.env.NEXT_PUBLIC_ARCGIS_API_KEY = "invalid-key";
    arcgisOnly([candidate(cases[0])]);
    expect(await fetchCoordinates(cases[0].input)).toEqual({ latitude: cases[0].lat, longitude: cases[0].lon });
    const urls = (global.fetch as jest.Mock).mock.calls
        .map(([url]) => new URL(String(url)))
        .filter((url: URL) => url.pathname.endsWith("/findAddressCandidates"));
    expect(urls).toHaveLength(1);
    expect(urls[0].hostname).toBe("geocode.arcgis.com");
    expect(urls[0].searchParams.has("token")).toBe(false);
});

it("tries another exact provider before accepting an ArcGIS street approximation", async () => {
    process.env.NEXT_PUBLIC_TOMTOM_API_KEY = "test";
    const c = cases[0];
    providers(url => {
        if (url.hostname.includes("arcgis")) return reply({ candidates: [candidate(c, "StreetName", { AddNum: "" })] });
        if (url.hostname === "api.tomtom.com") return reply({ results: [{ address: { streetName: c.street, streetNumber: c.number, municipality: c.city, countrySubdivisionCode: c.uf }, position: { lat: -29.69, lon: -51.13 } }] });
        return reply([]);
    });
    expect(await fetchCoordinates(c.input)).toEqual({ latitude: -29.69, longitude: -51.13 });
});
it("prefers a rooftop from another provider over an interpolated numbered street", async () => {
    const c = cases[0];
    providers(url => url.hostname.includes("arcgis") ? reply({ candidates: [candidate(c, "StreetAddress")] }) : reply([{ address: { road: c.street, house_number: c.number, city: c.city, state: "Rio Grande do Sul" }, lat: -29.69, lon: -51.13 }]));
    expect(await fetchCoordinates(c.input)).toEqual({ latitude: -29.69, longitude: -51.13 });
});
it("accepts a numbered StreetAddress when no rooftop exists", async () => {
    arcgisOnly([candidate(cases[0], "StreetAddress")]);
    expect(await fetchCoordinates(cases[0].input)).toEqual({ latitude: cases[0].lat, longitude: cases[0].lon });
});
describe("ArcGIS interpolation in a different neighborhood", () => {
    const c = cases[0];
    const wrongNeighborhood = candidate(c, "StreetAddress", { District: "Outro Bairro" });
    const correctStreet = {
        ...candidate(c, "StreetName", { AddNum: "", District: "Canudos" }),
        score: 96,
        location: { y: -29.69, x: -51.13 },
    };

    it("prefers a street in the requested neighborhood even when the interpolation scores higher", async () => {
        arcgisOnly([wrongNeighborhood, correctStreet]);
        expect(await fetchCoordinates(c.input)).toEqual({ latitude: -29.69, longitude: -51.13 });
    });

    it("tries a matching neighborhood from Nominatim before keeping the interpolation", async () => {
        providers(url => {
            if (url.hostname.includes("arcgis.com")) return reply({ candidates: [wrongNeighborhood] });
            return reply([{
                address: { road: c.street, city: c.city, suburb: "Canudos" },
                lat: -29.69,
                lon: -51.13,
            }]);
        });
        expect(await fetchCoordinates(c.input)).toEqual({ latitude: -29.69, longitude: -51.13 });
    });

    it("keeps the original interpolation when the matching point cannot produce a fee", async () => {
        arcgisOnly([wrongNeighborhood, correctStreet]);
        expect(await fetchCoordinates(c.input, () => false)).toEqual({ latitude: c.lat, longitude: c.lon });
    });

    it("keeps the original interpolation when there is no better point", async () => {
        arcgisOnly([wrongNeighborhood]);
        expect(await fetchCoordinates(c.input)).toEqual({ latitude: c.lat, longitude: c.lon });
    });
});
it("does not let a wrong number hide a later exact number", async () => {
    arcgisOnly([candidate(cases[0], "PointAddress", { AddNum: "92" }), { ...candidate(), score: 98, location: { y: -29.69, x: -51.13 } }]);
    expect(await fetchCoordinates(cases[0].input)).toEqual({ latitude: -29.69, longitude: -51.13 });
});
it("retries the street without the number or erroneous CEP", async () => {
    providers(url => reply(url.hostname.includes("arcgis") ? { candidates: url.searchParams.get("SingleLine")?.includes("93544385") ? [] : [candidate(cases[0], "StreetName")] } : []));
    expect(await fetchCoordinates(cases[0].input)).toEqual({ latitude: cases[0].lat, longitude: cases[0].lon });
});
it("uses valid CEP coordinates before the offline city reference", async () => {
    providers(url => reply(url.hostname === "brasilapi.com.br" ? { city: "Novo Hamburgo", state: "RS", location: { coordinates: { latitude: "-29.69", longitude: "-51.13" } } } : []));
    expect(await fetchCoordinates(cases[0].input)).toEqual({ latitude: -29.69, longitude: -51.13 });
});
it.each([null, "", "NaN", Infinity, 0, 91])("discards invalid coordinates %s and uses the next candidate", async value => {
    arcgisOnly([{ ...candidate(), location: { y: value, x: value } }, { ...candidate(), score: 98 }]);
    // A malformed first record must not prevent a usable result (at least street-level).
    expect(await fetchCoordinates(cases[0].input)).toEqual({ latitude: cases[0].lat, longitude: cases[0].lon });
});
it.each([{ City: "Outra cidade" }, { RegionAbbr: "SP" }, { StName: "Rua totalmente diferente" }])("rejects unrelated candidates %j", async overrides => {
    arcgisOnly([candidate(cases[0], "PointAddress", overrides)]);
    const city = cities.find(([name]) => name === "Novo Hamburgo")!;
    expect(await fetchCoordinates(cases[0].input)).toEqual({ latitude: city[2], longitude: city[3] });
});
it("returns a location for malformed provider bodies and HTTP failures", async () => {
    providers(() => reply({ error: { code: 403 } }, false));
    expect(await fetchCoordinates(cases[1].input)).toEqual(expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) }));
});
it("bounds a hung connection and JSON body, then uses offline coordinates", async () => {
    jest.useFakeTimers();
    providers(() => new Promise<Response>(() => {}));
    const result = fetchCoordinates(cases[0].input);
    await jest.advanceTimersByTimeAsync(20000);
    expect(await result).toEqual(expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) }));
    expect(jest.getTimerCount()).toBe(0);
});
it("bounds a hung JSON body", async () => {
    jest.useFakeTimers();
    providers(() => ({ ok: true, json: () => new Promise(() => {}) }) as Response);
    const result = fetchCoordinates(cases[1].input);
    await jest.advanceTimersByTimeAsync(20000);
    expect(await result).toEqual(expect.objectContaining({ latitude: expect.any(Number), longitude: expect.any(Number) }));
});
it("handles the existing no-number/CEP lookup format", async () => {
    providers(() => reply([]));
    const city = cities.find(([name]) => name === "Lavrinhas")!;
    expect(await fetchCoordinates("Rua das Araras, Jardim Mavisou, Lavrinhas - SP, Brasil")).toEqual({ latitude: city[2], longitude: city[3] });
});
it("has an offline fallback even for unknown cities or empty input", async () => {
    providers(() => { throw new Error("offline"); });
    for (const input of ["Rua A, 1, Centro, Cidade Desconhecida - SP, 12345678, Brasil", ""]) {
        const coords = await fetchCoordinates(input);
        expect(Number.isFinite(coords.latitude) && Number.isFinite(coords.longitude)).toBe(true);
    }
});
it("ships valid municipal coordinates and disambiguates same-name cities by state", async () => {
    expect(cities.length).toBeGreaterThan(5500);
    expect(states).toHaveLength(27);
    for (const [, uf, lat, lon] of cities) {
        expect(states.some(([state]) => state === uf)).toBe(true);
        expect(lat).toBeGreaterThan(-34); expect(lat).toBeLessThan(6);
        expect(lon).toBeGreaterThan(-74); expect(lon).toBeLessThan(-28);
    }
    providers(() => reply([]));
    for (const uf of ["SP", "RS"]) {
        const reference = cities.find(([name, state]) => name === "Santa Maria" && state === uf);
        if (reference) expect(await fetchCoordinates(`Rua A, 1, Centro, Santa Maria - ${uf}, 12345678, Brasil`)).toEqual({ latitude: reference[2], longitude: reference[3] });
    }
});
it("bounds CEP lookups used by neighborhood delivery too", async () => {
    jest.useFakeTimers();
    providers(() => new Promise<Response>(() => {}));
    const result = fetchAddressByCEP("12760142");
    await jest.advanceTimersByTimeAsync(4000);
    expect(await result).toBeNull();
});

// Actual ArcGIS responses observed 2026-11-04, rather than idealized score-100 fixtures.
it("accepts the reported Novo Hamburgo interpolated address despite its differing postal code", async () => {
    arcgisOnly([{ score: 99.41, attributes: { Addr_type: "StreetAddress", AddNum: "90", StName: "Otávio Alves Ourique", City: "Novo Hamburgo", RegionAbbr: "RS", Postal: "93544-425" }, location: { y: -29.695852764794, x: -51.085343282747 } }]);
    expect(await fetchCoordinates(cases[0].input)).toEqual({ latitude: -29.695852764794, longitude: -51.085343282747 });
});
it("accepts the actual 89.15-score Araras street result", async () => {
    arcgisOnly([{ score: 89.15, attributes: { Addr_type: "StreetName", AddNum: "", StName: "Araras", City: "Lavrinhas", RegionAbbr: "SP", Postal: "12760-000" }, location: { y: -22.554403197457, x: -44.92227705416 } }]);
    expect(await fetchCoordinates(cases[2].input)).toEqual({ latitude: -22.554403197457, longitude: -44.92227705416 });
});
it("retains the actual Lucas Carneiro postal candidate when finer references are unavailable", async () => {
    arcgisOnly([{ score: 81.25, attributes: { Addr_type: "Postal", StName: "", City: "Lavrinhas", RegionAbbr: "SP", Postal: "12760" }, location: { y: -22.5636654, x: -44.9246267 } }]);
    expect(await fetchCoordinates(cases[1].input)).toEqual({ latitude: -22.5636654, longitude: -44.9246267 });
});
it("does not replace an exact address with a higher-score street", async () => {
    arcgisOnly([candidate(cases[0], "StreetName"), { ...candidate(), score: 97, location: { y: -29.69, x: -51.13 } }]);
    expect(await fetchCoordinates(cases[0].input)).toEqual({ latitude: -29.69, longitude: -51.13 });
});
