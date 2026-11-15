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
import PanelTabCard from "@/components/restaurant-owner/ia-vendas/PanelTabCard";
import { isManualOpeningActive, isStoreManuallyClosed } from "@/lib/menu/storeHoursOverride";
import Loader from "@/components/ui/Loader";
import { useSalesStore } from "@/lib/stores/restaurant-owner/iaVendasStore";
import SupportButton, {
    type SupportButtonRef,
} from "@/components/common/SupportButton";
import { OrderSoundProvider } from "@/components/restaurant-owner/OrderSoundProvider";
import OrderMilestonePlusPopup from "@/components/restaurant-owner/OrderMilestonePlusPopup";
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

    const [storeOverride, setStoreOverride] = useState<{ is_closed: string | null; manual_open_until: string | null } | null>(null);
    const storeChangeVersion = useRef(0);
    const [availability, setAvailability] = useState<Availability | null>(null);
    const [scheduleNow, setScheduleNow] = useState(() => new Date());
    const [showStoreModal, setShowStoreModal] = useState(false);
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
        if (!targetRestaurantId) return;
        let active = true;
        const version = storeChangeVersion.current;
        void supabase.from("restaurants")
            .select("is_closed, manual_open_until, availability_json")
            .eq("id", targetRestaurantId)
            .single()
            .then(({ data, error }) => {
                if (!active || error || !data) return;
                setAvailability((data.availability_json as Availability | null) ?? null);
                if (version === storeChangeVersion.current) setStoreOverride(data);
            });
        return () => { active = false; };
    }, [targetRestaurantId, pathname]);

    useEffect(() => {
        const update = () => setScheduleNow(new Date());
        update();
        const interval = window.setInterval(update, 30_000);
        const expiresIn = Date.parse(storeOverride?.manual_open_until ?? "") - Date.now();
        const expiryTimer = expiresIn > 0 ? window.setTimeout(update, expiresIn) : undefined;
        window.addEventListener("focus", update);

        return () => {
            window.clearInterval(interval);
            if (expiryTimer !== undefined) window.clearTimeout(expiryTimer);
            window.removeEventListener("focus", update);
        };
    }, [storeOverride?.manual_open_until]);

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
            capturePosthogLightweight("panel_dashboard_viewed", session.user.id);
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

    const handleStoreToggle = async (action: "open" | "close" | "resume") => {
        if (!targetRestaurantId || isTogglingStore) return;

        storeChangeVersion.current += 1;
        setIsTogglingStore(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("Sessão expirada");
            const response = await fetch(`/api/restaurants/${targetRestaurantId}/store-hours-override`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
                body: JSON.stringify({ action }),
            });
            if (!response.ok) throw new Error("Falha ao atualizar");

            const updatedOverride = await response.json();
            storeChangeVersion.current += 1;
            setStoreOverride(updatedOverride);
            setScheduleNow(new Date());
            setShowStoreModal(false);
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
        { label: "iMenu Plus", icon: faCrown, href: `${base}/planos`, isNew: true },
        {
            label: "Configurações",
            icon: faGear,
            href: `${base}/configuracoes`,
        },
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

    const manuallyOpen = isManualOpeningActive(storeOverride?.manual_open_until, scheduleNow);
    const storeStatus = manuallyOpen ? "open"
        : isStoreManuallyClosed(storeOverride?.is_closed, scheduleNow) ? "manual"
        : isStoreOpenBySchedule(availability, scheduleNow) ? "open" : "scheduled-closed";
    const hasManualClosure = storeStatus === "manual";
    const canResumeSchedule = manuallyOpen || hasManualClosure;
    const storeStatusLabel = manuallyOpen ? "Aberta manualmente"
        : storeStatus === "manual" ? "Fechada manualmente"
        : storeStatus === "open" ? "Loja aberta" : "Loja fechada";

    const storeStatusButton = (fullWidth: boolean) => (
        <button
            type="button"
            onClick={() => setShowStoreModal(true)}
            disabled={isTogglingStore}
            className={`panel-store-status flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                fullWidth ? "w-full whitespace-normal" : "whitespace-nowrap"
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
            {storeStatusLabel}
        </button>
    );


    return (
        <OrderSoundProvider>
            <OrderMilestonePlusPopup />
            <ConfirmModal
                open={showStoreModal}
                onClose={() => { if (!isTogglingStore) setShowStoreModal(false); }}
                onConfirm={() => void handleStoreToggle(hasManualClosure ? "open" : "close")}
                title="Horário da loja hoje"
                description={
                    <>
                        {manuallyOpen
                            ? "Sua loja está aberta manualmente até 23h59."
                            : "Abra ou feche a loja temporariamente. A abertura manual vale até 23h59."}
                        <span className="mt-3 block [&_a]:![font-size:inherit]">
                            Você pode abrir sua loja definindo horários <span className="whitespace-nowrap">na aba <PanelTabCard tab="horarios" inline /></span>
                        </span>
                    </>
                }
                confirmLabel={hasManualClosure ? "Abrir loja hoje" : "Fechar loja hoje"}
                variant="neutral"
                confirmTone={hasManualClosure ? "success" : "danger"}
                inlineActions
                extraAction={canResumeSchedule
                    ? { label: "Voltar aos horários cadastrados", onClick: () => void handleStoreToggle("resume") }
                    : { label: "Abrir loja hoje", onClick: () => void handleStoreToggle("open"), tone: "success" }}
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
                                title={storeStatusLabel}
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
                        onClick={() => setShowStoreModal(true)}
                        disabled={isTogglingStore}
                        title={storeStatusLabel}
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
                        {manuallyOpen ? storeStatusLabel : storeStatus === "manual"
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


