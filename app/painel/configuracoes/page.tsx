"use client";

import { PageSaveHeader } from "@/components/ui/SaveStatus";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faChevronRight,
    faCircleInfo,
    faCopy,
    faCrown,
    faDownload,
    faGear,
    faLock,
    faReceipt,
    faQrcode,
    faSignOutAlt,
    faTrash,
    faVolumeHigh,
} from "@fortawesome/free-solid-svg-icons";
import { clearCachedAuthSession, supabase } from "@/lib/database/supabaseClient";
import { useCreationStore, useRestaurantPlus } from "@/lib/stores/restaurant-owner/creationStore";
import { useSalesStore } from "@/lib/stores/restaurant-owner/iaVendasStore";
import ListLoader from "@/components/ui/ListLoader";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import ConfigurationCard from "@/components/ui/ConfigurationCard";
import SaveStatus from "@/components/ui/SaveStatus";
import { PageLoader } from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Tooltip from "@/components/ui/Tooltip";
import ChoiceCardGroup from "@/components/ui/ChoiceCardGroup";
import NfceSettings from "@/components/restaurant-owner/configuracoes/NfceSettings";
import ResetOrderCountSection from "@/components/restaurant-owner/configuracoes/ResetOrderCountSection";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";
import PizzaSettingsSection from "@/components/restaurant-owner/configuracoes/PizzaSettingsSection";
import AddressForm, { saveRestaurantAddress, saveRestaurantSmallCityMode, SmallCityModeConfirmModal } from "@/components/restaurant-owner/configuracoes/AddressForm";
import StoreWhatsappField, { ResponsiblePhoneField } from "@/components/restaurant-owner/loja/StoreWhatsappField";
import { CollapsibleContent, useCollapsible } from "@/components/ui/CollapsibleSection";
import type { AddressData } from "@/lib/types/types";

type Restaurant = {
    id: string;
    name: string;
    url_slug?: string | null;
    user_id?: string | null;
    phone?: string | null;
    store_whatsapp: string | null;
    address: Partial<AddressData> | null;
    latitude: number | null;
    longitude: number | null;
    force_whatsapp_order_confirmation?: boolean | null;
    vitrine_enabled?: boolean;
    dark_menu_enabled?: boolean;
    delivery_fee_mode?: "radius" | "neighborhood" | null;
    small_city_mode_enabled?: boolean | null;
};

const SETTINGS_SECTIONS = {
    modos: { label: "Modos", icon: faGear },
    pedidos: { label: "Pedidos", icon: faReceipt },
};

function SettingsSection({ id, children }: { id: keyof typeof SETTINGS_SECTIONS; children: ReactNode }) {
    const { label, icon } = SETTINGS_SECTIONS[id];
    useEffect(() => {
        // Sections load after restaurant data; scroll when a tab link targets a section.
        if (window.location.hash !== `#${id}`) return;
        const frame = window.requestAnimationFrame(() => {
            document.getElementById(id)?.scrollIntoView({ block: "start" });
        });
        return () => window.cancelAnimationFrame(frame);
    }, [id]);
    return (
        <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20 space-y-4">
            <h2 id={`${id}-heading`} className="flex items-center gap-2.5 text-xl font-semibold text-gray-900">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#fff1ea] text-sm text-[#c43700]" aria-hidden="true">
                    <FontAwesomeIcon icon={icon} />
                </span>
                {label}
            </h2>
            {children}
        </section>
    );
}

