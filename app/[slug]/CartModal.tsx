"use client";

import { useEffect, useMemo, useState, type ComponentProps } from "react";

import LegacyCartModal from "./CartModalLegacy";
import { supabase } from "@/lib/database/supabaseClient";
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

        const load = async () => {
            const { data, error } = await supabase
                .from("restaurants")
                .select("delivery_fee_mode, delivery_neighborhood_fee_json")
                .eq("id", restaurantId)
                .single();

            if (!active || error || !data) return;

            setDeliveryConfig({
                mode:
                    data.delivery_fee_mode === "neighborhood"
                        ? "neighborhood"
                        : "radius",
                rules: parseNeighborhoodDeliveryRules(
                    data.delivery_neighborhood_fee_json
                ),
            });
        };

        void load();

        const channel = supabase
            .channel(`delivery-mode:${restaurantId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "restaurants",
                    filter: `id=eq.${restaurantId}`,
                },
                (payload) => {
                    if (!active) return;
                    const row = payload.new as Record<string, unknown>;
                    setDeliveryConfig({
                        mode:
                            row.delivery_fee_mode === "neighborhood"
                                ? "neighborhood"
                                : "radius",
                        rules: parseNeighborhoodDeliveryRules(
                            row.delivery_neighborhood_fee_json
                        ),
                    });
                }
            )
            .subscribe();

        return () => {
            active = false;
            void supabase.removeChannel(channel);
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
