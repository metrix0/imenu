import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import PanelLayoutBase from "./PanelLayoutBase";

jest.mock("next/navigation", () => ({
    useParams: () => ({}),
    usePathname: () => "/painel",
    useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ href, children, ...props }: React.ComponentProps<"a">) =>
        <a href={href} {...props}>{children}</a>,
}));
jest.mock("next/image", () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}));
jest.mock("@/app/painel/mobile.css", () => ({}));
jest.mock("@/lib/database/supabaseClient", () => ({ supabase: { auth: {} } }));
jest.mock("@/lib/stores/restaurant-owner/creationStore", () => ({
    useCreationStore: (selector: (store: { restaurantId: string }) => unknown) =>
        selector({ restaurantId: "fixture" }),
}));
jest.mock("@/lib/stores/restaurant-owner/iaVendasStore", () => ({
    useSalesStore: (selector: (store: { refreshUsage: () => void; usageAccess: null }) => unknown) =>
        selector({ refreshUsage: jest.fn(), usageAccess: null }),
}));
jest.mock("@/components/common/SupportButton", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("@/components/restaurant-owner/OrderSoundProvider", () => ({
    OrderSoundProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
jest.mock("@/components/restaurant-owner/OrderMilestonePlusPopup", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("@/components/ui/ConfirmModal", () => ({
    __esModule: true,
    default: () => null,
}));
jest.mock("@/lib/push/client", () => ({
    ensureOwnerPushSubscription: jest.fn(),
}));
jest.mock("@/lib/api/instrumentation-client", () => ({
    capturePosthogLightweight: jest.fn(),
}));

test("iMenu Plus stays visible in both desktop and mobile panel sidebars", () => {
    const state = jest.spyOn(React, "useState");
    // SSR skips the auth effect. Start the layout in its authenticated state.
    for (const value of [false, null, new Date("2026-11-10T12:00:00Z"), false, false, false]) {
        state.mockImplementationOnce(() => [value, jest.fn()] as never);
    }

    let html = "";
    try {
        html = renderToStaticMarkup(<PanelLayoutBase><div>Dashboard</div></PanelLayoutBase>);
    } finally {
        state.mockRestore();
    }

    const sidebars = Array.from(html.matchAll(/<nav\b[^>]*>([\s\S]*?)<\/nav>/g), match => match[1]);
    expect(sidebars).toHaveLength(2); // Mobile and desktop use the same menu configuration.

    for (const sidebar of sidebars) {
        const plusLinks = Array.from(
            sidebar.matchAll(/<a\b[^>]*href="\/painel\/planos"[^>]*>([\s\S]*?)<\/a>/g),
            match => match[1],
        );
        expect(plusLinks).toHaveLength(1);
        expect(plusLinks[0]).toContain("iMenu Plus");
    }
});
