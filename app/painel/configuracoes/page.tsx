"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCircleInfo,
    faCopy,
    faDownload,
    faSignOutAlt,
    faTrash,
    faVolumeHigh,
} from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Tooltip from "@/components/ui/Tooltip";
import QrCodeMesaSettingsSection from "@/components/restaurant-owner/configuracoes/QrCodeMesaSettingsSection";

type Restaurant = {
    id: string;
    name: string;
    url_slug?: string | null;
    user_id?: string | null;
    phone?: string | null;
    force_whatsapp_order_confirmation?: boolean | null;
    allow_future_order_scheduling?: boolean | null;
};

type OrderDingleDuration = "short" | "medium" | "long";

const ORDER_DINGLE_DURATION_STORAGE_KEY = "imenu:order-dingle-duration";
const ORDER_DINGLE_DURATION_EVENT = "imenu:order-dingle-duration-changed";
const ORDER_DINGLE_DURATION_VERSION_KEY = "imenu:order-dingle-duration-version";
const ORDER_DINGLE_DURATION_VERSION = "2";

const ORDER_DINGLE_OPTIONS: Array<{
    value: OrderDingleDuration;
    label: string;
    description: string;
}> = [
    {
        value: "short",
        label: "Curto (Padrão)",
        description: "Toca o som completo uma vez.",
    },
    {
        value: "medium",
        label: "Médio",
        description: "Toca o som completo duas vezes.",
    },
    {
        value: "long",
        label: "Longo",
        description: "Toca o som completo três vezes.",
    },
];

function normalizeOrderDingleDuration(value: unknown): OrderDingleDuration {
    return value === "medium" || value === "long" ? value : "short";
}

function resolveOrderDingleDuration(fallback?: unknown): OrderDingleDuration {
    const storedDuration = window.localStorage.getItem(
        ORDER_DINGLE_DURATION_STORAGE_KEY,
    );
    const isCurrentVersion =
        window.localStorage.getItem(ORDER_DINGLE_DURATION_VERSION_KEY) ===
        ORDER_DINGLE_DURATION_VERSION;

    if (isCurrentVersion) {
        return normalizeOrderDingleDuration(storedDuration ?? fallback);
    }

    const legacyDuration = normalizeOrderDingleDuration(
        storedDuration ?? fallback,
    );
    const migratedDuration: OrderDingleDuration =
        legacyDuration === "long" ? "medium" : "short";

    window.localStorage.setItem(
        ORDER_DINGLE_DURATION_STORAGE_KEY,
        migratedDuration,
    );
    window.localStorage.setItem(
        ORDER_DINGLE_DURATION_VERSION_KEY,
        ORDER_DINGLE_DURATION_VERSION,
    );

    return migratedDuration;
}

function playAudioOnce(audio: HTMLAudioElement) {
    return new Promise<void>((resolve, reject) => {
        let settled = false;

        const cleanup = () => {
            audio.removeEventListener("ended", handleEnded);
            audio.removeEventListener("error", handleError);
        };

        const finish = () => {
            if (settled) return;
            settled = true;
            cleanup();
            resolve();
        };

        const handleEnded = () => finish();
        const handleError = () => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error("Falha ao reproduzir o som do pedido."));
        };

        audio.addEventListener("ended", handleEnded);
        audio.addEventListener("error", handleError);
        audio.currentTime = 0;

        void audio.play().catch((error) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(error);
        });
    });
}

function playAudioAfterDelay(audio: HTMLAudioElement, delayMs: number) {
    return new Promise<void>((resolve, reject) => {
        window.setTimeout(() => {
            void playAudioOnce(audio).then(resolve).catch(reject);
        }, delayMs);
    });
}

async function playOrderDingleWithDuration(
    audio: HTMLAudioElement,
    duration: OrderDingleDuration,
) {
    if (duration === "short") {
        await playAudioOnce(audio);
        return;
    }

    const secondAudio = audio.cloneNode(true) as HTMLAudioElement;
    secondAudio.preload = "auto";

    const playbacks = [
        playAudioOnce(audio),
        playAudioAfterDelay(secondAudio, 1000),
    ];

    let thirdAudio: HTMLAudioElement | null = null;
    if (duration === "long") {
        thirdAudio = audio.cloneNode(true) as HTMLAudioElement;
        thirdAudio.preload = "auto";
        playbacks.push(playAudioAfterDelay(thirdAudio, 2000));
    }

    try {
        await Promise.all(playbacks);
    } finally {
        secondAudio.pause();
        secondAudio.currentTime = 0;
        thirdAudio?.pause();
        if (thirdAudio) thirdAudio.currentTime = 0;
    }
}

