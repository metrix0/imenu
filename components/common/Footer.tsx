// components/Footer.tsx

import { useRouter } from "next/navigation";


export default function Footer() {

    const router = useRouter();

    return (
        <footer className="w-full border-t border-gray-200 mt-20 pt-12 pb-10 bg-white">
            <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-10">

                {/* Coluna 1 */}
                <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-gray-800">iMenu</h3>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer w-fit" onClick={() => router.replace("/")}>Página Inicial</a>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer w-fit" onClick={() => window.location.href ="https://wa.me/5519997235394"}>Fale Conosco</a>
                </div>

                {/* Coluna 2 */}
                <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-gray-800">Descubra</h3>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer w-fit" onClick={() => router.replace("/restaurantes/registrar")} >Cadastre seu Restaurante</a>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer w-fit" onClick={() => router.replace("/")}>iMenu Empresas</a>
                </div>

                {/* Coluna 3 */}
                <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-gray-800">Contato</h3>
                    <div className="flex items-center gap-4 text-gray-600">
                        <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer w-fit">suporte@imenu.com.br</a>

                    </div>
                </div>

            </div>

            <hr className="my-10 border-gray-200" />

            <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm text-gray-500 gap-4">

                <div className="flex items-center gap-5 ">
                    <span className="h-12 w-12 flex items-center">
                        <img src={"logos/LogoMark_Brand.png"} alt={"iMenu Logo"} width={48} height={48}></img>
                    </span>
                    <p className="max-w-md leading-relaxed font-light">
                        © 2025 iMenu — Todos os direitos reservados.
                        <br />
                        {/*CNPJ 00.000.000/0000-00 — Endereço Placeholder, 123 — Cidade, UF — CEP 00000-000*/}
                    </p>
                </div>

                <div className="flex gap-4 text-sm flex-wrap">
                    <a className="hover:text-gray-800 cursor-pointer" onClick={() => router.replace("/restaurante/dados/termos-e-condicoes")}>Termos e Condições</a>
                    <a className="hover:text-gray-800 cursor-pointer" onClick={() => router.replace("/restaurante/dados/privacidade")}>Privacidade</a>
                </div>

            </div>
        </footer>
    );
}