function StoreDetails({ restaurant, onSaveAddress, onSmallCityModeActivated }: { restaurant: Restaurant; onSaveAddress: (data: AddressData) => Promise<void>; onSmallCityModeActivated: () => void }) {
    const addressEditor = useCollapsible();
    const [robotConnected, setRobotConnected] = useState<boolean | null>(null);
    const restaurantId = restaurant.id;

    useEffect(() => {
        const controller = new AbortController();
        void qrTableAuthenticatedFetch(
            `/api/whatsapp/connection?restaurantId=${encodeURIComponent(restaurantId)}&statusOnly=1`,
            { cache: "no-store", signal: controller.signal },
        ).then(async (response) => {
            if (!response.ok) return;
            const data = await response.json() as { connected: boolean };
            if (!controller.signal.aborted) setRobotConnected(data.connected);
        }).catch(() => {});
        return () => controller.abort();
    }, [restaurantId]);

    const address = restaurant.address;
    const streetLine = [address?.street, address?.number].filter(Boolean).join(", ");
    const cityLine = [address?.city, address?.state].filter(Boolean).join(" - ");
    const summary = [streetLine, address?.neighborhood, cityLine].filter(Boolean).join(" · ");

    return (
        <>
            <StoreWhatsappField
                restaurantId={restaurantId}
                initialValue={restaurant.store_whatsapp}
                labelAction={
                    <Link
                        href="/painel/robo-whatsapp"
                        className="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                        <Badge variant={robotConnected ? "success" : "neutral"}>
                            {robotConnected === null ? "Robô WhatsApp" : robotConnected ? "Robô conectado" : "Conectar robô WhatsApp"}
                        </Badge>
                    </Link>
                }
            />
            <div>
                <div className="flex min-w-0 items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="text-xs font-medium leading-[18px] text-gray-900">Endereço do restaurante</h3>
                        <p className="mt-1 break-words text-sm text-gray-600">{summary || "Endereço não cadastrado."}</p>
                    </div>
                    <Button
                        {...addressEditor.triggerProps}
                        variant="secondary"
                        aria-label={addressEditor.expanded ? "Recolher endereço" : "Alterar endereço"}
                        className="shrink-0"
                    >
                        {addressEditor.expanded ? "Recolher" : "Alterar"}
                    </Button>
                </div>
                <CollapsibleContent id={addressEditor.contentId} expanded={addressEditor.expanded}>
                    <div className="py-5">
                        <AddressForm
                            embedded
                            restaurantId={restaurantId}
                            smallCityModeEnabled={restaurant.small_city_mode_enabled === true}
                            onSmallCityModeActivated={onSmallCityModeActivated}
                            initialData={{ ...address, latitude: restaurant.latitude, longitude: restaurant.longitude }}
                            onSubmit={onSaveAddress}
                        />
                    </div>
                </CollapsibleContent>
            </div>
        </>
    );
}

