// components/Footer.tsx

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useRestaurantDirectory } from "@/components/common/RestaurantDirectoryProvider";


export default function Footer() {

    const router = useRouter();
    const restaurantCities = useRestaurantDirectory();

    return (
        <footer className="w-full border-t border-gray-200 mt-20 pt-12 pb-10 bg-white 2xl:pb-16">
            <div className="mx-24 2xl:mx-32 px-6 grid grid-cols-1 sm:grid-cols-3 gap-10 2xl:gap-20">

                {/* Coluna 1 */}
                <div className="flex flex-col gap-2 2xl:gap-4">
                    <h3 className="font-semibold text-gray-800 2xl:text-xl">iMenu</h3>
                    <a className="text-gray-600 text-sm 2xl:text-xl hover:text-gray-800 cursor-pointer w-fit" onClick={() => router.replace("/")}>Página Inicial</a>
                    <a className="text-gray-600 text-sm 2xl:text-xl hover:text-gray-800 cursor-pointer w-fit" onClick={() => window.location.href ="https://wa.me/5519997235394"}>Fale Conosco</a>
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
                </div>

            </div>


            {restaurantCities.length > 0 && (
                <div className="mx-4 mt-10 px-6 md:mx-24 2xl:mx-32">
                    <details className="group">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-800 2xl:text-xl [&::-webkit-details-marker]:hidden">
                            <span>Cardápios por cidade</span>
                            <span
                                aria-hidden="true"
                                className="text-gray-500 transition-transform group-open:rotate-180"
                            >
                                ⌄
                            </span>
                        </summary>

                        <nav
                            aria-label="Cardápios por cidade"
                            className="mt-5 hidden max-h-72 grid-cols-1 gap-x-8 gap-y-3 overflow-y-auto pr-2 text-sm group-open:grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 2xl:text-xl"
                        >
                            {restaurantCities.map((city) => (
                                <Link
                                    key={city.slug}
                                    href={"/restaurantes/" + city.slug}
                                    className="w-fit text-gray-600 hover:text-gray-800 hover:underline"
                                >
                                    {city.name}
                                    {city.state ? ", " + city.state : ""}
                                    <span className="ml-1 text-gray-400">
                                        ({city.menuCount})
                                    </span>
                                </Link>
                            ))}
                        </nav>
                    </details>
                </div>
            )}

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
