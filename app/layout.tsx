// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import "@/lib/fontawesome";

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
        <body className="min-h-screen bg-white text-text">
        {children}
        </body>
        </html>
    );
}
