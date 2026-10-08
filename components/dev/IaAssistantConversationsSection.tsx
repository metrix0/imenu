"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";

type RestaurantSummary = {
    restaurantId: string;
    restaurantName: string | null;
    slug: string | null;
    conversationCount: number;
    messageCount: number;
    lastMessageAt: string;
};

type ConversationMessage = {
    id: string;
    role: string;
    content: string;
    createdAt: string;
};

type Conversation = {
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    lastMessageAt: string;
    messages: ConversationMessage[];
};

type RestaurantConversations = {
    restaurant: {
        id: string;
        name: string | null;
        slug: string | null;
    };
    conversations: Conversation[];
};

function formatDateTime(value: string): string {
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

async function fetchDevJson<T>(path: string): Promise<T> {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error("Sessão expirada. Faça login novamente.");
    }

    const response = await fetch(path, {
        headers: {
            Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
    });
    const payload = (await response.json()) as T & { error?: string };

    if (!response.ok) {
        throw new Error(payload.error || "Não foi possível carregar as conversas.");
    }

    return payload;
}

export default function IaAssistantConversationsSection() {
    const [restaurants, setRestaurants] = useState<RestaurantSummary[] | null>(null);
    const [restaurantsLoading, setRestaurantsLoading] = useState(false);
    const [restaurantsError, setRestaurantsError] = useState("");
    const [selectedRestaurant, setSelectedRestaurant] =
        useState<RestaurantSummary | null>(null);
    const [conversationData, setConversationData] =
        useState<RestaurantConversations | null>(null);
    const [conversationLoading, setConversationLoading] = useState(false);
    const [conversationError, setConversationError] = useState("");

    const loadRestaurants = async () => {
        if (restaurantsLoading || restaurants) return;

        setRestaurantsLoading(true);
        setRestaurantsError("");

        try {
            const payload = await fetchDevJson<{ restaurants: RestaurantSummary[] }>(
                "/api/dev/dashboard/ia-assistant"
            );
            setRestaurants(payload.restaurants);
        } catch (error) {
            setRestaurantsError(
                error instanceof Error
                    ? error.message
                    : "Não foi possível carregar os restaurantes."
            );
        } finally {
            setRestaurantsLoading(false);
        }
    };

    const openRestaurant = async (restaurant: RestaurantSummary) => {
        setSelectedRestaurant(restaurant);
        setConversationData(null);
        setConversationError("");
        setConversationLoading(true);

        try {
            const payload = await fetchDevJson<RestaurantConversations>(
                `/api/dev/dashboard/ia-assistant?restaurant_id=${encodeURIComponent(
                    restaurant.restaurantId
                )}`
            );
            setConversationData(payload);
        } catch (error) {
            setConversationError(
                error instanceof Error
                    ? error.message
                    : "Não foi possível carregar as conversas."
            );
        } finally {
            setConversationLoading(false);
        }
    };

    const closeModal = () => {
        setSelectedRestaurant(null);
        setConversationData(null);
        setConversationError("");
        setConversationLoading(false);
    };

    return (
        <section>
            <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">Assistente IA</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Restaurantes que conversaram com o Assistente IA, ordenados pela atividade mais recente.
                </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                {restaurants === null ? (
                    <div className="flex flex-col items-start gap-4 p-5 sm:p-6">
                        <p className="max-w-2xl text-sm leading-6 text-gray-500">
                            Esta lista não é carregada junto com o dashboard. Carregue somente quando quiser consultar as conversas.
                        </p>
                        <Button
                            variant="secondary"
                            loading={restaurantsLoading}
                            onClick={() => void loadRestaurants()}
                        >
                            Carregar restaurantes
                        </Button>
                        {restaurantsError && (
                            <p className="text-sm text-red-600">{restaurantsError}</p>
                        )}
                    </div>
                ) : restaurants.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">
                        Nenhum restaurante usou o Assistente IA.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {restaurants.map((restaurant) => (
                            <button
                                key={restaurant.restaurantId}
                                type="button"
                                onClick={() => void openRestaurant(restaurant)}
                                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-gray-50"
                            >
                                <div className="min-w-0">
                                    <p className="truncate font-semibold text-gray-900">
                                        {restaurant.restaurantName || "Restaurante sem nome"}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {restaurant.conversationCount}{" "}
                                        {restaurant.conversationCount === 1
                                            ? "conversa"
                                            : "conversas"}{" "}
                                        · {restaurant.messageCount} mensagens
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-xs font-medium text-gray-600">
                                        {formatDateTime(restaurant.lastMessageAt)}
                                    </p>
                                    <p className="mt-1 text-xs text-brand">Abrir conversas</p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <Modal
                open={Boolean(selectedRestaurant)}
                onClose={closeModal}
                height="82dvh"
                showCloseButton
            >
                <div className="p-5 sm:p-6">
                    <div className="pr-10">
                        <h2 className="text-xl font-bold text-gray-900">
                            {selectedRestaurant?.restaurantName || "Restaurante sem nome"}
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Conversas com o Assistente IA, da mais recente para a mais antiga.
                        </p>
                    </div>

                    {conversationLoading ? (
                        <div className="flex min-h-56 items-center justify-center">
                            <Loader />
                        </div>
                    ) : conversationError ? (
                        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                            {conversationError}
                        </div>
                    ) : conversationData ? (
                        <div className="mt-6 space-y-5">
                            {conversationData.conversations.map((conversation) => (
                                <article
                                    key={conversation.id}
                                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                                >
                                    <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
                                        <div className="flex items-center justify-between gap-4">
                                            <h3 className="truncate text-sm font-semibold text-gray-900">
                                                {conversation.title || "Conversa"}
                                            </h3>
                                            <span className="shrink-0 text-xs text-gray-500">
                                                {formatDateTime(conversation.lastMessageAt)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="space-y-3 p-4">
                                        {conversation.messages.map((message) => {
                                            const isUser = message.role === "user";

                                            return (
                                                <div
                                                    key={message.id}
                                                    className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                                >
                                                    <div
                                                        className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                                                            isUser
                                                                ? "bg-brand text-white"
                                                                : "bg-gray-100 text-gray-800"
                                                        }`}
                                                    >
                                                        <p
                                                            className={`mb-1 text-[11px] font-semibold ${
                                                                isUser
                                                                    ? "text-white/75"
                                                                    : "text-gray-500"
                                                            }`}
                                                        >
                                                            {isUser
                                                                ? "Restaurante"
                                                                : "Assistente IA"}
                                                        </p>
                                                        <p className="whitespace-pre-wrap break-words">
                                                            {message.content}
                                                        </p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </article>
                            ))}

                            {conversationData.conversations.length === 0 && (
                                <div className="py-8 text-center text-sm text-gray-400">
                                    Nenhuma conversa encontrada.
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>
            </Modal>
        </section>
    );
}
