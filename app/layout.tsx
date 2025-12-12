import type { Metadata } from "next";
import "./globals.css";
import "@/lib/fontawesome";
import SupportButton from "@/components/common/SupportButton";
import Footer from "@/components/common/Footer";
import PosthogProvider from "@/components/common/PosthogProvider";
import Script from "next/script";

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
                {/* Microsoft Clarity */}
                <Script id="ms-clarity" strategy="afterInteractive">
                    {`
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "uk4ichh2nj");
              `}
                </Script>
                <PosthogProvider>
                    {children}
                </PosthogProvider>
            </body>
        </html>
    );
}