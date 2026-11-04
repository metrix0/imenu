import { fetchCoordinates, setNeighborhoodDeliveryGeocodingBypass, getNeighborhoodDeliveryReferenceCoordinates } from "./geocoding";
import { cities } from "./brazilianMunicipalities";
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; setNeighborhoodDeliveryGeocodingBypass(false); jest.restoreAllMocks(); });
it.each(["12760-142", ""])("keeps neighborhood delivery geocoding available when CEP %s lookup fails", async cep => {
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "log").mockImplementation(() => undefined);
    global.fetch = jest.fn(async () => { throw new Error("offline"); });
    setNeighborhoodDeliveryGeocodingBypass(true, () => "valid");
    const city = cities.find(([name]) => name === "Lavrinhas")!;
    const result = await fetchCoordinates(`Rua Lucas Carneiro, 116, Recanto Tranquilo, Lavrinhas - SP, ${cep}, Brasil`);
    expect(result).toEqual({ latitude: city[2], longitude: city[3] });
    expect(getNeighborhoodDeliveryReferenceCoordinates()).toEqual(result);
});
it("retains deliberate business validation failures", async () => {
    global.fetch = jest.fn();
    setNeighborhoodDeliveryGeocodingBypass(true, () => "invalid-address");
    expect(await fetchCoordinates("invalid address")).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
});
