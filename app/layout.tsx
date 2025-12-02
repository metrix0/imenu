import type { Metadata } from "next";
import "./globals.css";
import "@/lib/fontawesome";
import SupportButton from "@/components/SupportButton";
import Footer from "@/components/Footer";
import PosthogProvider from "@/components/PosthogProvider";

export const metadata: Metadata = {
    title: "Digital Menu",
    description: "Interactive digital menu web app",
    icons: {
        icon: "/favicon.png",
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