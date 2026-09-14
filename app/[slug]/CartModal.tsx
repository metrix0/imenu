"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";

import LegacyCartModal from "./CartModalLegacy";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import {
    getNeighborhoodDeliveryReferenceCoordinates,
    setNeighborhoodDeliveryGeocodingBypass,
    type GeoAddress,
} from "@/lib/api/geocoding";
import {
    findNeighborhoodDeliveryRule,
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

type NeighborhoodValidationResult =
    | "valid"
    | "invalid-neighborhood"
    | "invalid-address";

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

    const validateNeighborhoodDelivery = (
        address: GeoAddress | null
    ): NeighborhoodValidationResult => {
        const checkout = useCheckoutStore.getState() as any;
        const targetNeighborhood = normalizeNeighborhoodName(checkout.bairro);

        if (!targetNeighborhood) return "invalid-neighborhood";

        const nameMatch = deliveryConfig.rules.find((rule) =>
            [rule.neighborhood, ...(rule.aliases || [])]
                .map(normalizeNeighborhoodName)
                .filter(Boolean)
                .includes(targetNeighborhood)
        );

        if (!nameMatch) return "invalid-neighborhood";

        const match = findNeighborhoodDeliveryRule(
            deliveryConfig.rules,
            checkout.bairro,
            address?.city ?? checkout.cidade,
            address?.state ?? checkout.estado
        );

        if (!match) return "invalid-address";

        if (address) {
            const addressNeighborhood = normalizeNeighborhoodName(
                address.neighborhood
            );

            if (addressNeighborhood) {
                const acceptedNeighborhoods = [
                    match.neighborhood,
                    ...(match.aliases || []),
                ]
                    .map(normalizeNeighborhoodName)
                    .filter(Boolean);

                if (!acceptedNeighborhoods.includes(addressNeighborhood)) {
                    return "invalid-address";
                }
            }
        }

        return "valid";
    };

    // Keep the original checkout/geocoding validation. In neighborhood mode,
    // geocoding only swaps the final distance point after the address + CEP are
    // validated so the existing radius pipeline can apply the matched bairro fee.
    setNeighborhoodDeliveryGeocodingBypass(
        neighborhoodMode,
        validateNeighborhoodDelivery
    );

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
                    const reference =
                        getNeighborhoodDeliveryReferenceCoordinates();

                    if (property === "latitude") {
                        return reference?.latitude ?? 0;
                    }

                    return reference?.longitude ?? 0;
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
