"use client";

import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/database/supabaseClient";

export type OnboardingRestaurant = {
    id: string;
    url_slug: string | null;
    first_time: boolean | null;
    creation_step: number | null;
};

export function isEmailConfirmed(user: User): boolean {
    return Boolean(user.email_confirmed_at || user.confirmed_at);
}

export async function getOrCreateOnboardingRestaurant(
    user: User
): Promise<OnboardingRestaurant> {
    const { data: existing, error: existingError } = await supabase
        .from("restaurants")
        .select("id, url_slug, first_time, creation_step")
        .eq("user_id", user.id)
        .maybeSingle();

    if (existingError) {
        throw new Error("Não foi possível carregar o restaurante.");
    }

    if (existing) {
        return existing as OnboardingRestaurant;
    }

    const response = await fetch("/api/restaurants/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            userId: user.id,
            phone: user.user_metadata?.phone || "",
            email: user.email || "",
        }),
    });

    const payload = await response.json();

    if (!response.ok || !payload?.id) {
        throw new Error(payload?.error || "Erro ao iniciar o restaurante.");
    }

    return {
        id: payload.id,
        url_slug: null,
        first_time: true,
        creation_step: 1,
    };
}