function MenuShareControls({ url, label, onCopy, onDownload }: {
    url: string;
    label: "delivery" | "vitrine";
    onCopy: () => Promise<void>;
    onDownload: () => Promise<void>;
}) {
    const [showQr, setShowQr] = useState(false);
    const qrId = useId();

    return (
        <>
            <div className="mt-6 flex min-w-0 flex-col gap-3 sm:flex-row">
                <div className="min-w-0 flex-1">
                    <Input value={url} readOnly aria-label={`Link do cardápio ${label}`} className="min-w-0" />
                </div>
                <Button variant="secondary" onClick={() => void onCopy()} className="shrink-0">
                    <FontAwesomeIcon icon={faCopy} className="mr-2" />
                    Copiar link
                </Button>
                <Button variant="secondary" onClick={() => window.open(url, "_blank", "noopener,noreferrer")} className="shrink-0">
                    Abrir cardápio
                </Button>
                <Button variant="secondary" aria-expanded={showQr} aria-controls={qrId}
                    onClick={() => setShowQr((current) => !current)} className="shrink-0">
                    <FontAwesomeIcon icon={faQrcode} className="mr-2" />
                    QR Code
                </Button>
            </div>
            <div id={qrId} hidden={!showQr}>
                {showQr && (
                    <div className="mt-4 flex flex-col items-center rounded-lg border border-gray-200 bg-gray-50 p-6">
                        <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`}
                            alt={`QR Code do cardápio ${label}`}
                            className="mb-4 h-48 w-48 rounded-md border border-gray-200"
                        />
                        <Button variant="secondary" onClick={() => void onDownload()}>
                            <FontAwesomeIcon icon={faDownload} className="mr-2" />
                            Baixar Imagem
                        </Button>
                    </div>
                )}
            </div>
        </>
    );
}

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

export default function ConfiguracoesPage() {
    const router = useRouter();
    const { restaurantId, setRestaurantId, clear } = useCreationStore();
    const [user, setUser] = useState<User | null>(null);
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [loading, setLoading] = useState(true);
    const [saveErrors, setSaveErrors] = useState<Record<string, boolean>>({});
    const [orderDingleDuration, setOrderDingleDuration] =
        useState<OrderDingleDuration>("short");
    const [isTestingOrderDingle, setIsTestingOrderDingle] = useState(false);
    const orderDingleAudioRef = useRef<HTMLAudioElement | null>(null);
    const [forceWhatsappOrderConfirmation, setForceWhatsappOrderConfirmation] =
        useState(false);
    const [isSavingWhatsappConfirmation, setIsSavingWhatsappConfirmation] =
        useState(false);
    const [isSavingVitrine, setIsSavingVitrine] = useState(false);
    const [isSavingSmallCityMode, setIsSavingSmallCityMode] = useState(false);
    const [confirmSmallCityModeOpen, setConfirmSmallCityModeOpen] = useState(false);
    const [isExportingMenu, setIsExportingMenu] = useState(false);
    const pdfAccess = useRestaurantPlus(restaurant?.id ?? restaurantId);
    const [pdfSalesOpen, setPdfSalesOpen] = useState(false);
    const [darkThemeSalesOpen, setDarkThemeSalesOpen] = useState(false);
    const [isSavingDarkMenu, setIsSavingDarkMenu] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [shareableUrl, setShareableUrl] = useState("");
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);

    const vitrineUrl = shareableUrl && restaurant?.url_slug
        ? new URL(`/vitrine/${restaurant.url_slug}`, shareableUrl).href
        : "";

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
                            "id, name, url_slug, user_id, phone, store_whatsapp, address, latitude, longitude, force_whatsapp_order_confirmation, vitrine_enabled, dark_menu_enabled, delivery_fee_mode, small_city_mode_enabled",
                        )
                        .eq("id", targetId)
                        .single();

                    if (restData) {
                        setRestaurant(restData);
                        setForceWhatsappOrderConfirmation(
                            restData.force_whatsapp_order_confirmation === true,
                        );
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

    const currentRestaurantId = restaurant?.id;
    const saveAddress = useCallback(async (data: AddressData) => {
        if (!currentRestaurantId) return;
        await saveRestaurantAddress(currentRestaurantId, data);
        setRestaurant((current) => current?.id === currentRestaurantId
            ? { ...current, address: data, latitude: data.latitude, longitude: data.longitude }
            : current);
    }, [currentRestaurantId]);

    const saveWhatsappOrderConfirmation = async (enabled: boolean) => {
        if (!restaurant || isSavingWhatsappConfirmation) return;

        setIsSavingWhatsappConfirmation(true);
        setSaveErrors(previous => ({ ...previous, whatsapp: false }));
        const { error } = await supabase
            .from("restaurants")
            .update({ force_whatsapp_order_confirmation: enabled })
            .eq("id", restaurant.id);
        setIsSavingWhatsappConfirmation(false);

        if (error) {
            setSaveErrors(previous => ({ ...previous, whatsapp: true }));
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

    const saveSmallCityMode = async (enabled: boolean) => {
        if (!restaurant || isSavingSmallCityMode) return;

        setIsSavingSmallCityMode(true);
        setSaveErrors(previous => ({ ...previous, smallCity: false }));
        const { data, error } = await saveRestaurantSmallCityMode(restaurant.id, enabled);
        setIsSavingSmallCityMode(false);

        if (error || !data) {
            setSaveErrors(previous => ({ ...previous, smallCity: true }));
            setToast({ message: "Erro ao salvar o Modo Cidade Pequena.", type: "error" });
            return;
        }

        setRestaurant(current => current
            ? { ...current, small_city_mode_enabled: enabled, delivery_fee_mode: data.delivery_fee_mode }
            : current);
        setConfirmSmallCityModeOpen(false);
    };

    const saveVitrineMode = async (enabled: boolean) => {
        if (!restaurant || isSavingVitrine) return;
        setIsSavingVitrine(true);
        setSaveErrors(previous => ({ ...previous, vitrine: false }));
        try {
            const { data, error } = await supabase
                .from("restaurants")
                .update({ vitrine_enabled: enabled })
                .eq("id", restaurant.id)
                .select("vitrine_enabled")
                .single();
            if (error) throw error;

            setRestaurant((current) => current
                ? { ...current, vitrine_enabled: data.vitrine_enabled }
                : current);
            setToast({
                message: enabled ? "Modo Vitrine ativado." : "Modo Vitrine desativado.",
                type: "success",
            });
        } catch (error) {
            setSaveErrors(previous => ({ ...previous, vitrine: true }));
            console.error("Erro ao salvar modo vitrine:", error);
            setToast({ message: "Erro ao salvar o Modo Vitrine.", type: "error" });
        } finally {
            setIsSavingVitrine(false);
        }
    };

    const saveDarkMenuMode = async (enabled: boolean) => {
        if (!restaurant || isSavingDarkMenu) return;
        if (pdfAccess === null) return;
        if (!pdfAccess) {
            setDarkThemeSalesOpen(true);
            return;
        }

        setIsSavingDarkMenu(true);
        setSaveErrors(previous => ({ ...previous, dark: false }));
        try {
            const response = await qrTableAuthenticatedFetch("/api/menu/dark-theme", {
                method: "PATCH",
                body: JSON.stringify({ restaurantId: restaurant.id, enabled }),
            });
            const result = await response.json() as { enabled?: boolean; error?: string };
            if (!response.ok) {
                if (response.status === 403) {
                    void useSalesStore.getState().refreshUsage(restaurant.id);
                    setDarkThemeSalesOpen(true);
                }
                throw new Error(result.error || "Não foi possível salvar o tema.");
            }
            setRestaurant((current) => current
                ? { ...current, dark_menu_enabled: result.enabled === true }
                : current);
        } catch (error) {
            setSaveErrors(previous => ({ ...previous, dark: true }));
            setToast({
                message: error instanceof Error ? error.message : "Erro ao salvar o tema escuro.",
                type: "error",
            });
        } finally {
            setIsSavingDarkMenu(false);
        }
    };

    const exportPrintableMenu = async () => {
        if (!restaurant || isExportingMenu) return;
        if (pdfAccess === null) return;
        if (!pdfAccess) {
            setPdfSalesOpen(true);
            return;
        }

        setIsExportingMenu(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Sua sessão expirou. Entre novamente.");
            const response = await fetch(
                `/api/menu/export-pdf?restaurantId=${encodeURIComponent(restaurant.id)}`,
                { headers: { Authorization: `Bearer ${session.access_token}` } },
            );
            if (!response.ok) {
                const result = await response.json().catch(() => null);
                throw new Error(result?.error || "Não foi possível exportar o cardápio.");
            }

            const file = await response.blob();
            const url = URL.createObjectURL(file);
            try {
                const link = document.createElement("a");
                link.href = url;
                link.download = `cardapio-${(restaurant.url_slug || "imenu").replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf`;
                document.body.appendChild(link);
                link.click();
                link.remove();
            } finally {
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        } catch (error) {
            setToast({
                message: error instanceof Error ? error.message : "Erro ao exportar cardápio.",
                type: "error",
            });
        } finally {
            setIsExportingMenu(false);
        }
    };

    const copyLink = async (url: string, message: string) => {
        try {
            await navigator.clipboard.writeText(url);
            setToast({ message, type: "success" });
        } catch {
            setToast({ message: "Não foi possível copiar o link.", type: "error" });
        }
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
        try {
            await supabase.auth.signOut();
        } catch {
            // An invalid or unreachable server session must not block local logout.
        }

        try {
            // Supabase can leave the cached session behind when server sign-out fails.
            clearCachedAuthSession();
            window.localStorage.removeItem("imenu:landing-panel-auto-redirect");

            clear();
            // Reset the in-memory auth client before the login page checks its session.
            window.location.replace("/restaurante/login");
        } catch {
            setToast({ message: "Não foi possível sair da conta. Tente novamente.", type: "error" });
            setIsLoggingOut(false);
        }
    };

    const handleDeleteAccount = async () => {
        if (!user) return;
        setIsDeleting(true);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) throw new Error("Sessão expirada.");

            const restaurantResponse = await fetch("/api/restaurants/delete-restaurant", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ allOwned: true }),
            });

            if (!restaurantResponse.ok) {
                const failure = await restaurantResponse.json().catch(() => null);
                if (failure?.error === "restaurant_has_payouts") {
                    throw new Error("Há repasses registrados nesta conta. Fale com o suporte para solicitar a exclusão.");
                }
                if (failure?.error === "restaurant_has_linked_records") {
                    throw new Error("Há registros vinculados ao restaurante. Fale com o suporte para solicitar a exclusão.");
                }
                throw new Error("Não foi possível excluir os dados do restaurante. Tente novamente.");
            }

            const response = await fetch("/api/auth/delete-account", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: session?.access_token }),
            });

            if (!response.ok) throw new Error("Erro ao deletar conta.");
            const deletion = await response.json().catch(() => null);
            await supabase.auth.signOut({ scope: "local" }).catch(() => null);
            clear();
            try {
                if (typeof deletion?.feedbackToken === "string") {
                    sessionStorage.setItem("imenu:account-deletion-feedback", deletion.feedbackToken);
                    window.location.replace("/restaurante/conta-excluida");
                    return;
                }
            } catch {
                // Feedback is optional and must never block account deletion.
            }
            window.location.replace("/restaurante");
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

    const downloadQr = async (url: string, filename: string) => {
        if (!url) return;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`;
        try {
            const response = await fetch(qrUrl);
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `qrcode-${filename}.png`;
            link.click();
            URL.revokeObjectURL(objectUrl);
        } catch {
            setToast({ message: "Erro ao baixar QR Code.", type: "error" });
        }
    };

    if (loading) {
        return (
            <PageLoader />
        );
    }

    return (
        <>
            <SmallCityModeConfirmModal
                open={confirmSmallCityModeOpen}
                onClose={() => setConfirmSmallCityModeOpen(false)}
                onConfirm={() => void saveSmallCityMode(true)}
                isLoading={isSavingSmallCityMode}
            />

            <ConfirmModal
                open={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteAccount}
                title="Deletar conta?"
                description="Ação irreversível. Todos os seus dados serão apagados."
                confirmLabel="Deletar conta"
                confirmationText="deletar minha conta"
                isLoading={isDeleting}
                variant="danger"
            />

            {restaurant && <IaPlusSalesModal
                open={pdfSalesOpen || darkThemeSalesOpen}
                onClose={() => { setPdfSalesOpen(false); setDarkThemeSalesOpen(false); }}
                restaurantId={restaurant.id}
                contextFeature={darkThemeSalesOpen ? "dark_menu" : "menu_pdf"}
                contextMessage={darkThemeSalesOpen
                    ? "Com o iMenu Plus, ofereça seu cardápio com tema escuro."
                    : "Com o iMenu Plus, exporte seu cardápio em PDF para imprimir ou compartilhar."}
                onPaid={() => {
                    setPdfSalesOpen(false);
                    setDarkThemeSalesOpen(false);
                    return useSalesStore.getState().refreshUsage(restaurant.id);
                }}
            />}
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <div className="min-h-screen bg-gray-50 px-4 pb-20 pt-8 sm:px-6">
                <div className="mx-auto max-w-6xl space-y-10">
                    <PageSaveHeader>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">Configurações</h1>
                            <p className="mt-1 text-gray-600">Gerencie sua loja, sua conta e as preferências do painel.</p>
                        </div>
                    </PageSaveHeader>

                    <div className="space-y-4">
                        <div className={`grid gap-4 ${restaurant ? "lg:grid-cols-2" : ""}`}>
                            <Card className="space-y-4">
                                <div className="flex min-h-7 items-center justify-between gap-3">
                                    <h2 className="text-lg font-semibold text-gray-900">Conta</h2>
                                    <Button
                                        variant="secondary"
                                        onClick={handleLogout}
                                        loading={isLoggingOut}
                                        className="!min-h-0 !border-0 !bg-transparent !px-0 !py-0 text-sm text-red-600 hover:!bg-transparent hover:text-red-700"
                                    >
                                        <FontAwesomeIcon icon={faSignOutAlt} className="mr-2" />
                                        Sair da conta
                                    </Button>
                                </div>
                                {restaurant && (
                                    <ResponsiblePhoneField key={restaurant.id} restaurantId={restaurant.id} initialValue={restaurant.phone ?? null} />
                                )}
                                {user && (
                                    <div className="flex flex-wrap items-end gap-2 sm:flex-nowrap">
                                        <div className="w-full min-w-0 sm:flex-1">
                                            <Input label="E-mail" type="email" value={user.email ?? ""} readOnly locked />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="flex-1 sm:flex-none"
                                            onClick={() => router.push("/painel/configuracoes/atualizando-email")}
                                        >
                                            Alterar e-mail
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="flex-1 sm:flex-none"
                                            onClick={() => router.push("/painel/configuracoes/nova-senha")}
                                        >
                                            Mudar senha
                                        </Button>
                                    </div>
                                )}
                            </Card>
                            {restaurant && (
                                <Card className="space-y-4">
                                    <h2 className="flex min-h-7 items-center text-lg font-semibold text-gray-900">Loja</h2>
                                    <StoreDetails key={restaurant.id} restaurant={restaurant} onSaveAddress={saveAddress} onSmallCityModeActivated={() => setRestaurant(current => current?.id === restaurant.id ? { ...current, small_city_mode_enabled: true, delivery_fee_mode: "neighborhood" } : current)} />
                                </Card>
                            )}
                        </div>

                        <Card className="!p-0 overflow-hidden">
                            <button
                                type="button"
                                onClick={() => router.push("/painel/planos")}
                                className="group flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-gray-100"
                            >
                                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-gray-100 text-gray-700">
                                    <FontAwesomeIcon icon={faCrown} />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block font-medium text-gray-900">
                                        Planos do iMenu
                                    </span>
                                    <span className="mt-0.5 block text-sm text-gray-500">
                                        Confira seus benefícios e opções disponíveis.
                                    </span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-600 transition-colors group-hover:text-gray-900">
                                    <span className="hidden sm:inline">Ver planos</span>
                                    <FontAwesomeIcon icon={faChevronRight} />
                                </span>
                            </button>
                        </Card>
                    </div>

                    {restaurant && (
                        <SettingsSection id="modos">
                            <PizzaSettingsSection restaurantId={restaurant.id} />

                            <ConfigurationCard
                                title="Modo Vitrine"
                                description="Crie um cardápio separado dos demais, exclusivo para visualização. Seus clientes podem consultar produtos e preços, mas não realizar pedidos."
                                checked={restaurant.vitrine_enabled === true}
                                disabled={isSavingVitrine}
                                onChange={enabled => void saveVitrineMode(enabled)}
                                footer={<SaveStatus status={saveErrors.vitrine ? "error" : isSavingVitrine ? "saving" : "saved"} />}
                            >
                                {restaurant.vitrine_enabled && vitrineUrl && (
                                    <MenuShareControls
                                        url={vitrineUrl}
                                        label="vitrine"
                                        onCopy={() => copyLink(vitrineUrl, "Link da vitrine copiado!")}
                                        onDownload={() => downloadQr(vitrineUrl, `vitrine-${restaurant.url_slug || "cardapio"}`)}
                                    />
                                )}
                            </ConfigurationCard>

                            <div id="nfce" className="scroll-mt-20">
                                {pdfAccess === null ? <Card><ListLoader lines={2} /></Card> : <NfceSettings key={pdfAccess ? "plus" : "locked"} restaurant={restaurant.id} address={restaurant.address} locked={!pdfAccess} />}
                            </div>

                            <ConfigurationCard
                                title="Cardápio com Tema Escuro"
                                plus={pdfAccess ?? undefined}
                                description={<>Exiba seu cardápio com cores escuras, inclusive em Mesas e Vitrine.{" "}
                                    <a href="https://www.imenuapp.com.br/pizzaria-la-grucia-dark" target="_blank" rel="noopener noreferrer"
                                        className="font-medium text-brand underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Ver exemplo de Tema Escuro</a>
                                </>}
                                checked={restaurant.dark_menu_enabled === true && pdfAccess === true}
                                disabled={isSavingDarkMenu || pdfAccess === null}
                                onChange={() => void saveDarkMenuMode(restaurant.dark_menu_enabled !== true)}
                                toggleTooltip={pdfAccess === false ? "Disponível com iMenu Plus. Assine o plano para ativar o tema escuro." : undefined}
                                footer={<SaveStatus status={saveErrors.dark ? "error" : isSavingDarkMenu ? "saving" : "saved"} />}
                            />

                            <ConfigurationCard
                                title="Modo Cidade Pequena (CEP opcional)"
                                description="Permite pedidos sem CEP, calculando a entrega pelo bairro e oferecendo um campo de ponto de referência."
                                checked={restaurant.small_city_mode_enabled === true}
                                disabled={isSavingSmallCityMode}
                                onChange={enabled => {
                                    if (!enabled) void saveSmallCityMode(false);
                                    else setConfirmSmallCityModeOpen(true);
                                }}
                                footer={<SaveStatus status={saveErrors.smallCity ? "error" : isSavingSmallCityMode ? "saving" : "saved"} />}
                            />
                        </SettingsSection>
                    )}

                    <SettingsSection id="pedidos">
                        <Card className="border border-gray-200 shadow-sm">
                            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <h3 className="mb-2 text-lg font-semibold text-gray-900">
                                        Som de novos pedidos
                                    </h3>
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

                            <ChoiceCardGroup
                                value={orderDingleDuration}
                                options={ORDER_DINGLE_OPTIONS}
                                onChange={saveOrderDingleDuration}
                                className="md:grid-cols-3"
                            />
                        </Card>

                        <ConfigurationCard
                            title="Forçar envio de Notificação no WhatsApp"
                            titleBadge={
                                <Tooltip
                                    text="Isso adiciona uma etapa extra à finalização e pode criar atrito no pedido. O pedido é criado antes do WhatsApp: o cliente pode simplesmente não enviar a mensagem e o pedido continuará válido."
                                    position="top" size="medium" showOnClick
                                    parentClassName="inline-flex items-center self-center leading-none"
                                >
                                    <Badge variant="notRecommended" className="gap-1 cursor-help">
                                        Não recomendado
                                        <FontAwesomeIcon icon={faCircleInfo} className="text-[11px] leading-none text-yellow-700" />
                                    </Badge>
                                </Tooltip>
                            }
                            description="Após confirmar o pedido, o cliente será direcionado ao WhatsApp do restaurante com a comanda completa já preenchida."
                            checked={forceWhatsappOrderConfirmation}
                            ariaLabel="Obrigar envio de notificação no WhatsApp"
                            disabled={isSavingWhatsappConfirmation}
                            onChange={enabled => void saveWhatsappOrderConfirmation(enabled)}
                            footer={<SaveStatus status={saveErrors.whatsapp ? "error" : isSavingWhatsappConfirmation ? "saving" : "saved"} />}
                        />

                        {restaurant && (
                            <Card className="border border-gray-200 shadow-sm">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                Exportar Cardápio para Impressão
                                            </h3>
                                            {pdfAccess !== null && <Badge preset={pdfAccess ? "featureAvailable" : "plusIncluded"} />}
                                        </div>
                                        <p className="mt-2 text-sm text-gray-500">
                                            Baixe um PDF pronto para imprimir, com suas categorias, produtos, descrições e preços.
                                        </p>
                                    </div>
                                    <div className="flex shrink-0 items-start">
                                        {pdfAccess === null ? (
                                            <Button variant="secondary" disabled>Exportar PDF</Button>
                                        ) : pdfAccess ? (
                                            <Button
                                                variant="secondary"
                                                onClick={() => void exportPrintableMenu()}
                                                loading={isExportingMenu}
                                                className="gap-2"
                                            >
                                                <FontAwesomeIcon icon={faDownload} />
                                                Exportar PDF
                                            </Button>
                                        ) : (
                                            <Tooltip text="Disponível com iMenu Plus. Assine o plano para exportar o cardápio." parentClassName="!block">
                                                <Button onClick={() => setPdfSalesOpen(true)} className="gap-2">
                                                    Desbloquear exportação
                                                    <FontAwesomeIcon icon={faLock} />
                                                </Button>
                                            </Tooltip>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )}

                        {restaurant && shareableUrl && (
                            <Card className="border border-gray-200 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Compartilhar Cardápio Delivery
                                </h3>
                                <p className="mt-2 text-sm text-gray-500">
                                    Divulgue seu link ou use o QR Code.
                                </p>
                                <MenuShareControls
                                    url={shareableUrl}
                                    label="delivery"
                                    onCopy={() => copyLink(shareableUrl, "Link copiado!")}
                                    onDownload={() => downloadQr(shareableUrl, restaurant.url_slug || "cardapio")}
                                />
                            </Card>
                        )}

                        {restaurant && <ResetOrderCountSection restaurantId={restaurant.id} />}
                    </SettingsSection>

                    <Card className="border-red-200 bg-red-50/30">
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                <div>
                                    <h3 className="mb-2 text-lg font-medium text-red-700">
                                        Deletar Conta
                                    </h3>
                                    <p className="text-sm text-red-600/70">
                                        Ação irreversível. Todos os seus dados serão
                                        apagados.
                                    </p>
                                </div>
                                <Button
                                    variant="secondary"
                                    className="shrink-0 bg-red-600 text-white hover:bg-red-700"
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
