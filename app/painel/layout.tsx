"use client";

import ApplicationInstallPrompt from "@/components/restaurant-owner/aplicativo/ApplicationInstallPrompt";
import PanelLayoutBase from "./PanelLayoutBase";

const stopSidebarSwipeForHorizontalScroll = (
    event: React.TouchEvent<HTMLDivElement>
) => {
    let element = event.target instanceof Element ? event.target : null;

    while (element && element !== event.currentTarget) {
        if (element instanceof HTMLElement) {
            const overflowX = window.getComputedStyle(element).overflowX;
            const isHorizontalScroller =
                element.scrollWidth > element.clientWidth &&
                (overflowX === "auto" ||
                    overflowX === "scroll" ||
                    overflowX === "overlay");

            if (isHorizontalScroller) {
                event.stopPropagation();
                return;
            }
        }

        element = element.parentElement;
    }
};

export default function PainelLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <PanelLayoutBase>
                <div
                    className="contents"
                    onTouchStart={stopSidebarSwipeForHorizontalScroll}
                    onTouchEnd={stopSidebarSwipeForHorizontalScroll}
                >
                    {children}
                </div>
            </PanelLayoutBase>
            <ApplicationInstallPrompt />
        </>
    );
}
