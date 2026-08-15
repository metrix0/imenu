import Image from "next/image";
import Button from "@/components/ui/Button";
import Link from "next/link";
import RestaurantToolsCta from "@/components/common/restaurant-tools/RestaurantToolsCta";

interface SeoPageProps {
    h1: string;
    description: React.ReactNode;
    imageSrc: string;
    imageAlt: string;
    ctaLabel: string;
    children: React.ReactNode;
}

export function SeoPage({
    h1,
    description,
    imageSrc,
    imageAlt,
    ctaLabel,
    children,
}: SeoPageProps) {
    return (
        <>
            {/* HERO */}
            <section className="w-full max-w-full bg-gray-50 border-b border-gray-200">
                <div className="mx-auto w-full max-w-6xl px-6 py-16 md:py-24 md:pt-12 grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center min-h-0 md:min-h-[520px]">
                    <div className="min-w-0">
                        <h1 className="text-4xl font-extrabold text-brand mb-6 leading-tight break-words">
                            {h1}
                        </h1>

                        <p className="text-lg text-gray-600 mb-8 max-w-xl">
                            {description}
                        </p>

                        <Link href="/restaurante/registrar">
                            <Button
                                className="inline-flex items-center justify-center rounded-xl bg-brand px-8 py-4 text-white font-semibold hover:opacity-90 transition"
                            >
                                {ctaLabel}
                            </Button>
                        </Link>
                    </div>

                    {/* IMAGE CONTAINER */}
                    <div className="flex min-w-0 w-full justify-center overflow-hidden">
                        <div className="relative flex w-full max-w-lg justify-center">
                            <Image
                                src={imageSrc}
                                alt={imageAlt}
                                height={400}
                                width={500}
                                className="block h-auto max-h-[550px] w-full max-w-full object-contain rounded-2xl border-2"
                                priority
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* CONTENT */}
            <section className="mx-auto w-full max-w-4xl px-6 py-24 space-y-20">
                {children}
                <RestaurantToolsCta title="Leve essas ideias para a operação" />
            </section>
        </>
    );
}
