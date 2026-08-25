"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dropdown from "@/components/ui/Dropdown";
import Loader from "@/components/ui/Loader";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type TestRestaurant = {
    id: string;
    name: string;
    pixKeyType: string;
};

type TestResponse = {
    success?: boolean;
    action?: "payzu_to_asaas" | "restaurant";
    amountCents?: number;
    restaurantName?: string;
    transactionStatus?: string | null;
    error?: string;
};

const money = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });

export default function PayoutTestActions() {
    const [visible, setVisible] = useState(false);
    const [payzuLoading, setPayzuLoading] = useState(false);
    const [restaurantLoading, setRestaurantLoading] = useState(false);
    const [restaurantsLoading, setRestaurantsLoading] = useState(false);
    const [restaurantModalOpen, setRestaurantModalOpen] = useState(false);
    const [restaurants, setRestaurants] = useState<TestRestaurant[]>([]);
    const [selectedRestaurantId, setSelectedRestaurantId] = useState("");
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        void supabase.auth.getSession().then(({ data }) => {
            const email = data.session?.user.email?.trim().toLowerCase();
            setVisible(email === ALLOWED_DEV_EMAIL);
        });
    }, []);

    const restaurantOptions = useMemo(
        () => [
            { value: "", label: "Selecionar restaurante" },
            ...restaurants.map((restaurant) => ({
                value: restaurant.id,
                label: restaurant.name,
            })),
        ],
        [restaurants]
    );

    const getAccessToken = async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
            throw new Error("Sessão expirada. Faça login novamente.");
        }
        return session.access_token;
    };

    const loadRestaurants = async () => {
        setRestaurantsLoading(true);
        setError("");

        try {
            const accessToken = await getAccessToken();
            const response = await fetch("/api/dev/payout/test", {
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
            });
            const payload = (await response.json()) as {
                restaurants?: TestRestaurant[];
                error?: string;
            };

            if (!response.ok) {
                throw new Error(payload.error || "Falha ao carregar restaurantes.");
            }

            const nextRestaurants = payload.restaurants || [];
            setRestaurants(nextRestaurants);
            setSelectedRestaurantId((current) =>
                current || nextRestaurants[0]?.id || ""
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Falha ao carregar restaurantes."
            );
        } finally {
            setRestaurantsLoading(false);
        }
    };

    const runTest = async (
        body: { action: "payzu_to_asaas" } | { action: "restaurant"; restaurantId: string }
    ) => {
        const accessToken = await getAccessToken();
        const response = await fetch("/api/dev/payout/test", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const payload = (await response.json()) as TestResponse;

        if (!response.ok) {
            throw new Error(payload.error || "Falha no teste de repasse.");
        }

        return payload;
    };

    const handlePayzuTest = async () => {
        setPayzuLoading(true);
        setError("");
        setMessage("");

        try {
            const payload = await runTest({ action: "payzu_to_asaas" });
            setMessage(
                `Teste concluído: ${money(payload.amountCents || 100)} da PayZu para o Asaas${payload.transactionStatus ? ` · ${payload.transactionStatus}` : ""}.`
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Falha no teste PayZu → Asaas."
            );
        } finally {
            setPayzuLoading(false);
        }
    };

    const openRestaurantTest = async () => {
        setRestaurantModalOpen(true);
        setError("");
        setMessage("");
        if (restaurants.length === 0) {
            await loadRestaurants();
        }
    };

    const handleRestaurantTest = async () => {
        if (!selectedRestaurantId) return;

        setRestaurantLoading(true);
        setError("");
        setMessage("");

        try {
            const payload = await runTest({
                action: "restaurant",
                restaurantId: selectedRestaurantId,
            });
            setRestaurantModalOpen(false);
            setMessage(
                `Teste concluído: ${money(payload.amountCents || 100)} enviado para ${payload.restaurantName || "o restaurante"}${payload.transactionStatus ? ` · ${payload.transactionStatus}` : ""}.`
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Falha no teste de repasse."
            );
        } finally {
            setRestaurantLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
            <Card>
                <h2 className="text-lg font-bold text-gray-900">Testes de R$ 1,00</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Testes reais de transferência. Não alteram o histórico nem os valores de repasse dos restaurantes.
                </p>

                {error && (
                    <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                {message && (
                    <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                        {message}
                    </div>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                    <Button
                        variant="secondary"
                        loading={payzuLoading}
                        disabled={payzuLoading || restaurantLoading}
                        onClick={() => void handlePayzuTest()}
                    >
                        Testar PayZu → Asaas — R$ 1,00
                    </Button>
                    <Button
                        variant="secondary"
                        disabled={payzuLoading || restaurantLoading}
                        onClick={() => void openRestaurantTest()}
                    >
                        Testar repasse — R$ 1,00
                    </Button>
                </div>
            </Card>

            <Modal
                open={restaurantModalOpen}
                onClose={() => !restaurantLoading && setRestaurantModalOpen(false)}
            >
                <div className="p-6 sm:p-7">
                    <h2 className="text-xl font-bold text-gray-900">
                        Testar repasse de R$ 1,00
                    </h2>
                    <p className="mt-2 text-sm text-gray-500">
                        Escolha o restaurante que receberá o PIX de teste.
                    </p>

                    <div className="mt-5">
                        {restaurantsLoading ? (
                            <div className="flex min-h-24 items-center justify-center">
                                <Loader />
                            </div>
                        ) : (
                            <Dropdown
                                aria-label="Restaurante para teste de repasse"
                                options={restaurantOptions}
                                value={selectedRestaurantId}
                                onChange={(event) =>
                                    setSelectedRestaurantId(event.target.value)
                                }
                            />
                        )}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button
                            variant="secondary"
                            disabled={restaurantLoading}
                            onClick={() => setRestaurantModalOpen(false)}
                        >
                            Cancelar
                        </Button>
                        <Button
                            loading={restaurantLoading}
                            disabled={
                                restaurantLoading ||
                                restaurantsLoading ||
                                !selectedRestaurantId
                            }
                            onClick={() => void handleRestaurantTest()}
                        >
                            Enviar R$ 1,00
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
