"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";

import LegacyCartModal from "./CartModalLegacy";
import { createMenuRequestCache } from "@/lib/menu/requestCache";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import {
    setNeighborhoodDeliveryGeocodingBypass,
    type GeoAddress,
} from "@/lib/api/geocoding";
import {
    findNeighborhoodDeliveryRule,
    findSimilarNeighborhoodDeliveryRule,
    normalizeNeighborhoodName,
    parseNeighborhoodDeliveryRules,
    type NeighborhoodDeliveryRule,
} from "@/lib/delivery/neighborhood";

type LegacyProps = Omit<
    ComponentProps<typeof LegacyCartModal>,
    "neighborhoodDeliveryRules" | "smallCityMode"
>;

type DeliveryConfig = {
    mode: "radius" | "neighborhood";
    rules: NeighborhoodDeliveryRule[];
    smallCityModeEnabled: boolean;
};

const loadDeliveryConfig = createMenuRequestCache(async (restaurantId: string): Promise<DeliveryConfig> => {
    const response = await fetch(
        `/api/checkout/delivery-config?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" }
    );
    if (!response.ok) throw new Error("Não foi possível carregar as configurações de entrega.");

    const data = await response.json();
    return {
        mode: data.mode === "neighborhood" ? "neighborhood" : "radius",
        rules: parseNeighborhoodDeliveryRules(data.rules),
        smallCityModeEnabled: data.smallCityModeEnabled === true,
    };
});

type NeighborhoodValidationResult =
    | "valid"
    | "invalid-neighborhood"
    | "invalid-address";

export default function CartModal(props: LegacyProps) {
    const restaurantId = String(props.restaurant?.id || "");
    const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({
        mode: props.restaurant.delivery_fee_mode === "neighborhood" ? "neighborhood" : "radius",
        rules: parseNeighborhoodDeliveryRules(props.restaurant.delivery_neighborhood_fee_json),
        smallCityModeEnabled: props.restaurant.small_city_mode_enabled === true,
    });

    useEffect(() => {
        if (!restaurantId) return;

        let active = true;

        void loadDeliveryConfig(restaurantId)
            .then(config => {
                if (active) setDeliveryConfig(config);
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
                const similarMatch = findSimilarNeighborhoodDeliveryRule(
                    [match],
                    addressNeighborhood,
                    address.city,
                    address.state
                );

                if (!similarMatch) {
                    return "invalid-address";
                }
            }
        }

        return "valid";
    };

    // Keep the address and CEP validation. Neighborhood fees do not depend on distance.
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
            smallCityMode={neighborhoodMode && deliveryConfig.smallCityModeEnabled}
        />
    );
}
