import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "@/lib/utils/fontawesome";
import PosthogProvider from "@/components/common/PosthogProvider";
import Script from "next/script";

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
            apple: "/logos/LogoMark_Brand.png",
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