function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function ConfiguracoesPage() {
    const router = useRouter();
    const { restaurantId, setRestaurantId, clear } = useCreationStore();
    const [user, setUser] = useState<User | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [loading, setLoading] = useState(true);
    const [savingField, setSavingField] = useState<"phone" | null>(null);
    const [phone, setPhone] = useState("");
    const [savedPhone, setSavedPhone] = useState("");
    const [orderDingleDuration, setOrderDingleDuration] =
        useState<OrderDingleDuration>("short");
    const [isTestingOrderDingle, setIsTestingOrderDingle] = useState(false);
    const orderDingleAudioRef = useRef<HTMLAudioElement | null>(null);
    const [forceWhatsappOrderConfirmation, setForceWhatsappOrderConfirmation] =
        useState(false);
    const [isSavingWhatsappConfirmation, setIsSavingWhatsappConfirmation] =
        useState(false);
    const [allowFutureOrderScheduling, setAllowFutureOrderScheduling] =
        useState(false);
    const [isSavingOrderScheduling, setIsSavingOrderScheduling] =
        useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [shareableUrl, setShareableUrl] = useState("");
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);

    useEffect(() => {
        const audio = new Audio("/sounds/new-order.mp3");
        audio.preload = "auto";
        orderDingleAudioRef.current = audio;

        return () => {
            audio.pause();
            audio.currentTime = 0;
            orderDingleAudioRef.current = null;
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session?.user) {
                    router.replace("/restaurante/login");
                    return;
                }

                setUser(session.user);

                const resolvedDuration = resolveOrderDingleDuration(
                    session.user.user_metadata?.order_dingle_duration,
                );
                setOrderDingleDuration(resolvedDuration);

                let targetId = restaurantId;
                if (!targetId) {
                    const { data: rest } = await supabase
                        .from("restaurants")
                        .select("id")
                        .eq("user_id", session.user.id)
                        .maybeSingle();
                    if (rest) {
                        targetId = rest.id;
                        setRestaurantId(rest.id);
                    }
                }

                if (targetId) {
                    const { data: restData } = await supabase
                        .from("restaurants")
                        .select(
                            "id, name, url_slug, user_id, phone, force_whatsapp_order_confirmation, allow_future_order_scheduling",
                        )
                        .eq("id", targetId)
                        .single();

                    if (restData) {
                        setRestaurant(restData);
                        setForceWhatsappOrderConfirmation(
                            restData.force_whatsapp_order_confirmation === true,
                        );
                        setAllowFutureOrderScheduling(
                            restData.allow_future_order_scheduling === true,
                        );
                        const formattedPhone = formatPhone(
                            restData.phone || "",
                        );
                        setPhone(formattedPhone);
                        setSavedPhone(formattedPhone);
                        if (restData.url_slug) {
                            setShareableUrl(
                                `${window.location.origin}/${restData.url_slug}`,
                            );
                        }
                    }
                }
            } catch (error) {
                console.error(error);
                setToast({ message: "Erro ao carregar dados.", type: "error" });
            } finally {
                setLoading(false);
            }
        };

        void loadData();
    }, [restaurantId, router, setRestaurantId]);

    const savePhone = async () => {
        if (!restaurant || phone === savedPhone) return;
        if (phone.replace(/\D/g, "").length !== 11) {
            setToast({ message: "Digite um celular válido.", type: "error" });
            return;
        }

        setSavingField("phone");
        const response = await fetch(`/api/restaurants/${restaurant.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phone.replace(/\D/g, "") }),
        });
        setSavingField(null);

        if (!response.ok) {
            setToast({ message: "Erro ao salvar celular.", type: "error" });
            return;
        }

        setSavedPhone(phone);
        setToast({ message: "Celular atualizado!", type: "success" });
    };

    const saveWhatsappOrderConfirmation = async (enabled: boolean) => {
        if (!restaurant || isSavingWhatsappConfirmation) return;

        setIsSavingWhatsappConfirmation(true);
        const { error } = await supabase
            .from("restaurants")
            .update({ force_whatsapp_order_confirmation: enabled })
            .eq("id", restaurant.id);
        setIsSavingWhatsappConfirmation(false);

        if (error) {
            console.error(
                "Erro ao salvar confirmação obrigatória por WhatsApp:",
                error,
            );
            setToast({
                message: "Erro ao salvar a configuração do WhatsApp.",
                type: "error",
            });
            return;
        }

        setForceWhatsappOrderConfirmation(enabled);
        setRestaurant((current) =>
            current
                ? {
                      ...current,
                      force_whatsapp_order_confirmation: enabled,
                  }
                : current,
        );
        setToast({
            message: enabled
                ? "Notificação por WhatsApp ativada."
                : "Notificação por WhatsApp desativada.",
            type: "success",
        });
    };

    const saveOrderSchedulingMode = async (allowFuture: boolean) => {
        if (!restaurant || isSavingOrderScheduling) return;

        setIsSavingOrderScheduling(true);
        const { error } = await supabase
            .from("restaurants")
            .update({ allow_future_order_scheduling: allowFuture })
            .eq("id", restaurant.id);
        setIsSavingOrderScheduling(false);

        if (error) {
            console.error("Erro ao salvar modo de agendamento:", error);
            setToast({
                message: "Erro ao salvar a configuração de agendamentos.",
                type: "error",
            });
            return;
        }

        setAllowFutureOrderScheduling(allowFuture);
        setRestaurant((current) =>
            current
                ? {
                      ...current,
                      allow_future_order_scheduling: allowFuture,
                  }
                : current,
        );
        setToast({
            message: allowFuture
                ? "Agendamentos para dias futuros ativados."
                : "Agendamentos limitados ao dia atual.",
            type: "success",
        });
    };

    const saveOrderDingleDuration = (
        nextDuration: OrderDingleDuration,
    ) => {
        if (nextDuration === orderDingleDuration) return;

        try {
            window.localStorage.setItem(
                ORDER_DINGLE_DURATION_STORAGE_KEY,
                nextDuration,
            );
            window.localStorage.setItem(
                ORDER_DINGLE_DURATION_VERSION_KEY,
                ORDER_DINGLE_DURATION_VERSION,
            );
            setOrderDingleDuration(nextDuration);
            window.dispatchEvent(
                new CustomEvent<OrderDingleDuration>(
                    ORDER_DINGLE_DURATION_EVENT,
                    { detail: nextDuration },
                ),
            );
            setToast({
                message: "Duração do som atualizada!",
                type: "success",
            });
        } catch (error) {
            console.error("Erro ao salvar duração do som:", error);
            setToast({
                message: "Erro ao salvar a duração do som.",
                type: "error",
            });
        }
    };

    const testOrderDingle = useCallback(async () => {
        const audio = orderDingleAudioRef.current;
        if (!audio || isTestingOrderDingle) return;

        setIsTestingOrderDingle(true);

        try {
            audio.pause();
            audio.currentTime = 0;

            await playOrderDingleWithDuration(
                audio,
                orderDingleDuration,
            );
        } catch (error) {
            console.error("Erro ao testar som do pedido:", error);
            setToast({
                message: "Não foi possível reproduzir o som.",
                type: "error",
            });
        } finally {
            setIsTestingOrderDingle(false);
        }
    }, [isTestingOrderDingle, orderDingleDuration]);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        await supabase.auth.signOut();
        clear();
        router.push("/restaurante/login");
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        setIsDeleting(true);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (restaurant) {
                await fetch("/api/restaurants/delete-restaurant", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        restaurantId: restaurant.id,
                        userId: user.id,
                    }),
                });
            }

            const response = await fetch("/api/auth/delete-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: session?.access_token }),
            });

            if (!response.ok) throw new Error("Erro ao deletar conta.");
            await supabase.auth.signOut();
            clear();
            router.push("/restaurante");
        } catch (error) {
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Erro ao deletar conta.",
                type: "error",
            });
            setIsDeleting(false);
            setDeleteModalOpen(false);
        }
    };

    const copyLink = async () => {
        if (!shareableUrl) return;
        await navigator.clipboard.writeText(shareableUrl);
        setToast({ message: "Link copiado!", type: "success" });
    };

    const downloadQr = async () => {
        if (!shareableUrl) return;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareableUrl)}`;
        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `qrcode-${restaurant?.url_slug || "cardapio"}.png`;
            link.click();
            URL.revokeObjectURL(objectUrl);
        } catch {
            setToast({ message: "Erro ao baixar QR Code.", type: "error" });
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center p-10">
                <Loader className="border-t-brand" />
            </div>
        );
    }

    return (
        <>
            <ConfirmModal
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteAccount}
                title="Deletar conta?"
                description="Ação irreversível. Todos os seus dados serão apagados."
                confirmLabel="Deletar conta"
                isLoading={isDeleting}
                variant="danger"
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="min-h-screen bg-gray-50 px-4 pb-20 pt-8 sm:px-6">
                <div className="mx-auto max-w-6xl space-y-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">
                            Configurações
                        </h1>
                        <p className="mt-1 text-gray-600 2xl:text-lg">
                            Gerencie sua conta e seu acesso.
                        </p>
                    </div>

                    <Card className="border border-gray-200 shadow-sm">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-xl font-medium text-gray-900">
                                Minha Conta
                            </h2>
                            <Button
                                variant="secondary"
                                onClick={handleLogout}
                                loading={isLoggingOut}
                                className="bg-white text-sm text-red-600 hover:bg-red-50"
                            >
                                <FontAwesomeIcon
                                    icon={faSignOutAlt}
                                    className="mr-2"
                                />
                                Sair da Conta
                            </Button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <Input
                                    label="Celular do Responsável"
                                    value={phone}
                                    onChange={(event) =>
                                        setPhone(formatPhone(event.target.value))
                                    }
                                    onBlur={savePhone}
                                    placeholder="(00) 00000-0000"
                                    type="tel"
                                    maxLength={15}
                                />
                                {savingField === "phone" && (
                                    <p className="mt-1 text-xs text-brand">
                                        Salvando...
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-500">
                                            E-mail
                                        </p>
                                        <p className="break-all font-medium text-gray-900">
                                            {user?.email}
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            router.push(
                                                "/painel/configuracoes/atualizando-email",
                                            )
                                        }
                                    >
                                        Alterar
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                    <div>
                                        <p className="text-sm font-medium text-gray-500">
                                            Senha
                                        </p>
                                        <p className="font-medium text-gray-900">
                                            ••••••••
                                        </p>
                                    </div>
                                    <Button
                                        variant="secondary"
                                        onClick={() =>
                                            router.push(
                                                "/painel/configuracoes/nova-senha",
                                            )
                                        }
                                    >
                                        Alterar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </Card>

                    {restaurant && (
                        <QrCodeMesaSettingsSection
                            restaurantId={restaurant.id}
                        />
                    )}

                    <Card className="border border-gray-200 shadow-sm">
                        <div className="mb-5">
                            <h2 className="text-xl font-medium text-gray-900">
                                Agendamento de pedidos
                            </h2>
                            <p className="mt-2 text-sm text-gray-500">
                                Escolha se os clientes podem agendar somente para o dia atual ou também para dias futuros. Dias futuros é mais indicado para quem trabalha com encomendas.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                disabled={isSavingOrderScheduling}
                                onClick={() => void saveOrderSchedulingMode(false)}
                                className={`cursor-pointer rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    !allowFutureOrderScheduling
                                        ? "border-brand bg-red-50"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                            >
                                <span className={`block font-semibold ${!allowFutureOrderScheduling ? "text-brand" : "text-gray-900"}`}>
                                    Dia atual
                                </span>
                                <span className="mt-1 block text-sm text-gray-500">
                                    Permite agendar apenas horários disponíveis de hoje.
                                </span>
                            </button>

                            <button
                                type="button"
                                disabled={isSavingOrderScheduling}
                                onClick={() => void saveOrderSchedulingMode(true)}
                                className={`cursor-pointer rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                    allowFutureOrderScheduling
                                        ? "border-brand bg-red-50"
                                        : "border-gray-200 bg-white hover:border-gray-300"
                                }`}
                            >
                                <span className={`block font-semibold ${allowFutureOrderScheduling ? "text-brand" : "text-gray-900"}`}>
                                    Dias futuros
                                </span>
                                <span className="mt-1 block text-sm text-gray-500">
                                    Ideal para encomendas: o cliente escolhe o dia e depois o horário disponível.
                                </span>
                            </button>
                        </div>

                        {isSavingOrderScheduling && (
                            <p className="mt-3 text-xs text-gray-400">Salvando...</p>
                        )}
                    </Card>

                    <Card className="border border-gray-200 shadow-sm">
                        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                                <h2 className="mb-2 text-xl font-medium text-gray-900">
                                    Som de novos pedidos
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Escolha por quanto tempo o aviso sonoro de chegada de
                                    pedido deve tocar.
                                </p>
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                onClick={testOrderDingle}
                                disabled={isTestingOrderDingle}
                                className="shrink-0 cursor-pointer bg-white"
                            >
                                <FontAwesomeIcon
                                    icon={faVolumeHigh}
                                    className="mr-2"
                                />
                                {isTestingOrderDingle ? "Tocando..." : "Testar som"}
                            </Button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            {ORDER_DINGLE_OPTIONS.map((option) => {
                                const selected =
                                    orderDingleDuration === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() =>
                                            saveOrderDingleDuration(option.value)
                                        }
                                        className={`cursor-pointer rounded-xl border p-4 text-left transition ${
                                            selected
                                                ? "border-brand bg-red-50 text-brand"
                                                : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 hover:bg-gray-50"
                                        }`}
                                    >
                                        <span className="block font-semibold">
                                            {option.label}
                                        </span>
                                        <span
                                            className={`mt-1 block text-sm ${
                                                selected
                                                    ? "text-brand/80"
                                                    : "text-gray-500"
                                            }`}
                                        >
                                            {option.description}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </Card>

                    <Card className="border border-gray-200 shadow-sm">
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-xl font-medium text-gray-900">
                                        Forçar envio de Notificação no WhatsApp
                                    </h2>
                                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                        Não recomendado
                                    </span>
                                    <Tooltip
                                        text="Isso adiciona uma etapa extra à finalização e pode criar atrito no pedido. O pedido é criado antes do WhatsApp: o cliente pode simplesmente não enviar a mensagem e o pedido continuará válido."
                                        position="top"
                                        size="medium"
                                        showOnClick
                                    >
                                        <FontAwesomeIcon
                                            icon={faCircleInfo}
                                            className="cursor-help text-base text-gray-400 transition-colors hover:text-brand"
                                        />
                                    </Tooltip>
                                </div>
                                <p className="mt-2 text-sm text-gray-500">
                                    Após confirmar o pedido, o cliente será direcionado ao
                                    WhatsApp do restaurante com a comanda completa já
                                    preenchida.
                                </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                                {isSavingWhatsappConfirmation && (
                                    <span className="text-xs text-gray-400">
                                        Salvando...
                                    </span>
                                )}
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={forceWhatsappOrderConfirmation}
                                    aria-label="Obrigar envio de notificação no WhatsApp"
                                    disabled={isSavingWhatsappConfirmation}
                                    onClick={() =>
                                        void saveWhatsappOrderConfirmation(
                                            !forceWhatsappOrderConfirmation,
                                        )
                                    }
                                    className={`flex h-7 w-12 cursor-pointer items-center rounded-full p-1 transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                                        forceWhatsappOrderConfirmation
                                            ? "justify-end bg-green-500"
                                            : "justify-start bg-gray-300"
                                    }`}
                                >
                                    <span className="h-5 w-5 rounded-full bg-white shadow-md" />
                                </button>
                            </div>
                        </div>
                    </Card>

                    {restaurant && shareableUrl && (
                        <Card className="border border-gray-200 shadow-sm">
                            <h2 className="mb-2 text-xl font-medium text-gray-900">
                                Compartilhar Cardápio Delivery
                            </h2>
                            <p className="mb-6 text-sm text-gray-500">
                                Divulgue seu link ou use o QR Code.
                            </p>

                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
                                <div className="min-w-0 flex-1">
                                    <Input
                                        value={shareableUrl}
                                        readOnly
                                        className="min-w-0"
                                    />
                                </div>
                                <Button
                                    variant="secondary"
                                    onClick={copyLink}
                                    className="shrink-0"
                                >
                                    <FontAwesomeIcon
                                        icon={faCopy}
                                        className="mr-2"
                                    />
                                    Copiar
                                </Button>
                            </div>

                            <div className="mt-6 flex flex-col items-center rounded-lg border border-gray-200 bg-gray-50 p-6">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareableUrl)}`}
                                    alt="QR Code do cardápio"
                                    className="mb-4 h-48 w-48 rounded-md border border-gray-200"
                                />
                                <Button
                                    variant="secondary"
                                    onClick={downloadQr}
                                >
                                    <FontAwesomeIcon
                                        icon={faDownload}
                                        className="mr-2"
                                    />
                                    Baixar Imagem
                                </Button>
                            </div>
                        </Card>
                    )}

                    <Card className="border-red-200 bg-red-50/30">
                        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                            <div>
                                <h2 className="mb-2 text-lg font-medium text-red-700">
                                    Deletar Conta
                                </h2>
                                <p className="text-sm text-red-600/70">
                                    Ação irreversível. Todos os seus dados serão
                                    apagados.
                                </p>
                            </div>
                            <Button
                                variant="secondary"
                                className="w-full bg-red-600 text-white hover:bg-red-700 md:w-auto"
                                onClick={() => setDeleteModalOpen(true)}
                            >
                                <FontAwesomeIcon
                                    icon={faTrash}
                                    className="mr-2"
                                />
                                Deletar Conta
                            </Button>
                        </div>
                    </Card>
                </div>
            </div>
        </>
    );
}
