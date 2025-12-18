"use client";

import Image from "next/image";
import Footer from "@/components/common/Footer";
import Link from "next/link";
import Tooltip from "@/components/ui/Tooltip";
import BonusButton from "@/components/ui/BonusButton";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {icons} from "@/lib/utils/fontawesome";
import Button from "@/components/ui/Button";
import {useRouter} from "next/navigation";

export default function SeoLayout({
                                      children,
                                  }: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    return (
        <div className="w-screen relative min-h-screen overflow-x-hidden flex flex-col ">
            <header className="w-full flex flex-col md:flex-row gap-4 md:gap-0 items-center justify-between py-7 md:py-5 2xl:py-8 px-8 border-gray-200 bg-white">
                {/* Left – Logo */}
                <div className={"flex justify-between w-[90vw] md:flex "}>
                    <div className="flex items-center gap-2 text-xl font-bold text-brand">
                        {/* Logo placeholder */}
                        <Image
                            src="/logos/CombinationMarkLogo_Brand.png"
                            alt="iMenu Logo"
                            width={120}
                            height={32}
                            className="h-6 w-auto ml-4 cursor-pointer 2xl:h-10 2xl:ml-8"
                            onClick={() => router.push("#")}
                        />
                    </div>

                    {/* Right */}
                    <nav className="flex z-30 md:z-auto items-center gap-4 md:gap-8 text-sm font-medium 2xl:text-[1.2rem] 2xl:gap-11">
                        <a href="#" className="hover:text-gray-500 transition hidden md:block">Home</a>
                        <a href="#recursos" className="hover:text-gray-500 transition hidden md:block">Recursos</a>

                        <div className="w-[1px] h-6 2xl:h-8 bg-gray-300 hidden md:block" />

                        <a onClick={() => router.push("/restaurante/login")} className="cursor-pointer items-center gap-1 hover:text-gray-500 transition text-gray-600">
                            <FontAwesomeIcon icon={icons.faUser} />
                            Login
                        </a>

                        <Button className={""} variant="primary" onClick={() => router.push("/restaurante/registrar")}>
                            Registrar Grátis
                        </Button>
                    </nav>
                </div>
            </header>


            {/* PAGE */}
            <main className="flex-1">
                {children}

                {/* INTERNAL LINKING */}
                <section className="mt-20 border-t -mb-20 border-gray-200 bg-gray-50">
                    <div className="mx-24 px-6 py-12">
                        <h3 className="font-semibold text-lg mb-4">
                            Explore outras soluções do iMenu
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <Link href="/cardapio-digital" className="hover:underline">
                                Cardápio Digital
                            </Link>
                            <Link href="/cardapio-digital-gratuito" className="hover:underline">
                                Cardápio Digital Gratuito
                            </Link>
                            <Link href="/gestor-de-pedidos" className="hover:underline">
                                Gestor de Pedidos
                            </Link>
                            <Link href="/anota-ai" className="hover:underline">
                                iMenu vs Anota Ai
                            </Link>
                            <Link href="/goomer" className="hover:underline">
                                iMenu vs Goomer
                            </Link>
                            <Link href="/saipos" className="hover:underline">
                                iMenu vs Saipos
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
