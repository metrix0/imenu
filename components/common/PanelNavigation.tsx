"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { faBars, faTimes, type IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Badge from "@/components/ui/Badge";
import { PageSaveStatusProvider } from "@/components/ui/SaveStatus";
import "@/app/painel/mobile.css";

export type PanelMenuItem =
    | { type: "divider" }
    | { label: string; icon: IconDefinition; href: string; isNew?: boolean; notification?: string; notificationTitle?: string; type?: undefined };

type FooterAction = { label: string; icon: IconDefinition; onClick: () => void; disabled?: boolean; error?: string };

function isInsideHorizontalScroller(target: EventTarget | null, boundary: HTMLElement) {
    let element = target instanceof Element ? target : null;

    while (element && element !== boundary) {
        if (element instanceof HTMLElement) {
            const overflowX = window.getComputedStyle(element).overflowX;
            const isHorizontalScroller =
                element.scrollWidth > element.clientWidth &&
                (overflowX === "auto" ||
                    overflowX === "scroll" ||
                    overflowX === "overlay");

            if (isHorizontalScroller) return true;
        }

        element = element.parentElement;
    }

    return false;
}

export default function PanelNavigation({ children, base, menuItems, onNavigate, status, collapsedStatus, headerAction, footerAction, overlay, collapsePath, contentAs = "main" }: {
    children: ReactNode;
    base: string;
    menuItems: PanelMenuItem[];
    onNavigate?: (item: Exclude<PanelMenuItem, { type: "divider" }>) => void;
    status?: ReactNode;
    collapsedStatus?: ReactNode;
    headerAction?: ReactNode;
    footerAction?: FooterAction;
    overlay?: ReactNode;
    collapsePath?: string;
    contentAs?: "main" | "div";
}) {
    const pathname = usePathname();
    const [expanded, setExpanded] = useState(true);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
    const menuButtonRef = useRef<HTMLButtonElement>(null);
    const Content = contentAs;
    const trackPanelTabOpen = (item: Exclude<PanelMenuItem, { type: "divider" }>) => onNavigate?.(item);
    const isItemActive = (item: Exclude<PanelMenuItem, { type: "divider" }>) =>
        item.href === base || item.href === `${base}/`
            ? pathname === base || pathname === `${base}/`
            : pathname?.startsWith(item.href);

    useEffect(() => {
        setMobileMenuOpen(false);
        if (collapsePath && pathname?.startsWith(collapsePath)) {
            setExpanded(false);
        }
    }, [pathname, collapsePath]);

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

    useEffect(() => {
        const content = document.querySelector<HTMLElement>(
            ".panel-mobile-content"
        );
        if (!content) return;

        const stopSidebarSwipe = (event: TouchEvent) => {
            if (isInsideHorizontalScroller(event.target, content)) {
                event.stopPropagation();
            }
        };

        content.addEventListener("touchstart", stopSidebarSwipe, {
            passive: true,
        });
        content.addEventListener("touchend", stopSidebarSwipe, {
            passive: true,
        });

        return () => {
            content.removeEventListener("touchstart", stopSidebarSwipe);
            content.removeEventListener("touchend", stopSidebarSwipe);
        };
    }, []);

    useEffect(() => {
        const media = window.matchMedia("(min-width: 768px)");
        const resize = () => { if (media.matches) setMobileMenuOpen(false); };
        media.addEventListener("change", resize);
        return () => media.removeEventListener("change", resize);
    }, []);

    useEffect(() => {
        if (!mobileMenuOpen) return;
        const escape = (event: KeyboardEvent) => {
            if (event.key === "Escape") { setMobileMenuOpen(false); menuButtonRef.current?.focus(); }
        };
        document.addEventListener("keydown", escape);
        return () => document.removeEventListener("keydown", escape);
    }, [mobileMenuOpen]);

    return (
            <div className="min-h-screen bg-gray-50 md:flex">
            <style jsx global>{`
                @media (min-width: 768px) {
                    .panel-essencial .panel-sidebar .panel-nav-link {
                        border-color: var(--panel-brand);
                    }
                    .panel-essencial .panel-sidebar .panel-nav-link[aria-current="page"] {
                        border-left: 3px solid var(--panel-brand);
                        padding-left: 11px;
                    }
                }
            `}</style>
                {overlay}

                <header className="panel-mobile-header sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 md:hidden">
                    <button
                        ref={menuButtonRef}
                        type="button"
                        aria-expanded={mobileMenuOpen}
                        onClick={() => setMobileMenuOpen(true)}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100"
                        aria-label="Abrir menu"
                    >
                        <FontAwesomeIcon icon={faBars} className="text-xl" />
                    </button>

                    <Link href={base} aria-label="Ir para o painel">
                        <Image
                            src="/logos/CombinationMarkLogo_Brand.png"
                            alt="Logo"
                            width={104}
                            height={35}
                        />
                    </Link>

                    {headerAction || <span className="h-10 w-10" aria-hidden="true" />}
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
                    role={mobileMenuOpen ? "dialog" : undefined}
                    aria-label="Menu de navegação"
                    aria-modal={mobileMenuOpen || undefined}
                    inert={!mobileMenuOpen}
                    aria-hidden={!mobileMenuOpen}
                >
                    <div className="flex h-16 items-center justify-between border-b border-gray-100 px-4">
                        <Link href={base} aria-label="Ir para o painel">
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

                    {status && <div className="px-4 py-4">{status}</div>}

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
                                    onClick={() => trackPanelTabOpen(item)}
                                    aria-current={active ? "page" : undefined}
                                    className={`panel-nav-link flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
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
                                    <span>{item.label}</span>
                                    {item.notification && (
                                        <Badge mode="pill" className="ml-auto">{item.notification}</Badge>
                                    )}
                                    {item.isNew && (
                                        <Badge mode="pill" className="ml-auto">Novo</Badge>
                                    )}
                                </Link>
                            );
                        })}

                        {footerAction && <>
                        <button
                            type="button"
                            disabled={footerAction.disabled}
                            onClick={() => {
                                setMobileMenuOpen(false);
                                footerAction.onClick();
                            }}
                            className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                        >
                            <span className="flex h-6 w-6 items-center justify-center">
                                <FontAwesomeIcon
                                    icon={footerAction.icon}
                                    className="text-gray-400"
                                />
                            </span>
                            {footerAction.label}
                        </button>
                        {footerAction.error && <p role="alert" className="px-4 text-xs text-red-700">{footerAction.error}</p>}
                        </>}
                    </nav>
                </aside>

                <aside
                    data-expanded={expanded}
                    className={`panel-sidebar fixed z-20 hidden h-full flex-col border-r border-gray-200 bg-white transition-[width] duration-300 md:flex ${
                        expanded ? "w-60 2xl:w-70" : "w-[4.5rem] 2xl:w-20"
                    }`}
                >
                    <div className="panel-sidebar-header">
                        <Link
                            href={base}
                            aria-label="Ir para o painel"
                            aria-hidden={!expanded}
                            tabIndex={expanded ? 0 : -1}
                            className={`panel-sidebar-logo origin-left overflow-hidden transition-[width,transform,opacity] duration-300 ${
                                expanded
                                    ? "w-[108px] scale-100 opacity-100"
                                    : "pointer-events-none w-0 scale-75 opacity-0"
                            }`}
                        >
                            <Image
                                src="/logos/CombinationMarkLogo_Brand.png"
                                alt="iMenu"
                                width={104}
                                height={40}
                            />
                        </Link>
                        <button type="button" onClick={toggleSidebar}
                            aria-label={expanded ? "Recolher menu lateral" : "Expandir menu lateral"}
                            aria-expanded={expanded} className="panel-sidebar-toggle cursor-pointer bg-white">
                            <Image
                                className={`panel-sidebar-mark transition-opacity duration-300 ${
                                    expanded ? "opacity-0" : "opacity-100"
                                }`}
                                src="/logos/LogoMark_Brand.png"
                                alt=""
                                width={32}
                                height={32}
                            />
                            {expanded ? <PanelLeftClose aria-hidden="true" strokeWidth={1.75} /> : <PanelLeftOpen aria-hidden="true" strokeWidth={1.75} />}
                        </button>
                    </div>

                    {status && (
                    <div
                        className={`panel-sidebar-status mt-1 pb-2 transition-[width,padding] duration-300 2xl:mt-6 ${
                            expanded
                                ? "w-full px-4"
                                : "w-[4.5rem] self-start 2xl:w-20"
                        }`}
                    >
                        {expanded ? status : collapsedStatus}
                    </div>
                    )}

                    <nav className="panel-sidebar-nav thin-scrollbar flex flex-1 flex-col overflow-y-auto">
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
                                    onClick={() => trackPanelTabOpen(item)}
                                    title={!expanded ? (item.notification ? (item.notificationTitle || item.label) : item.label) : ""}
                                    aria-current={active ? "page" : undefined}
                                    style={{ outlineColor: "#d93d00" }}
                                    className={`panel-nav-link group relative flex cursor-pointer items-center transition-colors duration-200 ${item.isNew && expanded ? "!gap-1.5" : ""}`}
                                >
                                    <div className="relative flex h-6 w-6 shrink-0 items-center justify-center 2xl:h-10 2xl:w-12">
                                        <FontAwesomeIcon
                                            icon={item.icon}
                                            className={`text-lg transition-colors 2xl:text-2xl ${
                                                active
                                                    ? "text-brand"
                                                    : "text-gray-400 group-hover:text-gray-600"
                                            }`}
                                        />
                                        {item.isNew && !expanded && (
                                            <span
                                                aria-label="Novo"
                                                className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-brand 2xl:bottom-1 2xl:right-1"
                                            />
                                        )}
                                        {item.notification && !expanded && (
                                            <span role="img" aria-label={item.notificationTitle || item.notification} className="absolute bottom-0 right-0 h-1.5 w-1.5 rounded-full bg-brand 2xl:bottom-1 2xl:right-1" />
                                        )}
                                    </div>
                                    <span
                                        className={`overflow-hidden whitespace-nowrap text-sm transition-[width,opacity] duration-300 2xl:text-lg ${
                                            expanded
                                                ? `ml-0 w-auto opacity-100 ${item.isNew ? "shrink-0" : ""}`
                                                : "ml-0 w-0 opacity-0"
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                    {item.isNew && expanded && (
                                        <Badge mode="pill" className="ml-auto">Novo</Badge>
                                    )}
                                    {item.notification && expanded && (
                                        <Badge mode="pill" className="ml-auto">{item.notification}</Badge>
                                    )}
                                </Link>
                            );
                        })}

                        {footerAction && <>
                        <button
                            type="button"
                            disabled={footerAction.disabled}
                            onClick={() => footerAction.onClick()}
                            title={!expanded ? footerAction.label : ""}
                            className="panel-nav-link group relative flex cursor-pointer items-center transition-colors duration-200"
                        >
                            <div className="flex h-6 w-6 shrink-0 items-center justify-center 2xl:h-10 2xl:w-12">
                                <FontAwesomeIcon
                                    icon={footerAction.icon}
                                    className="text-lg text-gray-400 transition-colors group-hover:text-gray-600 2xl:text-2xl"
                                />
                            </div>
                            <span
                                className={`overflow-hidden whitespace-nowrap text-sm transition-[width,opacity] duration-300 2xl:text-lg ${
                                    expanded
                                        ? "w-auto opacity-100"
                                        : "w-0 opacity-0"
                                }`}
                            >
                                {footerAction.label}
                            </span>
                        </button>
                        {footerAction.error && expanded && <p role="alert" className="px-4 text-xs text-red-700">{footerAction.error}</p>}
                        </>}
                    </nav>
                </aside>

                <Content
                    data-panel-path={pathname || base}
                    data-sidebar-expanded={expanded}
                    className={`panel-mobile-content relative min-h-screen min-w-0 bg-gray-50 transition-[margin-left] duration-300 md:flex-1 md:p-8 ${
                        expanded
                            ? "md:ml-60 2xl:ml-70"
                            : "md:ml-[4.5rem] 2xl:ml-20"
                    }`}
                >
                    <div className="w-full min-w-0 md:mx-auto md:max-w-7xl">
                        <PageSaveStatusProvider key={pathname}>{children}</PageSaveStatusProvider>
                    </div>
                </Content>
            </div>
    );
}
