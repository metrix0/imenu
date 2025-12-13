import Image from "next/image";
import Button from "@/components/ui/Button";
import Link from "next/link";

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
            <section className="bg-gray-50 border-b border-gray-200">
                <div className="mx-auto max-w-6xl px-6 py-24 pt-12 grid grid-cols-1 md:grid-cols-2 gap-16 items-center min-h-[520px]">
                    <div>
                        <h1 className="text-4xl font-extrabold text-brand mb-6 leading-tight">
                            {h1}
                        </h1>

                        <p className="text-lg text-gray-600 mb-8 max-w-xl">
                            {description}
                        </p>

                        <Link                             href="/restaurante/registrar"
                                                 >

                        <Button
                            className="inline-flex items-center justify-center rounded-xl bg-brand px-8 py-4 text-white font-semibold hover:opacity-90 transition"
                        >
                            {ctaLabel}
                        </Button>
                        </Link>
                    </div>

                    {/* IMAGE CONTAINER */}
                    <div className="flex justify-center">
                        <div className="relative w-full max-w-lg h-[550px]  flex justify-center">
                            <Image
                                src={imageSrc}
                                alt={imageAlt}
                                height={400}
                                width={500}
                                className="object-contain h-full w-auto rounded-2xl border-2 "
                                priority
                            />
                        </div>
                    </div>
                </div>
            </section>

            {/* CONTENT */}
            <section className="mx-auto max-w-4xl px-6 py-24 space-y-20">
                {children}
            </section>
        </>
    );
}
