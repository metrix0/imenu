"use client";

import { useEffect } from "react";

import ApplicationInstallPrompt from "@/components/restaurant-owner/aplicativo/ApplicationInstallPrompt";
import PanelLayoutBase from "./PanelLayoutBase";

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

    return (
        <>
            <PanelLayoutBase>{children}</PanelLayoutBase>
            <ApplicationInstallPrompt />
        </>
    );
}
