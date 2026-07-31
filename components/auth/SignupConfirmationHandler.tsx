"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { supabase } from "@/lib/database/supabaseClient";
import {
    getOrCreateOnboardingRestaurant,
    isEmailConfirmed,
} from "@/lib/finishEmailConfirmation";
import { getCreationStepPath } from "@/lib/restaurantCreation";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const PENDING_EMAIL_KEY = "imenu-pending-signup-email";

type SignupConfirmationHandlerProps = {
    force?: boolean;
};

function clearAuthFragment() {
    if (!window.location.hash) return;

    window.history.replaceState(
        null,
        document.title,
        `${window.location.pathname}${window.location.search}`
    );
}

export default function SignupConfirmationHandler({
    force = false,
}: SignupConfirmationHandlerProps) {
    const router = useRouter();
    const handled = useRef(false);
    const { setEmail, setRestaurantId, setRestaurantSlug } =
        useCreationStore();
    const [status, setStatus] = useState<"idle" | "loading" | "error">(
        force ? "loading" : "idle"
    );
    const [message, setMessage] = useState("");

    const finishUser = useCallback(
        async (user: User) => {
            if (!isEmailConfirmed(user)) {
                throw new Error("O e-mail ainda não foi confirmado.");
            }

            const normalizedEmail = user.email?.trim().toLowerCase() || "";
            const restaurant = await getOrCreateOnboardingRestaurant(user);

            setEmail(normalizedEmail);
            setRestaurantId(restaurant.id);
            setRestaurantSlug(restaurant.url_slug);
            window.localStorage.removeItem(PENDING_EMAIL_KEY);

            router.replace(
                restaurant.first_time === false
                    ? "/painel"
                    : getCreationStepPath(restaurant.creation_step)
            );
        },
        [router, setEmail, setRestaurantId, setRestaurantSlug]
    );

    useEffect(() => {
        if (handled.current) return;

        const hash = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const callbackType = hash.get("type");
        const callbackError =
            hash.get("error_description") || hash.get("error");
        const hasAuthFragment = Boolean(
            accessToken || refreshToken || callbackError || callbackType
        );
        const isSignupCallback =
            callbackType === "signup" ||
            Boolean(accessToken && refreshToken) ||
            Boolean(callbackError);

        if (!force && !isSignupCallback) return;

        handled.current = true;
        setStatus("loading");

        const confirm = async () => {
            if (callbackError) {
                throw new Error(callbackError);
            }

            let {
                data: { session },
            } = await supabase.auth.getSession();

            if (accessToken && refreshToken) {
                const { data, error } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                });

                if (!error && data.session) {
                    session = data.session;
                } else if (session?.access_token !== accessToken) {
                    throw error || new Error(
                        "Não foi possível recuperar a confirmação do e-mail."
                    );
                }
            }

            // Remove credentials from the address bar only after Supabase had
            // the chance to persist the session.
            if (hasAuthFragment) clearAuthFragment();

            if (!session?.user) {
                const {
                    data: { user },
                    error,
                } = await supabase.auth.getUser();

                if (error || !user) {
                    throw new Error(
                        "Não foi possível recuperar a confirmação do e-mail."
                    );
                }

                await finishUser(user);
                return;
            }

            await finishUser(session.user);
        };

        void confirm().catch((caught) => {
            clearAuthFragment();
            setMessage(
                caught instanceof Error
                    ? caught.message
                    : "Não foi possível confirmar o e-mail."
            );
            setStatus("error");
        });
    }, [finishUser, force]);

    if (status === "idle") return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-white/95 px-4 backdrop-blur-sm">
            {status === "loading" ? (
                <div className="flex flex-col items-center gap-4 text-center">
                    <Loader className="border-t-brand" />
                    <p className="font-medium text-gray-700">
                        Confirmando seu e-mail...
                    </p>
                </div>
            ) : (
                <div className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-lg">
                    <h2 className="text-xl font-bold text-gray-900">
                        Não foi possível confirmar
                    </h2>
                    <p className="mt-2 text-sm text-red-700">{message}</p>
                    <Button
                        className="mt-6 w-full"
                        onClick={() =>
                            router.replace("/restaurante/criar/info/otp")
                        }
                    >
                        Digitar código
                    </Button>
                </div>
            )}
        </div>
    );
}
