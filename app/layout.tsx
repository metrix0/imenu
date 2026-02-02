import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "@/lib/utils/fontawesome";
import SupportButton from "@/components/common/SupportButton";
import Footer from "@/components/common/Footer";
import PosthogProvider from "@/components/common/PosthogProvider";
import Script from "next/script";
import * as Sentry from "@sentry/nextjs";

Sentry.setTag("app", "imenu");

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
        icons: {
            icon: "/icons/favicon.ico",
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
        <Script id="ms-clarity" strategy="afterInteractive">
            {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "uk4ichh2nj");
          `}
        </Script>

        <PosthogProvider>{children}</PosthogProvider>
        </body>
        </html>
    );
}
