"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useParams, usePathname, useRouter } from "next/navigation";
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
    faDoorOpen,
    faPowerOff,
    faPercent,
    faPuzzlePiece,
    faGift,
    faPrint
} from "@fortawesome/free-solid-svg-icons";
import { createClient } from "@supabase/supabase-js";

import ConfirmModal from "@/components/ui/ConfirmModal"; // Importe o Modal
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Para pegar o ID rápido


// Importa o componente refatorado
import SupportButton, { SupportButtonRef } from "@/components/common/SupportButton";
import { supabase } from "@/lib/database/supabaseClient";
import Loader from "@/components/ui/Loader";
import Script from "next/script";

type MenuItem =
    | { type: "divider" }
    | { label: string; icon: IconDefinition; href: string; type?: undefined };

export default function PainelLayout({ children}: { children: React.ReactNode }) {
    const params = useParams();
    const pathname = usePathname();
    const base = `/painel`;
    const { restaurantId } = useCreationStore();
    const [expanded, setExpanded] = useState(false);
    const [menuId, setMenuId] = useState<string | null>(null);
    const [isStoreClosed, setIsStoreClosed] = useState<boolean>(false); // Estado da loja
    const [showCloseModal, setShowCloseModal] = useState(false); // Modal de fechar
    const [isTogglingStore, setIsTogglingStore] = useState(false); // Loading do botão
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true); // Evita piscar conteúdo protegido


    // Ref para controlar o botão de suporte
    const supportBtnRef = useRef<SupportButtonRef>(null);




