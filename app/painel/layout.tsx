"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { useParams, usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBars,
    faBox,
    faChair,
    faChartLine,
    faChevronLeft,
    faChevronRight,
    faCircleQuestion,
    faClock,
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
    faStore,
    faTimes,
    faTruck,
    faUtensils,
    type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

import ConfirmModal from "@/components/ui/ConfirmModal";
import Loader from "@/components/ui/Loader";
import SupportButton, {
    type SupportButtonRef,
} from "@/components/common/SupportButton";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import "./mobile.css";

type MenuItem =
    | { type: "divider" }
    | {
          label: string;
          icon: IconDefinition;
          href: string;
          type?: undefined;
      };

type ScreenWakeLockSentinel = {
    release: () => Promise<void>;
    addEventListener: (
        type: "release",
        listener: () => void,
        options?: { once?: boolean }
    ) => void;
};

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
    const { restaurantId } = useCreationStore();
    const supportButtonRef = useRef<SupportButtonRef>(null);
    const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

    const [expanded, setExpanded] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isStoreClosed, setIsStoreClosed] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [isTogglingStore, setIsTogglingStore] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [isPasswordRecoveryFlow, setIsPasswordRecoveryFlow] = useState(false);

    const base = "/painel";
    const targetRestaurantId = restaurantId || getParamRestaurantId(params);

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
                    .select("is_closed")
                    .eq("id", targetRestaurantId)
                    .single();

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
    }, [targetRestaurantId]);

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
        };

        void checkAuth();
    }, [pathname, router]);

    useEffect(() => {
        setMobileMenuOpen(false);
    }, [pathname]);

    useEffect(() => {
        const handleTouchStart = (event: TouchEvent) => {
            if (!window.matchMedia("(max-width: 767px)").matches) {
                swipeStartRef.current = null;
                return;
            }

            const touch = event.touches[0];
            swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
        };

        const handleTouchEnd = (event: TouchEvent) => {
            const start = swipeStartRef.current;
            swipeStartRef.current = null;
            if (!start) return;

            const touch = event.changedTouches[0];
            const horizontalDistance = touch.clientX - start.x;
            const verticalDistance = Math.abs(touch.clientY - start.y);

            if (
                !mobileMenuOpen &&
                horizontalDistance >= 70 &&
                verticalDistance < 50
            ) {
                setMobileMenuOpen(true);
            }

            if (
                mobileMenuOpen &&
                horizontalDistance <= -70 &&
                verticalDistance < 50
            ) {
                setMobileMenuOpen(false);
            }
        };

        document.addEventListener("touchstart", handleTouchStart, {
            passive: true,
        });
        document.addEventListener("touchend", handleTouchEnd, {
            passive: true,
        });

        return () => {
            document.removeEventListener("touchstart", handleTouchStart);
            document.removeEventListener("touchend", handleTouchEnd);
        };
    }, [mobileMenuOpen]);

    useEffect(() => {
        if (!mobileMenuOpen) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [mobileMenuOpen]);

    const toggleSidebar = () => {
        setExpanded((current) => !current);
    };

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

    const menuItems: MenuItem[] = [
        { label: "Pedidos", icon: faHome, href: `${base}/` },
        { label: "Histórico", icon: faBox, href: `${base}/pedidos` },
        { label: "Mesas", icon: faChair, href: `${base}/mesas` },
        {
            label: "Financeiro",
            icon: faMoneyBillWave,
            href: `${base}/financeiro`,
        },
        {
            label: "Analytics",
            icon: faChartLine,
            href: `${base}/analytics`,
        },
        { label: "Cardápio", icon: faUtensils, href: cardapioHref },
        { type: "divider" },
        { label: "Promoções", icon: faPercent, href: `${base}/promocoes` },
        { label: "Fidelidade", icon: faGift, href: `${base}/fidelidade` },
        {
            label: "Taxa e Tempo",
            icon: faTruck,
            href: `${base}/tempo-e-taxa`,
        },
        {
            label: "Horários",
            icon: faClock,
            href: `${base}/disponibilidade`,
        },
        { label: "Loja", icon: faStore, href: `${base}/loja` },
        { type: "divider" },
        { label: "Impressora", icon: faPrint, href: `${base}/impressora` },
        {
            label: "Integrações",
            icon: faPuzzlePiece,
            href: `${base}/integracoes`,
        },
        {
            label: "Aplicativo",
            icon: faMobileScreenButton,
            href: `${base}/aplicativo`,
        },
        {
            label: "Configurações",
            icon: faGear,
            href: `${base}/configuracoes`,
        },
    ];

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

    const isItemActive = (item: Exclude<MenuItem, { type: "divider" }>) => {
        const isHome = item.href === `${base}/`;
        return isHome
            ? pathname === base || pathname === `${base}/`
            : pathname?.startsWith(item.href);
    };

    const storeStatusButton = (fullWidth: boolean) => (
        <button
            type="button"
            onClick={() =>
                isStoreClosed
                    ? void handleStoreToggle("open")
                    : setShowCloseModal(true)
            }
            disabled={isTogglingStore}
            className={`flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                fullWidth ? "w-full" : ""
            } ${
                isStoreClosed
                    ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                    : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
            }`}
        >
            <FontAwesomeIcon icon={isStoreClosed ? faDoorOpen : faPowerOff} />
            {isStoreClosed ? "Abrir Loja" : "Loja Aberta"}
        </button>
    );

    return (
        <>
            <Script id="ms-clarity-panel" strategy="afterInteractive">
                {`
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "uk4ichh2nj");
              `}
            </Script>

            <ConfirmModal
                open={showCloseModal}
                onClose={() => setShowCloseModal(false)}
                onConfirm={() => void handleStoreToggle("close")}
                title="Fechar Loja Hoje?"
                description="Isso fechará a loja temporariamente. Ela abrirá automaticamente amanhã ou você pode reabri-la manualmente a qualquer momento."
                confirmLabel="Fechar Loja"
                variant="danger"
                isLoading={isTogglingStore}
            />

            <div className="min-h-screen bg-gray-50 md:flex">
                <SupportButton ref={supportButtonRef} />

                <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileMenuOpen(true)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100"
                        aria-label="Abrir menu"
                    >
                        <FontAwesomeIcon icon={faBars} className="text-xl" />
                    </button>

                    <Link href="/painel" aria-label="Ir para o painel">
                        <Image
                            src="/logos/CombinationMarkLogo_Brand.png"
                            alt="Logo"
                            width={104}
                            height={35}
                        />
                    </Link>

                    <button
                        type="button"
                        onClick={() =>
                            isStoreClosed
                                ? void handleStoreToggle("open")
                                : setShowCloseModal(true)
                        }
                        disabled={isTogglingStore}
                        className={`flex h-10 items-center gap-2 rounded-lg border px-3 text-xs font-medium ${
                            isStoreClosed
                                ? "border-red-200 bg-red-50 text-red-600"
                                : "border-green-200 bg-green-50 text-green-700"
                        }`}
                    >
                        <span
                            className={`h-2.5 w-2.5 rounded-full ${
                                isStoreClosed ? "bg-red-500" : "bg-green-500"
                            }`}
                        />
                        {isStoreClosed ? "Fechada" : "Aberta"}
                    </button>
                </header>

                <div
                    className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 md:hidden ${
                        mobileMenuOpen
                            ? "opacity-100"
                            : "pointer-events-none opacity-0"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-hidden="true"
                />

                <aside
                    className={`fixed inset-y-0 left-0 z-50 flex w-[min(84vw,20rem)] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-200 md:hidden ${
                        mobileMenuOpen
                            ? "translate-x-0"
                            : "-translate-x-full"
                    }`}
                    aria-hidden={!mobileMenuOpen}
                >
                    <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
                        <Link href="/painel" aria-label="Ir para o painel">
                            <Image
                                src="/logos/CombinationMarkLogo_Brand.png"
                                alt="Logo"
                                width={112}
                                height={38}
                            />
                        </Link>
                        <button
                            type="button"
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100"
                            aria-label="Fechar menu"
                        >
                            <FontAwesomeIcon icon={faTimes} className="text-xl" />
                        </button>
                    </div>

                    <div className="px-4 py-4">{storeStatusButton(true)}</div>

                    <nav className="flex-1 overflow-y-auto px-2 pb-4">
                        {menuItems.map((item, index) => {
                            if (item.type === "divider") {
                                return (
                                    <hr
                                        key={`mobile-divider-${index}`}
                                        className="my-2 border-gray-100"
                                    />
                                );
                            }

                            const active = isItemActive(item);
                            return (
                                <Link
                                    key={`mobile-${item.href}`}
                                    href={item.href}
                                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                                        active
                                            ? "bg-brand/10 font-medium text-brand"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                                >
                                    <span className="flex h-6 w-6 items-center justify-center">
                                        <FontAwesomeIcon
                                            icon={item.icon}
                                            className={
                                                active
                                                    ? "text-brand"
                                                    : "text-gray-400"
                                            }
                                        />
                                    </span>
                                    {item.label}
                                </Link>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => {
                                setMobileMenuOpen(false);
                                supportButtonRef.current?.open();
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        >
                            <span className="flex h-6 w-6 items-center justify-center">
                                <FontAwesomeIcon
                                    icon={faCircleQuestion}
                                    className="text-gray-400"
                                />
                            </span>
                            Ajuda
                        </button>
                    </nav>
                </aside>

                <aside
                    className={`fixed z-20 hidden h-full flex-col border-r border-gray-200 bg-white transition-all duration-300 md:flex ${
                        expanded ? "w-60 2xl:w-70" : "w-[4.5rem] 2xl:w-20"
                    }`}
                >
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        aria-label={
                            expanded
                                ? "Recolher menu lateral"
                                : "Expandir menu lateral"
                        }
                        aria-expanded={expanded}
                        className="text-brand hover:text-brand/66 absolute -right-4 top-20 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-sm shadow transition-colors hover:bg-gray-50 2xl:-right-5 2xl:h-10 2xl:w-10 2xl:text-base"
                    >
                        <FontAwesomeIcon
                            icon={expanded ? faChevronLeft : faChevronRight}
                        />
                    </button>

                    <Link
                        href="/painel"
                        aria-label="Ir para o painel"
                        className="relative mt-4 flex h-[70px] items-center justify-center 2xl:mb-2 2xl:h-[90px]"
                    >
                        <div
                            className={`flex items-center justify-center transition-all duration-300 ${
                                expanded
                                    ? "scale-100 opacity-100"
                                    : "absolute scale-0 opacity-0"
                            }`}
                        >
                            <Image
                                src="/logos/CombinationMarkLogo_Brand.png"
                                alt="Logo"
                                width={120}
                                height={40}
                                className="2xl:w-35"
                            />
                        </div>
                        <div
                            className={`absolute left-0 flex w-[4.5rem] items-center justify-center transition-all duration-300 2xl:w-20 ${
                                expanded
                                    ? "scale-0 opacity-0"
                                    : "scale-100 opacity-100"
                            }`}
                        >
                            <Image
                                src="/logos/LogoMark_Brand.png"
                                alt="Logo"
                                width={32}
                                height={32}
                                className="2xl:w-10"
                            />
                        </div>
                    </Link>

                    <div
                        className={`mt-2 pb-1 transition-all duration-300 2xl:mt-8 ${
                            expanded
                                ? "w-full px-4"
                                : "w-[4.5rem] self-start 2xl:w-20"
                        }`}
                    >
                        {expanded ? (
                            storeStatusButton(true)
                        ) : (
                            <div
                                className="mt-2 flex h-[30px] items-center justify-center"
                                title={
                                    isStoreClosed ? "Loja Fechada" : "Loja Aberta"
                                }
                            >
                                <div
                                    className={`relative h-3 w-3 rounded-full ${
                                        isStoreClosed ? "bg-red-500" : "bg-green-500"
                                    }`}
                                >
                                    {!isStoreClosed && (
                                        <div className="absolute inset-0 animate-[pulseHalo_2s_infinite] rounded-full bg-green-500" />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <nav className="thin-scrollbar flex flex-1 flex-col space-y-1 overflow-y-auto py-4">
                        {menuItems.map((item, index) => {
                            if (item.type === "divider") {
                                return (
                                    <hr
                                        key={`desktop-divider-${index}`}
                                        className="mx-4 my-3 border-gray-100"
                                    />
                                );
                            }

                            const active = isItemActive(item);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    title={!expanded ? item.label : ""}
                                    className={`group relative flex cursor-pointer items-center py-3 transition-colors duration-200 ${
                                        expanded
                                            ? "w-full justify-start gap-2 pl-6 pr-5 2xl:gap-4 2xl:pl-4"
                                            : "w-[4.5rem] self-start justify-center px-0 2xl:w-20"
                                    } ${
                                        active
                                            ? "border-r-4 border-brand bg-brand/10 font-medium text-brand md:border-l-4 md:border-r-0"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                                >
                                    <div className="flex h-6 w-6 items-center justify-center 2xl:h-10 2xl:w-12">
                                        <FontAwesomeIcon
                                            icon={item.icon}
                                            className={`text-lg transition-colors 2xl:text-2xl ${
                                                active
                                                    ? "text-brand"
                                                    : "text-gray-400 group-hover:text-gray-600"
                                            }`}
                                        />
                                    </div>
                                    <span
                                        className={`overflow-hidden whitespace-nowrap text-sm transition-all duration-300 2xl:text-lg ${
                                            expanded
                                                ? "ml-0 w-auto opacity-100"
                                                : "ml-0 w-0 opacity-0"
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}

                        <button
                            type="button"
                            onClick={() => supportButtonRef.current?.open()}
                            title={!expanded ? "Ajuda" : ""}
                            className={`group relative flex cursor-pointer items-center py-3 text-gray-600 transition-colors duration-200 hover:bg-gray-50 hover:text-gray-900 ${
                                expanded
                                    ? "w-full justify-start gap-2 pl-6 pr-5 2xl:gap-4 2xl:pl-4"
                                    : "w-[4.5rem] self-start justify-center px-0 2xl:w-20"
                            }`}
                        >
                            <div className="flex h-6 w-6 items-center justify-center 2xl:h-10 2xl:w-12">
                                <FontAwesomeIcon
                                    icon={faCircleQuestion}
                                    className="text-lg text-gray-400 transition-colors group-hover:text-gray-600 2xl:text-2xl"
                                />
                            </div>
                            <span
                                className={`overflow-hidden whitespace-nowrap text-sm transition-all duration-300 2xl:text-lg ${
                                    expanded
                                        ? "w-auto opacity-100"
                                        : "w-0 opacity-0"
                                }`}
                            >
                                Ajuda
                            </span>
                        </button>
                    </nav>
                </aside>

                <main
                    data-panel-path={pathname || base}
                    className={`panel-mobile-content min-h-screen min-w-0 bg-gray-50 transition-all duration-300 md:flex-1 md:p-8 ${
                        expanded
                            ? "md:ml-60 2xl:ml-70"
                            : "md:ml-[4.5rem] 2xl:ml-20"
                    }`}
                >
                    <div className="w-full min-w-0 md:mx-auto md:max-w-7xl">
                        {children}
                    </div>
                </main>
            </div>
        </>
    );
}
