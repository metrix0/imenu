"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/Footer";

export default function ConditionalFooter() {
    const pathname = usePathname();

    // Se a rota começar com /restaurante, NÃO mostrar Footer
    const hideFooter = pathname.startsWith("/restaurante");

    if (hideFooter) return null;

    return <Footer />;
}