useEffect(() => {
        const fetchContext = async () => {
            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            // Tenta pegar ID do Zustand ou da URL (fallback)
            const targetId = restaurantId || (Array.isArray(params?.restauranteId) ? params.restauranteId[0] : params?.restauranteId);

            if (!targetId) return;

            try {
                // Busca Menu ID e Status de Fechamento em paralelo
                const [menuRes, restRes] = await Promise.all([
                    supabase.from("menu").select("id").eq("restaurant_id", targetId).limit(1).maybeSingle(),
                    supabase.from("restaurants").select("is_closed").eq("id", targetId).single()
                ]);

                if (menuRes.data) setMenuId(menuRes.data.id);

                // Lógica de Verificação de Data
                if (restRes.data) {
                    const closedDate = restRes.data.is_closed;
                    if (closedDate) {
                        const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
                        const savedDate = new Date(closedDate).toISOString().split("T")[0];

                        // Se a data salva for diferente de hoje (feriado passou), abre automaticamente
                        if (savedDate !== today) {
                            // Atualiza no banco para abrir (silenciosamente)
                            await fetch(`/api/restaurants/${targetId}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ is_closed: null })
                            });
                            setIsStoreClosed(false);
                        } else {
                            setIsStoreClosed(true);
                        }
                    } else {
                        setIsStoreClosed(false);
                    }
                }
            } catch (err) {
                console.error("Erro no layout:", err);
            }
        };

        fetchContext();
    }, [restaurantId, params]);

        // --- PROTEÇÃO DE ROTA ---
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                // Não está logado -> Login
                router.replace("/restaurante/login");
                return;
            }

            setIsChecking(false); // Libera a renderização
        };

        checkAuth();
    }, [router]);

    if (isChecking) {
        return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <Loader />
        </div>;
    }

    // Função de Toggle (Chamada pelo botão/modal)
    const handleStoreToggle = async (action: "open" | "close") => {
        const targetId = restaurantId;
        if (!targetId) return;

        setIsTogglingStore(true);
        try {
            const newVal = action === "close" ? new Date().toISOString() : null;

            // Chama API Unificada
            const res = await fetch(`/api/restaurants/${targetId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ is_closed: newVal })
            });

            if (!res.ok) throw new Error("Falha ao atualizar");

            setIsStoreClosed(action === "close");
            if (action === "close") setShowCloseModal(false);
        } catch (err) {
            alert("Erro ao alterar status da loja.");
        } finally {
            setIsTogglingStore(false);
        }
    };

    const cardapioHref = menuId ? `${base}/cardapio/${menuId}` : `${base}/cardapio`;
    const configuracoesHref = `${base}/configuracoes`;


    const menuItems: MenuItem[] = [
        { label: "Home", icon: faHome, href: `${base}/` },
        { label: "Pedidos", icon: faBox, href: `${base}/pedidos` },
        { label: "Financeiro", icon: faMoneyBillWave, href: `${base}/financeiro` },
        { label: "Cardápio", icon: faUtensils, href: `${base}/cardapio` },
        { type: "divider" },
        { label: "Promoções", icon: faPercent, href: `${base}/promocoes` },
        { label: "Fidelidade", icon: faGift, href: `${base}/fidelidade` },
        { label: "Taxa e Tempo", icon: faTruck, href: `${base}/tempo-e-taxa` },
        { label: "Horários", icon: faClock, href: `${base}/disponibilidade` },
        { label: "Loja", icon: faStore, href: `${base}/loja` },
        { type: "divider" },
        { label: "Impressora", icon: faPrint, href: `${base}/impressora` },
        { label: "Integrações", icon: faPuzzlePiece, href: `${base}/integracoes` },
        { label: "Configurações", icon: faGear, href: configuracoesHref },
    ];

    return (
        <>
            <Script id="ms-clarity" strategy="afterInteractive">
                {`
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "uk4ichh2nj");
              `}
            </Script>
            {/* Modal de Confirmação para Fechar */}
            <ConfirmModal
                open={showCloseModal}
                onClose={() => setShowCloseModal(false)}
                onConfirm={() => handleStoreToggle("close")}
                title="Fechar Loja Hoje?"
                description="Isso fechará a loja temporariamente. Ela abrirá automaticamente amanhã ou você pode reabri-la manualmente a qualquer momento."
                confirmLabel="Fechar Loja"
                variant="danger"
                isLoading={isTogglingStore}
            />
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
                        expanded ? "w-60 2xl:w-70" : "w-[5.2vw] min-w-15"
                    }`}
                >
                    {/* Botão Expandir/Contrair */}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="cursor-pointer absolute -right-4 2xl:-right-5 top-20 z-10 flex h-8 w-8 2xl:h-10 2xl:w-10 items-center justify-center rounded-full bg-white border border-gray-200 shadow hover:bg-gray-50 text-sm 2xl:text-base"
                    >
                        <FontAwesomeIcon
                            icon={expanded ? faChevronLeft : faChevronRight}
                            className="text-brand"
                        />
                    </button>

                    <div className="flex items-center justify-center mt-4 mb-0 2xl:mb-2 h-[70px] 2xl:h-[90px] relative">
                        <div
                            className={`transition-all duration-300 flex items-center justify-center ${
                                expanded ? "scale-100 opacity-100" : "scale-0 opacity-0 absolute"
                            }`}
                        >
                            <Image
                                src="/logos/CombinationMarkLogo_Brand.png"
                                alt="Logo"
                                width={120}
                                height={40}
                                className="transition-all duration-300 2xl:w-35"
                            />
                        </div>
                        {/* Logo Icon */}
                        <div
                            className={`transition-all duration-300 flex items-center justify-center absolute ${
                                expanded ? "scale-0 opacity-0" : "scale-100 opacity-100"
                            }`}
                        >
                            <Image
                                src="/logos/LogoMark_Brand.png"
                                alt="Logo"
                                width={32}
                                height={32}
                                className="transition-all duration-300  2xl:w-10"
                            />
                        </div>
                    </div>

                    {/* --- BOTÃO DE STATUS DA LOJA --- */}
                    <div className={`mt-2 2xl:mt-8 transition-all duration-300 ${expanded ? "w-full px-4" : "w-auto"}`}>
                        {expanded ? (
                            // GAVETA ABERTA: Botão com Texto
                            <button
                                onClick={() => isStoreClosed ? handleStoreToggle("open") : setShowCloseModal(true)}
                                disabled={isTogglingStore}
                                className={`whitespace-nowrap cursor-pointer w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                                    isStoreClosed 
                                        ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" 
                                        : "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                                }`}
                            >
                                <FontAwesomeIcon icon={isStoreClosed ? faDoorOpen : faPowerOff} />
                                {isStoreClosed ? "Abrir Loja" : "Loja Aberta"}
                            </button>
                        ) : (
                            // GAVETA FECHADA: Ícone Pulse
                            <div className="flex justify-center py-2 mt-2 " title={isStoreClosed ? "Loja Fechada" : "Loja Aberta"}>
                                <div className={`w-3 h-3 rounded-full relative  ${isStoreClosed ? "bg-red-500" : "bg-green-500"}`}>
                                    {/* Efeito Pulse apenas se aberto */}
                                    {!isStoreClosed && (
                                        <div className="absolute inset-0 rounded-full bg-green-500 animate-[pulseHalo_2s_infinite]"></div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* === MENU === */}
                    <nav className="flex-1 flex flex-col overflow-y-auto py-4 space-y-1 thin-scrollbar">

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
                                    <div className="flex items-center justify-center w-6 h-6 2xl:w-12 2xl:h-10">
                                        <FontAwesomeIcon
                                            icon={item.icon}
                                            className={`text-lg 2xl:text-2xl transition-colors ${
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
                            <div className="flex items-center justify-center w-6 h-6 2xl:w-12 2xl:h-10">
                                <FontAwesomeIcon
                                    icon={faCircleQuestion}
                                    className="text-lg 2xl:text-2xl text-gray-400 group-hover:text-gray-600 transition-colors"
                                />
                            </div>
                            <span className={`2xl:text-lg whitespace-nowrap overflow-hidden text-sm transition-all duration-300 ${expanded ? "w-auto opacity-100 ml-0" : "w-0 opacity-0 ml-0"}`}>
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