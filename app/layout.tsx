// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Digital Menu",
    description: "Interactive digital menu web app",
};

export default function RootLayout({
                                       children,
                                   }: {
    children: React.ReactNode;
}) {
    return (
        <html lang="pt-BR">
        <body className="min-h-screen bg-white text-gray-900">
        {children}
        </body>
        </html>
    );
}
