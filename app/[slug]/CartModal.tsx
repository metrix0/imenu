"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";

import LegacyCartModal from "./CartModalLegacy";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { setNeighborhoodDeliveryGeocodingBypass } from "@/lib/api/geocoding";
import {
    findNeighborhoodDeliveryRule,
    parseNeighborhoodDeliveryRules,
    type NeighborhoodDeliveryRule,
} from "@/lib/delivery/neighborhood";

type LegacyProps = ComponentProps<typeof LegacyCartModal>;

type DeliveryConfig = {
    mode: "radius" | "neighborhood";
    rules: NeighborhoodDeliveryRule[];
};

export default function CartModal(props: LegacyProps) {
    const restaurantId = String(props.restaurant?.id || "");
    const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({
        mode: "radius",
        rules: [],
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
                if (property === "latitude" || property === "longitude") {
                    return 0;
                }

                if (property === "delivery_fee_json") {
                    const checkout = useCheckoutStore.getState() as any;
                    const match = findNeighborhoodDeliveryRule(
                        deliveryConfig.rules,
                        checkout.bairro,
                        checkout.cidade,
                        checkout.estado
                    );

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

    return <LegacyCartModal {...props} restaurant={restaurant} />;
}
