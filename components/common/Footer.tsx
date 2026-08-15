// components/Footer.tsx

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { useRestaurantDirectory } from "@/components/common/RestaurantDirectoryProvider";


export default function Footer() {

    const router = useRouter();
    const restaurantCities = useRestaurantDirectory();
    const [cityMenuOpen, setCityMenuOpen] = useState(false);
    const cityMenuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!cityMenuOpen) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (
                cityMenuRef.current &&
                !cityMenuRef.current.contains(event.target as Node)
            ) {
                setCityMenuOpen(false);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setCityMenuOpen(false);
            }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [cityMenuOpen]);

    return (
        <footer className="w-full border-t border-gray-200 mt-20 pt-12 pb-6 bg-white 2xl:pb-10">
            <div className="mx-24 2xl:mx-32 px-6 grid grid-cols-1 sm:grid-cols-3 gap-10 2xl:gap-20">

                {/* Coluna 1 */}
                <div className="flex flex-col gap-2 2xl:gap-4">
                    <h3 className="font-semibold text-gray-800 2xl:text-xl">iMenu</h3>
                    <Link href="/" className="text-gray-600 text-sm 2xl:text-xl hover:text-gray-800 cursor-pointer w-fit">Página Inicial</Link>
                    <Link href="/ferramentas" className="text-gray-600 text-sm 2xl:text-xl hover:text-gray-800 cursor-pointer w-fit">Ferramentas</Link>

                    {restaurantCities.length > 0 && (
                        <div ref={cityMenuRef} className="relative w-fit">
                            <button
                                type="button"
                                aria-expanded={cityMenuOpen}
                                aria-controls="restaurant-city-menu"
                                onClick={() =>
                                    setCityMenuOpen((current) => !current)
                                }
                                className="flex w-fit cursor-pointer items-center gap-1.5 text-sm font-medium text-brand transition-colors hover:text-brand/80 2xl:text-xl"
                            >
                                <span>Cardápios por cidade</span>
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand/10 2xl:h-7 2xl:w-7">
                                    <FontAwesomeIcon
                                        icon={faChevronDown}
                                        className={`h-2.5 w-2.5 transition-transform duration-300 ${
                                            cityMenuOpen ? "rotate-180" : ""
                                        }`}
                                    />
                                </span>
                            </button>

                            <div
                                id="restaurant-city-menu"
                                className={`absolute -left-24 top-full z-50 mt-3 w-[calc(100vw-3rem)] origin-top-left rounded-xl border border-gray-200 bg-white p-4 shadow-xl transition-all duration-300 ease-out md:left-0 md:w-[min(70vw,48rem)] 2xl:p-6 ${
                                    cityMenuOpen
                                        ? "visible translate-y-0 scale-100 opacity-100"
                                        : "invisible pointer-events-none -translate-y-2 scale-[0.98] opacity-0"
                                }`}
                            >
                                <nav
                                    aria-label="Cardápios por cidade"
                                    className="grid max-h-72 grid-cols-1 gap-x-8 gap-y-3 overflow-y-auto pr-2 text-sm sm:grid-cols-2 lg:grid-cols-3 2xl:text-xl"
                                >
                                    {restaurantCities.map((city) => (
                                        <Link
                                            key={city.slug}
                                            href={
                                                "/restaurantes/" + city.slug
                                            }
                                            className="w-fit text-gray-600 hover:text-gray-800 hover:underline"
                                        >
                                            {city.name}
                                            {city.state
                                                ? ", " + city.state
                                                : ""}
                                            <span className="ml-1 text-gray-400">
                                                ({city.menuCount})
                                            </span>
                                        </Link>
                                    ))}
                                </nav>
                            </div>
                        </div>
                    )}
                </div>

                {/* Coluna 2 */}
                <div className="flex flex-col gap-2 2xl:gap-4">
                    <h3 className="font-semibold text-gray-800 2xl:text-xl">Descubra</h3>
                    <a className="text-blue-500 underline text-sm 2xl:text-xl hover:text-blue-700 cursor-pointer w-fit" onClick={() => router.replace("/cardapio-digital")} >Top 5 Cardápios Digitais Grátis</a>
                    <a className="text-gray-600 text-sm 2xl:text-xl hover:text-gray-800 cursor-pointer w-fit" onClick={() => router.replace("/")}>iMenu Empresas</a>
                </div>

                {/* Coluna 3 */}
                <div className="flex flex-col gap-2 2xl:gap-4">
                    <h3 className="font-semibold text-gray-800 2xl:text-xl">Contato</h3>
                    <div className="flex items-center gap-4 text-gray-600">
                        <a className="text-gray-600 text-sm 2xl:text-xl hover:text-gray-800 cursor-pointer w-fit">suporte@imenu.com.br</a>

                    </div>
                    <a className="text-gray-600 text-sm 2xl:text-xl hover:text-gray-800 cursor-pointer w-fit" href="https://wa.me/5519997235394">Fale Conosco</a>
                </div>

            </div>


            <hr className="my-16 md:my-10 2xl:my-16 border-gray-200" />

            <div className="mx-4 md:mx-24 px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm 2xl:text-xl text-gray-500 gap-4">

                <div className="flex items-center gap-5 2xl:gap-10">
                    <span className="h-12 w-12 2xl:h-24 2xl:w-24 flex items-center">
                        <img src={"logos/LogoMark_Brand.png"} alt={"iMenu Logo"} width={48} height={48} className={"w-full"}></img>
                    </span>
                    <p className="max-w-md leading-relaxed font-light">
                        © 2025 iMenu — Todos os direitos reservados.
                        <br />
                        {/*CNPJ 00.000.000/0000-00 — Endereço Placeholder, 123 — Cidade, UF — CEP 00000-000*/}
                    </p>
                </div>

                <div className="flex gap-4 2xl:gap-8 text-sm 2xl:text-xl flex-wrap w-full md:w-auto justify-center md:justify-end">
                    <a className="hover:text-gray-800 cursor-pointer" onClick={() => router.replace("/restaurante/dados/termos-e-condicoes")}>Termos e Condições</a>
                    <a className="hover:text-gray-800 cursor-pointer" onClick={() => router.replace("/restaurante/dados/privacidade")}>Privacidade</a>
                </div>

            </div>
        </footer>
    );
}
