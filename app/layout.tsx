import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "@/lib/utils/fontawesome";
import PosthogProvider from "@/components/common/PosthogProvider";
import { AutoPopupProvider } from "@/components/common/AutoPopupProvider";
import RestaurantDirectoryProvider from "@/components/common/RestaurantDirectoryProvider";
import QrTablePaymentSuccess from "@/components/restaurant-owner/mesas/QrTablePaymentSuccess";
import { getRestaurantCityLinks } from "@/lib/seo/restaurantDirectory";

export async function generateMetadata(): Promise<Metadata> {
    const h = await headers();
    const host = h.get("host");

    const baseUrl = host
        ? "https://" + host
        : "https://imenuapp.com.br";

    return {
        title: "Cardápio Digital Gratuito para Restaurantes e Delivery | iMenu",
        description:
            "Crie seu cardápio digital gratuito para restaurantes e delivery. Receba pedidos online, sem taxas, sem mensalidades e sem pegadinhas.",
        metadataBase: new URL(baseUrl),
        manifest: "/manifest.webmanifest",
        appleWebApp: {
            capable: true,
            title: "iMenu",
            statusBarStyle: "default",
        },
        icons: {
            icon: "/icons/favicon.ico",
            apple: "/icons/appIcon.png",
        },
        alternates: {
            canonical: baseUrl,
        },
    };
}

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const restaurantCities = await getRestaurantCityLinks();

    return (
        <html lang="pt-BR">
            <body
                className="min-h-screen bg-white text-gray-900"
                suppressHydrationWarning
            >
                <AutoPopupProvider>
                    <QrTablePaymentSuccess />
                    <PosthogProvider>
                        <RestaurantDirectoryProvider cities={restaurantCities}>
                            {children}
                        </RestaurantDirectoryProvider>
                    </PosthogProvider>
                </AutoPopupProvider>
            </body>
        </html>
    );
}
