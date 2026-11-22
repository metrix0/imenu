import { calculateDistanceKm } from "../api/geocodingBase";
import { findNeighborhoodDeliveryRule } from "./neighborhood";
import { getCheckoutDeliveryDistanceKm, getCheckoutFulfillment } from "./restaurantLocation";

const destination = { latitude: -26.8725, longitude: -48.7475 };

it.each([
    { scenario: "first autofill when the old origin was (0,0)", originLat: 0, originLon: 0 },
    { scenario: "a previous delivery address left stale coordinates", originLat: -23.5, originLon: -46.6 },
    { scenario: "the destination has already been geocoded", originLat: destination.latitude, originLon: destination.longitude },
    { scenario: "restaurant origin is not set", originLat: NaN, originLon: NaN },
])("charges by neighborhood, not distance: $scenario", ({ originLat, originLon }) => {
    const distanceKm = getCheckoutDeliveryDistanceKm(true, originLat, originLon, destination.latitude, destination.longitude);
    expect(distanceKm).toBe(0);
    expect(distanceKm <= 1).toBe(true); // The matching bairro's existing synthetic tier.
});

it("preserves the real Haversine distance for radius-based delivery", () => {
    const from = { latitude: -26.8724, longitude: -48.7475 };
    const actual = calculateDistanceKm(from.latitude, from.longitude, destination.latitude, destination.longitude);
    expect(getCheckoutDeliveryDistanceKm(false, from.latitude, from.longitude, destination.latitude, destination.longitude))
        .toBe(actual);
    expect(actual).toBeGreaterThan(0);
});

it("still rejects distant addresses outside a radius tier", () => {
    const distanceKm = getCheckoutDeliveryDistanceKm(false, 0, 0, destination.latitude, destination.longitude);
    expect(distanceKm).toBeGreaterThan(6000);
    expect(distanceKm <= 1).toBe(false);
});

it("keeps the matched neighborhood's configured fee/time, but does not match unserved addresses", () => {
    const rules = [{ neighborhood: "Santa Regina", city: "Itajaí", state: "SC", fee_cents: 0, time_minutes: 40, aliases: [] }];
    expect(findNeighborhoodDeliveryRule(rules, "Santa Regina", "Itajaí", "SC")).toMatchObject({ fee_cents: 0, time_minutes: 40 });
    expect(findNeighborhoodDeliveryRule(rules, "Outro Bairro", "Itajaí", "SC")).toBeNull();
    expect(findNeighborhoodDeliveryRule(rules, "Santa Regina", "Outra Cidade", "SC")).toBeNull();
});

it("keeps neighborhood fulfillment possible without a restaurant distance origin", () => {
    const restaurant = { address: { street: "Rua Teste", city: "Itajaí" }, latitude: null, longitude: null, pickup_enabled: true };
    expect(getCheckoutFulfillment(restaurant, false, false, true).missingDeliveryOrigin).toBe(false);
    expect(getCheckoutFulfillment(restaurant, false, false, false).missingDeliveryOrigin).toBe(true);
});
