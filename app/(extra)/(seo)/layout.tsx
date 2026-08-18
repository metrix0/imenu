"use client";

import Image from "next/image";
import Footer from "@/components/common/Footer";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import Button from "@/components/ui/Button";
import { useRouter } from "next/navigation";
import SeoTrafficTracker from "@/components/analytics/SeoTrafficTracker";

export default function SeoLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();

    return (
        <div className="seo-responsive relative flex min-h-screen w-full max-w-full flex-col overflow-x-clip">
            <SeoTrafficTracker />
            <header className="w-full border-gray-200 bg-white px-4 py-7 md:px-8 md:py-5 2xl:py-8">
                <div className="mx-auto flex w-full max-w-7xl min-w-0 items-center justify-between gap-3">
                    {/* Left – Logo */}
                    <Link
                        href="/"
                        aria-label="Ir para a página inicial do iMenu"
                        className="flex min-w-0 shrink items-center gap-2 text-xl font-bold text-brand"
                    >
                        <Image
                            src="/logos/CombinationMarkLogo_Brand.png"
                            alt="iMenu Logo"
                            width={200}
                            height={42}
                            className="h-6 w-auto max-w-[120px] cursor-pointer 2xl:h-10 2xl:max-w-none"
                        />
                    </Link>

                    {/* Right */}
                    <nav className="flex min-w-0 shrink-0 items-center gap-2 text-sm font-medium sm:gap-4 md:gap-8 2xl:gap-11 2xl:text-[1.2rem]">
                        <Link href="/" className="hidden transition hover:text-gray-500 md:block">Home</Link>
                        <Link href="/#recursos" className="hidden transition hover:text-gray-500 md:block">Recursos</Link>

                        <div className="hidden h-6 w-px bg-gray-300 md:block 2xl:h-8" />

                        <a
                            onClick={() => router.push("/restaurante/login")}
                            className="flex cursor-pointer items-center gap-1 whitespace-nowrap text-gray-600 transition hover:text-gray-500"
                        >
                            <FontAwesomeIcon icon={icons.faUser} />
                            Login
                        </a>

                        <Button
                            className="whitespace-nowrap px-3 sm:px-4"
                            variant="primary"
                            onClick={() => router.push("/restaurante/registrar")}
                        >
                            Registrar Grátis
                        </Button>
                    </nav>
                </div>
            </header>

            {/* PAGE */}
            <main className="min-w-0 w-full max-w-full flex-1">
                {children}

                {/* INTERNAL LINKING */}
                <section className="mt-20 -mb-20 w-full border-t border-gray-200 bg-gray-50">
                    <div className="mx-auto w-full max-w-6xl px-6 py-12">
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
                            <Link href="/blog" className="font-medium text-brand hover:underline">
                                Guias para restaurantes
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
                            <Link href="/ferramentas" className="font-medium text-brand hover:underline">
                                Ferramentas gratuitas para restaurantes
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <Footer />
        </div>
    );
}
