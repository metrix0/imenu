"use client";

import { useEffect, useState } from "react";
import type { SaveState } from "@/components/ui/SaveStatus";
import StoreProfileManager from "@/components/restaurant-owner/loja/StoreProfileManager";
import AllowedPaymentMethods, {
    DEFAULT_ALLOWED_PAYMENT_METHODS,
} from "@/components/restaurant-owner/configuracoes/AllowedPaymentMethods";

export type StoreSettingsRestaurant = {
    id: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    banner_url: string | null;
    payment_method: string | null;
    payment_info: string | null;
    payment_info_type: string | null;
    allowed_payment_methods: string[] | null;
    url_slug: string | null;
    custom_domain: string | null;
    store_whatsapp: string | null;
};

type Props = {
    restaurant: StoreSettingsRestaurant;
    hideCustomDomainButton?: boolean;
    onNameChange?: (name: string) => void;
    onPaymentInfoChange?: (paymentInfo: string) => void;
    onPixPayoutValidationChange?: (invalid: boolean) => void;
    onAllowedPaymentMethodsChange?: (methods: string[]) => void;
    onSaveStatusChange?: (status: SaveState) => void;
};

export default function StoreSettings({
    restaurant,
    hideCustomDomainButton = false,
    onNameChange,
    onPaymentInfoChange,
    onPixPayoutValidationChange,
    onAllowedPaymentMethodsChange,
    onSaveStatusChange,
}: Props) {
    const [profileStatus, setProfileStatus] = useState<SaveState>("saved");
    const [paymentStatus, setPaymentStatus] = useState<SaveState>("saved");
    const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<string[]>(
        DEFAULT_ALLOWED_PAYMENT_METHODS
    );

    useEffect(() => {
        setAllowedPaymentMethods(
            Array.isArray(restaurant.allowed_payment_methods) &&
                restaurant.allowed_payment_methods.length > 0
                ? restaurant.allowed_payment_methods
                : DEFAULT_ALLOWED_PAYMENT_METHODS
        );
    }, [restaurant.allowed_payment_methods]);

    useEffect(() => {
        const statuses = [profileStatus, paymentStatus];
        const status: SaveState = statuses.includes("error")
            ? "error"
            : statuses.includes("saving")
              ? "saving"
              : statuses.includes("idle")
                ? "idle"
                : "saved";
        onSaveStatusChange?.(status);
    }, [onSaveStatusChange, paymentStatus, profileStatus]);

    const handleAllowedPaymentMethodsChange = async (methods: string[]) => {
        setAllowedPaymentMethods(methods);
        onAllowedPaymentMethodsChange?.(methods);
        setPaymentStatus("saving");

        try {
            const response = await fetch(`/api/restaurants/${restaurant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ allowed_payment_methods: methods }),
            });
            setPaymentStatus(response.ok ? "saved" : "error");
        } catch {
            setPaymentStatus("error");
        }
    };

    return (
        <div className="space-y-8">
            <StoreProfileManager
                restaurant={restaurant}
                hideCustomDomainButton={hideCustomDomainButton}
                onNameChange={onNameChange}
                onPaymentInfoChange={onPaymentInfoChange}
                onPixPayoutValidationChange={onPixPayoutValidationChange}
                onSaveStatusChange={setProfileStatus}
            />

            <AllowedPaymentMethods
                value={allowedPaymentMethods}
                onChange={(methods) => void handleAllowedPaymentMethodsChange(methods)}
            />
        </div>
    );
}
