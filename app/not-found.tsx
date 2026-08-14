import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Página não encontrada | iMenu",
    description:
        "A página ou o cardápio que você procurou não está disponível.",
    robots: {
        index: false,
        follow: false,
    },
};

export default function NotFound() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-white px-6 py-16">
            <div className="w-full max-w-lg text-center">
                <Link
                    href="/"
                    aria-label="Ir para a página inicial do iMenu"
                    className="inline-flex"
                >
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
                        alt="iMenu"
                        width={120}
                        height={32}
                        className="h-8 w-auto"
                        priority
                    />
                </Link>

                <p className="mt-12 text-sm font-bold uppercase tracking-[0.2em] text-brand">
                    Erro 404
                </p>
                <h1 className="mt-3 text-3xl font-extrabold text-gray-900 md:text-4xl">
                    Página não encontrada
                </h1>
                <p className="mt-4 leading-relaxed text-gray-600">
                    O endereço pode estar incorreto ou este cardápio não está
                    mais disponível.
                </p>

                <Link
                    href="/"
                    className="mt-8 inline-flex rounded-lg bg-brand px-6 py-3 font-semibold text-white transition hover:opacity-90"
                >
                    Voltar para o iMenu
                </Link>
            </div>
        </main>
    );
}
