"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";

import LegacyCartModal from "./CartModalLegacy";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { setNeighborhoodDeliveryGeocodingBypass } from "@/lib/api/geocoding";
import {
    normalizeNeighborhoodName,
    parseNeighborhoodDeliveryRules,
    type NeighborhoodDeliveryRule,
} from "@/lib/delivery/neighborhood";

type LegacyProps = Omit<
    ComponentProps<typeof LegacyCartModal>,
    "neighborhoodDeliveryRules"
>;

type DeliveryConfig = {
    mode: "radius" | "neighborhood";
    rules: NeighborhoodDeliveryRule[];
};

export default function CartModal(props: LegacyProps) {
    const restaurantId = String(props.restaurant?.id || "");
    const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({
        mode: props.restaurant.delivery_fee_mode === "neighborhood" ? "neighborhood" : "radius",
        rules: parseNeighborhoodDeliveryRules(props.restaurant.delivery_neighborhood_fee_json),
    });

    useEffect(() => {
        if (!restaurantId) return;

        let active = true;

        void fetch(
            `/api/checkout/delivery-config?restaurantId=${encodeURIComponent(restaurantId)}`,
            { cache: "no-store" }
        )
            .then(async (response) => {
                if (!response.ok) return null;
                return response.json();
            })
            .then((data) => {
                if (!active || !data) return;
                setDeliveryConfig({
                    mode:
                        data.mode === "neighborhood"
                            ? "neighborhood"
                            : "radius",
                    rules: parseNeighborhoodDeliveryRules(data.rules),
                });
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [restaurantId]);

    const neighborhoodMode = deliveryConfig.mode === "neighborhood";
    const checkoutNeighborhood = useCheckoutStore((state) => state.bairro);
    const storedDeliveryFee = useCheckoutStore(
        (state) => state.delivery_fee_cents
    );
    const showAddressWarning = useCheckoutStore(
        (state) => state.showAddressWarning
    );

    const neighborhoodMatch = useMemo(() => {
        if (!neighborhoodMode) return null;

        const targetNeighborhood = normalizeNeighborhoodName(
            checkoutNeighborhood
        );
        if (!targetNeighborhood) return null;

        return (
            deliveryConfig.rules.find((rule) =>
                [rule.neighborhood, ...(rule.aliases || [])]
                    .map(normalizeNeighborhoodName)
                    .filter(Boolean)
                    .includes(targetNeighborhood)
            ) || null
        );
    }, [checkoutNeighborhood, deliveryConfig.rules, neighborhoodMode]);

    useEffect(() => {
        if (!neighborhoodMode) return;

        const targetNeighborhood = normalizeNeighborhoodName(
            checkoutNeighborhood
        );
        if (!targetNeighborhood) return;

        const checkout = useCheckoutStore.getState();

        if (!neighborhoodMatch) {
            if (checkout.delivery_fee_cents !== null) {
                checkout.setField("delivery_fee_cents", null);
            }
            if (checkout.delivery_time_minutes !== null) {
                checkout.setField("delivery_time_minutes", null);
            }
            return;
        }

        const fee = String(neighborhoodMatch.fee_cents);
        const time = String(neighborhoodMatch.time_minutes);

        if (String(checkout.delivery_fee_cents) !== fee) {
            checkout.setField("delivery_fee_cents", fee);
        }
        if (String(checkout.delivery_time_minutes) !== time) {
            checkout.setField("delivery_time_minutes", time);
        }
        if (checkout.showAddressWarning) {
            checkout.setShowAddressWarning(false);
        }
    }, [
        checkoutNeighborhood,
        neighborhoodMatch,
        neighborhoodMode,
        showAddressWarning,
        storedDeliveryFee,
    ]);

    // CartModalLegacy keeps the original radius implementation byte-for-byte.
    // In neighborhood mode only, its existing fee pipeline receives a synthetic
    // zero-distance tier whose fee/time comes from the matched neighborhood.
    setNeighborhoodDeliveryGeocodingBypass(neighborhoodMode);

    useEffect(
        () => () => {
            setNeighborhoodDeliveryGeocodingBypass(false);
        },
        []
    );

    const restaurant = useMemo(() => {
        if (!neighborhoodMode) return props.restaurant;

        return new Proxy(props.restaurant, {
            get(target, property, receiver) {
                if (
                    property === "latitude" ||
                    property === "longitude" ||
                    property === "delivery_fee_json"
                ) {
                    const checkout = useCheckoutStore.getState() as any;
                    const targetNeighborhood = normalizeNeighborhoodName(
                        checkout.bairro
                    );
                    const match = targetNeighborhood
                        ? deliveryConfig.rules.find((rule) =>
                              [rule.neighborhood, ...(rule.aliases || [])]
                                  .map(normalizeNeighborhoodName)
                                  .filter(Boolean)
                                  .includes(targetNeighborhood)
                          ) || null
                        : null;

                    if (property === "latitude" || property === "longitude") {
                        return 0;
                    }

                    if (!match) {
                        return [
                            {
                                radius_km: -1,
                                time_minutes: 0,
                                fee_cents: 0,
                            },
                        ];
                    }

                    return [
                        {
                            radius_km: 1,
                            time_minutes: match.time_minutes,
                            fee_cents: match.fee_cents,
                        },
                    ];
                }

                return Reflect.get(target, property, receiver);
            },
        });
    }, [deliveryConfig.rules, neighborhoodMode, props.restaurant]);

    return (
        <LegacyCartModal
            {...props}
            restaurant={restaurant}
            neighborhoodDeliveryRules={
                neighborhoodMode ? deliveryConfig.rules : undefined
            }
        />
    );
}
