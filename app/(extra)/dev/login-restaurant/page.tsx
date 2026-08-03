"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type AccessState = "checking" | "allowed" | "forbidden" | "signed-out";

type RestaurantResult = {
    id: string;
    name: string;
    url_slug: string | null;
    phone: string | null;
    store_whatsapp: string | null;
    user_id: string | null;
};

function displayPhone(value: string | null): string {
    if (!value) return "—";

    const digits = value.replace(/\D/g, "");
    const localDigits =
        digits.startsWith("55") && digits.length >= 12
            ? digits.slice(2)
            : digits;

    if (localDigits.length === 11) {
        return `(${localDigits.slice(0, 2)}) ${localDigits.slice(
            2,
            7
        )}-${localDigits.slice(7)}`;
    }

    if (localDigits.length === 10) {
        return `(${localDigits.slice(0, 2)}) ${localDigits.slice(
            2,
            6
        )}-${localDigits.slice(6)}`;
    }

    return value;
}

export default function DevRestaurantAccessPage() {
    const router = useRouter();
    const { setRestaurantId, setRestaurantSlug } = useCreationStore();

    const [accessState, setAccessState] =
        useState<AccessState>("checking");
    const [search, setSearch] = useState("");
    const [restaurants, setRestaurants] = useState<RestaurantResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [enteringRestaurantId, setEnteringRestaurantId] = useState<
        string | null
    >(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        const checkAccess = async () => {
            const {
                data: { user },
                error: userError,
            } = await supabase.auth.getUser();

            if (!active) return;

            if (userError || !user) {
                setAccessState("signed-out");
                return;
            }

            if (
                user.email?.trim().toLowerCase() !== ALLOWED_DEV_EMAIL
            ) {
                setAccessState("forbidden");
                return;
            }

            setAccessState("allowed");
        };

        void checkAccess();

        return () => {
            active = false;
        };
    }, []);

    const runSearch = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const normalizedSearch = search.trim();
        if (!normalizedSearch) {
            setRestaurants([]);
            setError("Digite um nome, telefone ou ID.");
            return;
        }

        setIsSearching(true);
        setError("");

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                setAccessState("signed-out");
                return;
            }

            const response = await fetch(
                `/api/dev/restaurants?q=${encodeURIComponent(
                    normalizedSearch
                )}`,
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    cache: "no-store",
                }
            );

            const payload = (await response.json()) as {
                restaurants?: RestaurantResult[];
                error?: string;
            };

            if (response.status === 401) {
                setAccessState("signed-out");
                return;
            }

            if (response.status === 403) {
                setAccessState("forbidden");
                return;
            }

            if (!response.ok) {
                throw new Error(payload.error || "Erro ao buscar restaurantes.");
            }

            setRestaurants(payload.restaurants || []);
        } catch (caught) {
            setRestaurants([]);
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Erro ao buscar restaurantes."
            );
        } finally {
            setIsSearching(false);
        }
    };

    const enterRestaurant = (restaurant: RestaurantResult) => {
        setEnteringRestaurantId(restaurant.id);
        setRestaurantId(restaurant.id);
        setRestaurantSlug(restaurant.url_slug);

        window.localStorage.setItem(
            "imenu-dev-current-restaurant",
            JSON.stringify({
                id: restaurant.id,
                name: restaurant.name,
                urlSlug: restaurant.url_slug,
                selectedAt: new Date().toISOString(),
            })
        );

        router.push("/painel");
        router.refresh();
    };

    if (accessState === "checking") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <p className="text-sm text-gray-500">Verificando acesso…</p>
            </main>
        );
    }

    if (accessState === "signed-out") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-xl font-semibold text-gray-900">
                        Faça login primeiro
                    </h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Entre com {ALLOWED_DEV_EMAIL} para acessar esta ferramenta.
                    </p>
                    <button
                        type="button"
                        onClick={() => router.push("/restaurante/login")}
                        className="mt-6 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white"
                    >
                        Ir para o login
                    </button>
                </div>
            </main>
        );
    }

    if (accessState === "forbidden") {
        return (
            <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
                <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
                    <h1 className="text-xl font-semibold text-red-700">
                        Acesso negado
                    </h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Esta página está disponível somente para {ALLOWED_DEV_EMAIL}.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6">
            <div className="mx-auto max-w-5xl space-y-6">
                <header>
                    <p className="text-sm font-medium text-brand">/dev</p>
                    <h1 className="mt-1 text-3xl font-bold text-gray-900">
                        Entrar em um restaurante
                    </h1>
                    <p className="mt-2 text-sm text-gray-600">
                        Busque pelo nome, ID, celular do responsável ou WhatsApp da loja.
                    </p>
                </header>

                <form
                    onSubmit={runSearch}
                    className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                >
                    <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                            type="search"
                            value={search}
                            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                                setSearch(event.target.value)
                            }
                            placeholder="Nome, telefone ou UUID do restaurante"
                            autoComplete="off"
                            autoFocus
                            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                        />
                        <button
                            type="submit"
                            disabled={isSearching}
                            className="rounded-lg bg-brand px-6 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {isSearching ? "Buscando…" : "Buscar"}
                        </button>
                    </div>

                    {error && (
                        <p className="mt-3 text-sm text-red-600">{error}</p>
                    )}
                </form>

                {!isSearching && restaurants.length === 0 && !error && (
                    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
                        Os resultados aparecerão aqui.
                    </div>
                )}

                <div className="space-y-3">
                    {restaurants.map((restaurant) => (
                        <article
                            key={restaurant.id}
                            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
                        >
                            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
                                <div className="min-w-0">
                                    <h2 className="truncate text-lg font-semibold text-gray-900">
                                        {restaurant.name}
                                    </h2>
                                    <p className="mt-1 break-all font-mono text-xs text-gray-500">
                                        {restaurant.id}
                                    </p>

                                    <dl className="mt-4 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                                        <div>
                                            <dt className="text-xs text-gray-500">
                                                Celular do responsável
                                            </dt>
                                            <dd className="font-medium text-gray-800">
                                                {displayPhone(restaurant.phone)}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-gray-500">
                                                WhatsApp da loja
                                            </dt>
                                            <dd className="font-medium text-gray-800">
                                                {displayPhone(
                                                    restaurant.store_whatsapp
                                                )}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-gray-500">
                                                Slug
                                            </dt>
                                            <dd className="font-medium text-gray-800">
                                                {restaurant.url_slug || "—"}
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-gray-500">
                                                User ID
                                            </dt>
                                            <dd className="break-all font-mono text-xs text-gray-700">
                                                {restaurant.user_id || "—"}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => enterRestaurant(restaurant)}
                                    disabled={enteringRestaurantId !== null}
                                    className="shrink-0 rounded-lg bg-brand px-5 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {enteringRestaurantId === restaurant.id
                                        ? "Entrando…"
                                        : "Entrar no painel"}
                                </button>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </main>
    );
}
