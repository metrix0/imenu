"use client";

import PanelNavigation, { type PanelMenuItem } from "@/components/common/PanelNavigation";

import { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { PanelIcon as FontAwesomeIcon, faMotorRacingHelmet } from "@/components/ui/PanelIcon";
import {
    faBox,
    faChair,
    faChartLine,
    faCircleQuestion,
    faClock,
    faCrown,
    faDoorOpen,
    faGear,
    faGift,
    faHome,
    faMoneyBillWave,
    faMobileScreenButton,
    faPercent,
    faPowerOff,
    faPrint,
    faPuzzlePiece,
    faRobot,
    faRocket,
    faStore,
    faTruck,
    faUtensils,
    faUsers,
    faBullhorn,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

import ConfirmModal from "@/components/ui/ConfirmModal";
import Loader from "@/components/ui/Loader";
import { useSalesStore } from "@/lib/stores/restaurant-owner/iaVendasStore";
import SupportButton, {
    type SupportButtonRef,
} from "@/components/common/SupportButton";
import { OrderSoundProvider } from "@/components/restaurant-owner/OrderSoundProvider";
import { ensureOwnerPushSubscription } from "@/lib/push/client";
import { supabase } from "@/lib/database/supabaseClient";
import { capturePosthogLightweight } from "@/lib/api/instrumentation-client";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

type ScreenWakeLockSentinel = {
    release: () => Promise<void>;
    addEventListener: (
        type: "release",
        listener: () => void,
        options?: { once?: boolean }
    ) => void;
};

type AvailabilitySlot = {
    open: string;
    close: string;
};

type Availability = Record<string, AvailabilitySlot[]>;

function isStoreOpenBySchedule(
    availability: Availability | null,
    now: Date
): boolean {
    if (!availability) return false;

    const slots = availability[String(now.getDay())];
    if (!Array.isArray(slots) || slots.length === 0) return false;

    return slots.some((slot) => {
        const [openH, openM] = slot.open.split(":").map(Number);
        const [closeH, closeM] = slot.close.split(":").map(Number);

        const openDate = new Date(now);
        openDate.setHours(openH, openM, 0, 0);

        const closeDate = new Date(now);
        closeDate.setHours(closeH, closeM, 0, 0);

        return now >= openDate && now <= closeDate;
    });
}

function getParamRestaurantId(
    params: ReturnType<typeof useParams>
): string | null {
    const value = params?.restauranteId;
    if (Array.isArray(value)) return value[0] || null;
    return typeof value === "string" ? value : null;
}

export default function PainelLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const pathname = usePathname();
    const router = useRouter();
    const restaurantId = useCreationStore(state => state.restaurantId);
    const refreshUsage = useSalesStore(state => state.refreshUsage);
    const usageAccess = useSalesStore(state => state.usageAccess);
    const supportButtonRef = useRef<SupportButtonRef>(null);
    const productPageViewRef = useRef<string | null>(null);

    const [isStoreClosed, setIsStoreClosed] = useState(false);
    const [availability, setAvailability] = useState<Availability | null>(null);
    const [scheduleNow, setScheduleNow] = useState(() => new Date());
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [isTogglingStore, setIsTogglingStore] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [isPasswordRecoveryFlow, setIsPasswordRecoveryFlow] = useState(false);
    const [showNewAnalysisDot, setShowNewAnalysisDot] = useState(false);

    const base = "/painel";
    const targetRestaurantId = restaurantId || getParamRestaurantId(params);
    const finishedAnalysisAt = usageAccess?.restaurant_id === targetRestaurantId
        ? usageAccess.latest_analysis_finished_at
        : null;

    useEffect(() => {
        const finished = finishedAnalysisAt ? Date.parse(finishedAnalysisAt) : NaN;
        const now = Date.now();
        const remaining = finished + 48 * 60 * 60 * 1000 - now;
        if (!Number.isFinite(finished) || finished > now || remaining <= 0) {
            setShowNewAnalysisDot(false);
            return;
        }
        setShowNewAnalysisDot(true);
        const timeout = window.setTimeout(() => setShowNewAnalysisDot(false), remaining);
        return () => window.clearTimeout(timeout);
    }, [finishedAnalysisAt]);

    useEffect(() => {
        if (!targetRestaurantId || typeof Notification === "undefined" ||
            Notification.permission !== "granted") return;

        void ensureOwnerPushSubscription(targetRestaurantId).catch((error) => {
            console.error("[OWNER_PUSH] Automatic registration repair failed:", error);
        });
    }, [targetRestaurantId]);

    useEffect(() => {
        if (!targetRestaurantId || isChecking) return;
        const refresh = () => { if (document.visibilityState === "visible") void refreshUsage(targetRestaurantId); };
        refresh();
        window.addEventListener("focus", refresh);
        return () => window.removeEventListener("focus", refresh);
    }, [targetRestaurantId, pathname, isChecking, refreshUsage]);

    useEffect(() => {
        const wakeLock = (
            navigator as Navigator & {
                wakeLock?: {
                    request: (
                        type: "screen"
                    ) => Promise<ScreenWakeLockSentinel>;
                };
            }
        ).wakeLock;

        if (!wakeLock) return;

        let active = true;
        let sentinel: ScreenWakeLockSentinel | null = null;

        const requestWakeLock = async () => {
            if (
                !active ||
                sentinel ||
                document.visibilityState !== "visible"
            ) {
                return;
            }

            try {
                sentinel = await wakeLock.request("screen");
                sentinel.addEventListener(
                    "release",
                    () => {
                        sentinel = null;
                    },
                    { once: true }
                );
            } catch {
                sentinel = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === "visible") {
                void requestWakeLock();
            }
        };

        void requestWakeLock();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            active = false;
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
            if (sentinel) void sentinel.release();
        };
    }, []);

    useEffect(() => {
        const fetchContext = async () => {
            if (!targetRestaurantId) return;

            try {
                const restaurantResult = await supabase
                    .from("restaurants")
                    .select("is_closed, availability_json")
                    .eq("id", targetRestaurantId)
                    .single();

                setAvailability(
                    (restaurantResult.data?.availability_json as Availability | null) ?? null
                );

                const closedDate = restaurantResult.data?.is_closed;
                if (!closedDate) {
                    setIsStoreClosed(false);
                    return;
                }

                const today = new Date().toISOString().split("T")[0];
                const savedDate = new Date(closedDate)
                    .toISOString()
                    .split("T")[0];

                if (savedDate === today) {
                    setIsStoreClosed(true);
                    return;
                }

                await fetch(`/api/restaurants/${targetRestaurantId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ is_closed: null }),
                });
                setIsStoreClosed(false);
            } catch (error) {
                console.error("Erro no layout:", error);
            }
        };

        void fetchContext();
    }, [targetRestaurantId, pathname]);

    useEffect(() => {
        const updateScheduleNow = () => setScheduleNow(previous => {
            const next = new Date();
            return isStoreOpenBySchedule(availability, previous) === isStoreOpenBySchedule(availability, next)
                ? previous
                : next;
        });
        updateScheduleNow();
        const interval = window.setInterval(updateScheduleNow, 30_000);
        window.addEventListener("focus", updateScheduleNow);

        return () => {
            window.clearInterval(interval);
            window.removeEventListener("focus", updateScheduleNow);
        };
    }, [availability]);

    useEffect(() => {
        const checkAuth = async () => {
            const isRecoveryCallback =
                pathname === "/painel/configuracoes/nova-senha" &&
                (new URLSearchParams(window.location.search).has("code") ||
                    window.location.hash.includes("type=recovery"));

            if (isRecoveryCallback) {
                setIsPasswordRecoveryFlow(true);
                setIsChecking(false);
                return;
            }

            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
                router.replace("/restaurante/login");
                return;
            }

            setIsChecking(false);
            // The SDK excludes panel events; measure these product pages without loading it.
            if (window.location.pathname === pathname && productPageViewRef.current !== pathname) {
                productPageViewRef.current = pathname;
                if (["/painel/vendas-ia", "/painel/assistente-ia", "/painel/mesas"].includes(pathname?.replace(/\/$/, "") || "")) {
                    capturePosthogLightweight("$pageview", session.user.id, {
                        $pathname: pathname,
                    });
                }
            }
        };

        void checkAuth();
    }, [pathname, router]);

    const handleStoreToggle = async (action: "open" | "close") => {
        if (!targetRestaurantId) return;

        setIsTogglingStore(true);
        try {
            const response = await fetch(
                `/api/restaurants/${targetRestaurantId}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        is_closed:
                            action === "close"
                                ? new Date().toISOString()
                                : null,
                    }),
                }
            );

            if (!response.ok) throw new Error("Falha ao atualizar");

            setIsStoreClosed(action === "close");
            if (action === "close") setShowCloseModal(false);
        } catch (error) {
            console.error("Erro ao alterar status da loja:", error);
            window.alert("Erro ao alterar status da loja.");
        } finally {
            setIsTogglingStore(false);
        }
    };

    const cardapioHref = `${base}/cardapio`;

    const menuItems: PanelMenuItem[] = [
        { label: "Pedidos", icon: faHome, href: `${base}/` },
        { label: "Histórico", icon: faBox, href: `${base}/historico` },
        { label: "Cardápio", icon: faUtensils, href: cardapioHref },
        { label: "Assistente IA", icon: faWandMagicSparkles, href: `${base}/assistente-ia` },
        { label: "Clientes", icon: faUsers, href: `${base}/clientes`, isNew: true },
        { label: "Mesas", icon: faChair, href: `${base}/mesas` },
        {
            label: "Repasses",
            icon: faMoneyBillWave,
            href: `${base}/repasses`,
        },
        {
            label: "Analytics",
            icon: faChartLine,
            href: `${base}/analytics`,
        },
        { type: "divider" },
        { label: "Loja", icon: faStore, href: `${base}/loja` },
        { label: "Vendas IA", icon: faRocket, href: `${base}/vendas-ia`, notification: finishedAnalysisAt && showNewAnalysisDot ? "PRONTO" : undefined, notificationTitle: "Vendas IA — análise pronta" },
        { label: "Promoções", icon: faPercent, href: `${base}/promocoes` },
        { label: "Marketing", icon: faBullhorn, href: `${base}/marketing`, isNew: true },
        { label: "Horários", icon: faClock, href: `${base}/disponibilidade` },
        { label: "Taxa e Tempo", icon: faTruck, href: `${base}/tempo-e-taxa` },
        { label: "Motoboy e Garçom", icon: faMotorRacingHelmet, href: `${base}/motoboy-garcom` },
        { label: "Fidelidade", icon: faGift, href: `${base}/fidelidade` },
        { type: "divider" },
        { label: "Aplicativo", icon: faMobileScreenButton, href: `${base}/aplicativo` },
        { label: "Robô WhatsApp", icon: faRobot, href: `${base}/robo-whatsapp` },
        { label: "Impressora", icon: faPrint, href: `${base}/impressora` },
        { label: "Integrações", icon: faPuzzlePiece, href: `${base}/integracoes` },
        {
            label: "Configurações",
            icon: faGear,
            href: `${base}/configuracoes`,
        },
        { type: "divider" },
        { label: "iMenu Plus", icon: faCrown, href: `${base}/planos`, isNew: true },
    ];

    const trackPanelTabOpen = (item: { label: string; href: string }) => {
        capturePosthogLightweight(
            "panel_tab_opened",
            targetRestaurantId || "panel_navigation",
            {
                tab: item.label,
                path: item.href,
            }
        );
    };

    if (isChecking) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader />
            </div>
        );
    }

    if (isPasswordRecoveryFlow) {
        return <main className="min-h-screen bg-gray-50">{children}</main>;
    }

    const storeStatus = isStoreClosed
        ? "manual"
        : isStoreOpenBySchedule(availability, scheduleNow)
          ? "open"
          : "scheduled-closed";

    const storeStatusButton = (fullWidth: boolean) => (
        <button
            type="button"
            onClick={() =>
                isStoreClosed
                    ? void handleStoreToggle("open")
                    : setShowCloseModal(true)
            }
            disabled={isTogglingStore}
            className={`panel-store-status flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                fullWidth ? "w-full" : ""
            } ${
                storeStatus === "manual"
                    ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    : storeStatus === "open"
                      ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                      : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
            }`}
        >
            <FontAwesomeIcon
                icon={
                    storeStatus === "manual"
                        ? faDoorOpen
                        : storeStatus === "open"
                          ? faPowerOff
                          : faClock
                }
            />
            {storeStatus === "manual"
                ? "Fechada manualmente"
                : storeStatus === "open"
                  ? "Loja aberta"
                  : "Loja fechada"}
        </button>
    );


    return (
        <OrderSoundProvider>
            <ConfirmModal
                open={showCloseModal}
                onClose={() => setShowCloseModal(false)}
                onConfirm={() => void handleStoreToggle("close")}
                title="Fechar Loja Hoje?"
                description="Isso fechará a loja temporariamente. Ela abrirá automaticamente amanhã ou você pode reabri-la manualmente a qualquer momento."
                descriptionAfter={
                    <span className="inline-flex items-center justify-center gap-1.5">
                        Você pode abrir sua loja definindo horários na aba
                        <FontAwesomeIcon icon={faClock} />
                        Horários.
                    </span>
                }
                confirmLabel="Fechar Loja"
                variant="danger"
                isLoading={isTogglingStore}
            />

            <PanelNavigation
                base={base}
                menuItems={menuItems}
                onNavigate={trackPanelTabOpen}
                collapsePath="/painel/assistente-ia"
                footerAction={{ label: "Ajuda", icon: faCircleQuestion, onClick: () => supportButtonRef.current?.open() }}
                status={storeStatusButton(true)}
                collapsedStatus={
                            <div
                                className="mt-2 flex h-[30px] items-center justify-center"
                                title={
                                    storeStatus === "manual"
                                        ? "Fechada manualmente"
                                        : storeStatus === "open"
                                          ? "Loja aberta"
                                          : "Loja fechada"
                                }
                            >
                                <div
                                    className={`relative h-3 w-3 rounded-full ${
                                        storeStatus === "manual"
                                            ? "bg-red-500"
                                            : storeStatus === "open"
                                              ? "bg-green-500"
                                              : "bg-gray-400"
                                    }`}
                                >
                                    {storeStatus === "open" && (
                                        <div className="absolute inset-0 animate-[pulseHalo_2s_infinite] rounded-full bg-green-500" />
                                    )}
                                </div>
                            </div>
                }
                headerAction={
                    <button
                        type="button"
                        onClick={() =>
                            isStoreClosed
                                ? void handleStoreToggle("open")
                                : setShowCloseModal(true)
                        }
                        disabled={isTogglingStore}
                        title={
                            storeStatus === "manual"
                                ? "Fechada manualmente"
                                : storeStatus === "open"
                                  ? "Loja aberta"
                                  : "Loja fechada"
                        }
                        className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium ${
                            storeStatus === "manual"
                                ? "border-red-200 bg-red-50 text-red-600"
                                : storeStatus === "open"
                                  ? "border-green-200 bg-green-50 text-green-700"
                                  : "border-gray-200 bg-gray-50 text-gray-600"
                        }`}
                    >
                        <span
                            className={`h-2.5 w-2.5 rounded-full ${
                                storeStatus === "manual"
                                    ? "bg-red-500"
                                    : storeStatus === "open"
                                      ? "bg-green-500"
                                      : "bg-gray-400"
                            }`}
                        />
                        {storeStatus === "manual"
                            ? "Manual"
                            : storeStatus === "open"
                              ? "Aberta"
                              : "Fechada"}
                    </button>
                }
                overlay={
                    <SupportButton ref={supportButtonRef} showFloating={!pathname?.startsWith("/painel/ia-vendas")}
                        floatingClassName={pathname?.startsWith("/painel/assistente-ia") ? "hidden md:flex" : ""} />
                }
            >
                {children}
            </PanelNavigation>
        </OrderSoundProvider>
    );
}

