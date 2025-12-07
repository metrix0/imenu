import type { Metadata } from "next";
import "./globals.css";
import "@/lib/fontawesome";
import SupportButton from "@/components/common/SupportButton";
import Footer from "@/components/common/Footer";
import PosthogProvider from "@/components/common/PosthogProvider";

export const metadata: Metadata = {
    title: "iMenu - Cardápio Digital",
    description: "Interactive digital menu web app",
    icons: {
        icon: "/icons/favicon.png",
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR">
            <body
                className="min-h-screen bg-white text-gray-900"
                suppressHydrationWarning={true}
            >
                <PosthogProvider>
                    {children}
                </PosthogProvider>
            </body>
        </html>
    );
}