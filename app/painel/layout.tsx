"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import ApplicationInstallPrompt from "@/components/restaurant-owner/aplicativo/ApplicationInstallPrompt";
import PanelLayoutBase from "./PanelLayoutBase";
import PanelAppearance from "@/components/ui/PanelAppearance";
import "./essencial.css";

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

export default function PainelLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

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
        const clearPendingSidebarLink = () => {
            document
                .querySelectorAll<HTMLElement>(
                    '.panel-nav-link[data-pending-active="true"]'
                )
                .forEach((link) => link.removeAttribute("data-pending-active"));
        };

        clearPendingSidebarLink();

        const handleSidebarNavigation = (event: MouseEvent) => {
            if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
            ) {
                return;
            }

            const link =
                event.target instanceof Element
                    ? event.target.closest<HTMLAnchorElement>(
                          "a.panel-nav-link[href]"
                      )
                    : null;
            if (!link) return;

            clearPendingSidebarLink();
            link.setAttribute("data-pending-active", "true");
        };

        document.addEventListener("click", handleSidebarNavigation, true);
        return () => {
            document.removeEventListener("click", handleSidebarNavigation, true);
        };
    }, [pathname]);

    return (
        <PanelAppearance>
            <style jsx global>{`
                .panel-essencial .panel-nav-link:active,
                .panel-essencial .panel-nav-link[data-pending-active="true"] {
                    background: var(--panel-tint);
                    color: var(--panel-accent-text);
                }

                .panel-essencial .panel-nav-link:active .panel-icon,
                .panel-essencial .panel-nav-link[data-pending-active="true"] .panel-icon {
                    color: var(--panel-accent-text);
                }

                .panel-essencial .panel-nav-link:active,
                .panel-essencial .panel-nav-link:active .panel-icon,
                .panel-essencial .panel-nav-link:active > span,
                .panel-essencial .panel-nav-link[data-pending-active="true"],
                .panel-essencial .panel-nav-link[data-pending-active="true"] .panel-icon,
                .panel-essencial .panel-nav-link[data-pending-active="true"] > span {
                    transition-duration: 0ms !important;
                }

                @media (min-width: 768px) {
                    .panel-essencial .panel-sidebar .panel-nav-link:is([aria-current="page"], [data-pending-active="true"]) {
                        border-left: 3px solid var(--panel-brand);
                        padding-left: 11px;
                    }
                }
            `}</style>
            <PanelLayoutBase>{children}</PanelLayoutBase>
            <ApplicationInstallPrompt />
        </PanelAppearance>
    );
}
