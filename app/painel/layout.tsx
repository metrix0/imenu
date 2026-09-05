"use client";

import ApplicationInstallPrompt from "@/components/restaurant-owner/aplicativo/ApplicationInstallPrompt";
import PanelLayoutBase from "./PanelLayoutBase";

export default function PainelLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <PanelLayoutBase>{children}</PanelLayoutBase>
            <ApplicationInstallPrompt />
        </>
    );
}
