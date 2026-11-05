"use client";

import AddonExpiryPopup from "@/components/restaurant-owner/AddonExpiryPopup";
import ApplicationInstallPrompt from "@/components/restaurant-owner/aplicativo/ApplicationInstallPrompt";
import PixOnlineTemporaryNotice from "@/components/restaurant-owner/PixOnlineTemporaryNotice";
import PanelLayoutBase from "./PanelLayoutBase";
import PanelAppearance from "@/components/ui/PanelAppearance";
import "./essencial.css";

export default function PainelLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    return (
        <PanelAppearance>
            <PanelLayoutBase>{children}</PanelLayoutBase>
            <PixOnlineTemporaryNotice />
            <AddonExpiryPopup />
            <ApplicationInstallPrompt />
        </PanelAppearance>
    );
}
