"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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

// ✅ Strong type for menu items
type MenuItem =
    | { type: "divider" }
    | { label: string; icon: IconDefinition; href: string; type?: undefined };

export default function PainelLayout({
                                         children,
                                     }: {
    children: React.ReactNode;
}) {
    const [expanded, setExpanded] = useState(true);
    const [active, setActive] = useState("/painel/pedidos");

    const menuItems: MenuItem[] = [
        { label: "Pedidos", icon: faBox, href: "/painel/pedidos" },
        { label: "Financeiro", icon: faMoneyBillWave, href: "/painel/financeiro" },
        { type: "divider" },
        { label: "Cardápio", icon: faUtensils, href: "/painel/cardapio" },
        { label: "Taxa e Tempo", icon: faTruck, href: "/painel/entrega" },
        { label: "Horários", icon: faClock, href: "/painel/horarios" },
        { label: "Loja", icon: faStore, href: "/painel/loja" },
        { type: "divider" },
        { label: "Configurações", icon: faGear, href: "/painel/config" },
        { label: "Ajuda", icon: faCircleQuestion, href: "/painel/ajuda" },
    ];

    return (
        <div className="flex min-h-screen bg-gray-50">
            {/* === SIDEBAR === */}
            <aside
                className={`relative flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ${
                    expanded ? "w-60" : "w-15"
                }`}
            >
                {/* Toggle Button */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="cursor-pointer absolute -right-4 top-20 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white border-1 border-gray-200 shadow hover:bg-gray-50"
                >
                    <FontAwesomeIcon
                        icon={expanded ? faChevronLeft : faChevronRight}
                        className="text-brand"
                    />
                </button>

                {/* === LOGO === */}
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
                <nav className="flex-1 flex flex-col justify-center overflow-y-auto py-6 space-y-1">
                    {menuItems.map((item, idx) =>
                            item.type === "divider" ? (
                                <hr key={idx} className="my-2 border-gray-200 mx-4" />
                            ) : (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setActive(item.href)}
                                    className={`group flex items-center ${
                                        expanded ? "justify-start gap-3 px-5" : "justify-center px-0"
                                    } py-3 cursor-pointer transition-all duration-200 ${
                                        active === item.href
                                            ? "border-l-4 border-brand bg-brand/10 text-brand font-semibold"
                                            : "text-gray-700 hover:bg-gray-100"
                                    }`}
                                >
                                    <div className="flex items-center justify-center w-6 h-6">
                                        <FontAwesomeIcon
                                            icon={item.icon}
                                            className={`text-lg transition-colors ${
                                                active === item.href
                                                    ? "text-brand"
                                                    : "text-gray-500 group-hover:text-gray-800"
                                            }`}
                                        />
                                    </div>

                                    {expanded && (
                                        <span className="whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.label}
                  </span>
                                    )}
                                </Link>
                            )
                    )}
                </nav>
            </aside>

            {/* === MAIN CONTENT === */}
            <main className="flex-1 p-8">{children}</main>
        </div>
    );
}
