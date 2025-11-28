"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useParams, usePathname } from "next/navigation";
import SupportButton from "@/components/SupportButton";
import {
    faBox,
    faMoneyBillWave,
    faUtensils,
    faTruck,
    faClock,
    faStore,
    faGear,
    faCircleQuestion,
    faChevronLeft,
    faChevronRight,
    IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@supabase/supabase-js";

// ✅ Strong type for menu items
type MenuItem =
    | { type: "divider" }
    | { label: string; icon: IconDefinition; href: string; type?: undefined };

export default function PainelLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // obter params no client via hook (useParams retorna objeto já resolvido)
    const params = useParams();
    const pathname = usePathname();
    const restauranteId = Array.isArray(params?.restauranteId) ? params.restauranteId[0] : params?.restauranteId ?? "";
    const base = `/painel/${restauranteId}`;
    const [expanded, setExpanded] = useState(true);

    // menuId do cardápio único do restaurante (fetch no client)
    const [menuId, setMenuId] = useState<string | null>(null);
    
    useEffect(() => {
        if (!restauranteId) return;
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        (async () => {
            try {
                const { data, error } = await supabase
                    .from("menu")
                    .select("id")
                    .eq("restaurant_id", restauranteId)
                    .limit(1)
                    .maybeSingle();
                if (!error && data?.id) setMenuId(data.id);
            } catch (err) {
                console.error("Erro ao obter menuId no layout:", err);
            }
        })();
    }, [restauranteId]);

    const cardapioHref = menuId ? `${base}/cardapio/${menuId}` : `${base}/cardapio`;
    const configuracoesHref = `${base}/configuracoes`;
    const menuItems: MenuItem[] = [
        { label: "Pedidos", icon: faBox, href: `${base}/pedidos` },
        { label: "Financeiro", icon: faMoneyBillWave, href: `${base}/financeiro` },
        { type: "divider" },
        { label: "Cardápio", icon: faUtensils, href: cardapioHref },
        { label: "Taxa e Tempo", icon: faTruck, href: `${base}/tempo-e-taxa` },
        { label: "Disponibilidade", icon: faClock, href: `${base}/disponibilidade` },
        { label: "Loja", icon: faStore, href: `${base}/loja` },
        { type: "divider" },
        { label: "Configurações", icon: faGear, href: configuracoesHref },
        { label: "Ajuda", icon: faCircleQuestion, href: `${base}/ajuda` },
    ];

    return (
        <div className="flex min-h-screen bg-gray-50 relative">
            {/* Dica Opcional: Se você REALMENTE não quer o footer global aparecendo no painel,
               você pode forçar ele a sumir via CSS aqui, caso ele tenha uma classe específica,
               mas a solução abaixo ajusta o layout visualmente.
            */}
            <SupportButton />
            
            {/* === SIDEBAR === */}
            {/* MUDANÇAS: 
                1. Trocado 'fixed' por 'sticky'.
                2. Adicionado 'top-0' e 'h-screen'.
                3. Removemos a necessidade de margens no <main>.
                4. 'z-20' garante que fique acima de elementos padrão do conteúdo.
            */}
            <aside
                className={`sticky top-0 h-screen flex flex-col border-r border-gray-200 bg-white transition-all duration-300 z-20 flex-shrink-0 ${
                    expanded ? "w-60" : "w-20"
                }`}
            >
                {/* Toggle Button */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="cursor-pointer absolute -right-4 top-20 z-30 flex h-7 w-7 items-center justify-center rounded-full bg-white border-1 border-gray-200 shadow hover:bg-gray-50"
                >
                    <FontAwesomeIcon
                        icon={expanded ? faChevronLeft : faChevronRight}
                        className="text-brand"
                    />
                </button>

                {/* === LOGO === */}
                <div className="flex items-center justify-center mt-4 mb-2 h-[70px] relative flex-shrink-0">
                    <div
                        className={`transition-all duration-300 flex items-center justify-center ${
                            expanded ? "scale-100 opacity-100" : "scale-0 opacity-0 absolute"
                        }`}
                    >
                        <Image
                            src="/logo-full.png"
                            alt="Logo"
                            width={120}
                            height={40}
                            className="transition-all duration-300 object-contain"
                        />
                    </div>

                    <div
                        className={`transition-all duration-300 flex items-center justify-center absolute ${
                            expanded ? "scale-0 opacity-0" : "scale-100 opacity-100"
                        }`}
                    >
                        <Image
                            src="/logo-icon_.png"
                            alt="Logo"
                            width={32}
                            height={32}
                            className="transition-all duration-300 object-contain"
                        />
                    </div>
                </div>

                {/* === MENU === */}
                <nav className="flex-1 flex flex-col overflow-y-auto py-6 space-y-1 custom-scrollbar">
                    {menuItems.map((item, idx) =>
                        item.type === "divider" ? (
                            <hr key={idx} className="my-2 border-gray-200 mx-4" />
                        ) : (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group flex items-center ${expanded ? "justify-start gap-3 px-5" : "justify-center px-0"} py-3 cursor-pointer transition-all duration-200 ${
                                    (pathname ?? "").startsWith(item.href)
                                        ? "border-l-4 border-brand bg-brand/10 text-brand font-semibold"
                                        : "text-gray-700 hover:bg-gray-100"
                                }`}
                                title={!expanded ? item.label : undefined}
                            >
                                <div className="flex items-center justify-center w-6 h-6 flex-shrink-0">
                                    <FontAwesomeIcon
                                        icon={item.icon}
                                        className={`text-lg transition-colors ${
                                            (pathname ?? "").startsWith(item.href) ? "text-brand" : "text-gray-500 group-hover:text-gray-800"
                                        }`}
                                    />
                                </div>

                                {expanded && <span className="whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span>}
                            </Link>
                        )
                    )}
                </nav>
            </aside>

            {/* === MAIN CONTENT === */}
            {/* MUDANÇAS:
                1. Removemos 'ml-60' / 'ml-20'. Como o layout agora é Flex, o main se adapta ao espaço restante automaticamente.
                2. Adicionado 'min-w-0' para evitar que tabelas grandes quebrem o flexbox.
            */}
            <main className="flex-1 p-8 min-w-0">
                {children}
            </main>
        </div>
    );
}