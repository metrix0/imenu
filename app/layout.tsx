import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "@/lib/utils/fontawesome";
import PosthogProvider from "@/components/common/PosthogProvider";

export async function generateMetadata(): Promise<Metadata> {
    const h = await headers();
    const host = h.get("host");

    const baseUrl = host
        ? `https://${host}`
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

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR">
            <body
                className="min-h-screen bg-white text-gray-900"
                suppressHydrationWarning
            >
                <PosthogProvider>{children}</PosthogProvider>
            </body>
        </html>
    );
}
