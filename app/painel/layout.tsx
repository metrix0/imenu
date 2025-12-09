"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useParams, usePathname } from "next/navigation";
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
    faHome,
} from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@supabase/supabase-js";

// Importa o componente refatorado
import SupportButton, { SupportButtonRef } from "@/components/common/SupportButton";

type MenuItem =
    | { type: "divider" }
    | { label: string; icon: IconDefinition; href: string; type?: undefined };

export default function PainelLayout({
                                         children,
                                     }: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const pathname = usePathname();
    const restauranteId = Array.isArray(params?.restauranteId) ? params.restauranteId[0] : params?.restauranteId ?? "";
    const base = `/painel`;
    const [expanded, setExpanded] = useState(false);
    const [menuId, setMenuId] = useState<string | null>(null);
    
    // Ref para controlar o botão de suporte
    const supportBtnRef = useRef<SupportButtonRef>(null);

    useEffect(() => {
        const fetchMenu = async () => {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            try {
                if (!restauranteId) return;
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
        };
        if (restauranteId) fetchMenu();
    }, [restauranteId]);

    const cardapioHref = menuId ? `${base}/cardapio/${menuId}` : `${base}/cardapio`;
    const configuracoesHref = `${base}/configuracoes`;
    
    const menuItems: MenuItem[] = [
        { label: "Home", icon: faHome, href: `${base}/` },
        { label: "Pedidos", icon: faBox, href: `${base}/pedidos` },
        { label: "Financeiro", icon: faMoneyBillWave, href: `${base}/financeiro` },
        { type: "divider" },
        { label: "Cardápio", icon: faUtensils, href: cardapioHref },
        { label: "Taxa e Tempo", icon: faTruck, href: `${base}/tempo-e-taxa` },
        { label: "Horários", icon: faClock, href: `${base}/disponibilidade` },
        { label: "Loja", icon: faStore, href: `${base}/loja` },
        { type: "divider" },
        { label: "Configurações", icon: faGear, href: configuracoesHref },
    ];

    return (
        <>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white text-black px-6 text-center overflow-hidden md:hidden">
                <p className="text-lg font-semibold leading-relaxed">
                    O painel ainda não pode ser utilizado em celulares. <br />
                    Use um computador ou notebook.
                </p>
            </div>

            <div className="hidden md:flex min-h-screen bg-gray-50">
                
                {/* Renderiza o botão flutuante e conecta a ref */}
                <SupportButton ref={supportBtnRef} />

                {/* === SIDEBAR === */}
                <aside
                    className={`fixed h-full flex flex-col border-r border-gray-200 bg-white transition-all duration-300 z-20 ${
                        expanded ? "w-60" : "w-[4.5rem]"
                    }`}
                >
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="cursor-pointer absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-gray-200 shadow hover:bg-gray-50 text-xs"
                    >
                        <FontAwesomeIcon
                            icon={expanded ? faChevronLeft : faChevronRight}
                            className="text-brand"
                        />
                    </button>

                    <div className="flex items-center justify-center mt-4 mb-2 h-[70px] relative">
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
                                className="transition-all duration-300"
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
                                className="transition-all duration-300"
                            />
                        </div>
                    </div>

                    {/* === MENU === */}
                    <nav className="flex-1 flex flex-col overflow-y-auto py-4 space-y-1">
                      
                        {menuItems.map((item, idx) => {
                            // 1. PRIMEIRO verificamos se é um divisor
                            if (item.type === "divider") {
                                return <hr key={`div-${idx}`} className="my-3 border-gray-100 mx-4" />;
                            }

                            // 2. AGORA o TypeScript sabe que "item" tem "href" e "icon"
                            const isHome = item.href === `${base}/`;
                            const isActive = isHome
                                ? pathname === base || pathname === `${base}/`
                                : pathname?.startsWith(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`group flex items-center relative py-3 cursor-pointer transition-all duration-200 ${
                                        expanded ? "justify-start px-5 gap-3" : "justify-center px-0"
                                    } ${
                                        isActive
                                            ? "bg-brand/10 text-brand font-medium border-r-4 border-brand md:border-r-0 md:border-l-4"
                                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                                    }`}
                                    title={!expanded ? item.label : ""}
                                >
                                    <div className="flex items-center justify-center w-6 h-6">
                                        <FontAwesomeIcon
                                            icon={item.icon}
                                            className={`text-lg transition-colors ${
                                                isActive
                                                    ? "text-brand"
                                                    : "text-gray-400 group-hover:text-gray-600"
                                            }`}
                                        />
                                    </div>
                                    <span
                                        className={`whitespace-nowrap overflow-hidden text-sm transition-all duration-300 ${
                                            expanded ? "w-auto opacity-100 ml-0" : "w-0 opacity-0 ml-0"
                                        }`}
                                    >
                                        {item.label}
                                    </span>
                                </Link>
                            );
                        })}
                      

                        {/* === BOTÃO DE AJUDA/SUPORTE (Abre via Ref) === */}
                        <button
                            onClick={() => supportBtnRef.current?.open()}
                            className={`group flex items-center relative py-3 cursor-pointer transition-all duration-200 w-full text-gray-600 hover:bg-gray-50 hover:text-gray-900 ${
                                expanded ? "justify-start px-5 gap-3" : "justify-center px-0"
                            }`}
                            title={!expanded ? "Ajuda" : ""}
                        >
                            <div className="flex items-center justify-center w-6 h-6">
                                <FontAwesomeIcon
                                    icon={faCircleQuestion}
                                    className="text-lg text-gray-400 group-hover:text-gray-600 transition-colors"
                                />
                            </div>
                            <span className={`whitespace-nowrap overflow-hidden text-sm transition-all duration-300 ${expanded ? "w-auto opacity-100 ml-0" : "w-0 opacity-0 ml-0"}`}>
                                Ajuda
                            </span>
                        </button>

                    </nav>
                </aside>

                <main className={`flex-1 p-8 transition-all duration-300 bg-gray-50 min-h-screen ${expanded ? "ml-60" : "ml-[4.5rem]"}`}>
                    <div className="max-w-7xl mx-auto">
                        {children}
                    </div>
                </main>
            </div>
        </>
    );
}