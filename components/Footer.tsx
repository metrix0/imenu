// components/Footer.tsx
export default function Footer() {
    return (
        <footer className="w-full border-t border-gray-200 mt-20 pt-12 pb-10 bg-white">
            <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 sm:grid-cols-3 gap-10">

                {/* Coluna 1 */}
                <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-gray-800">iMenu</h3>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer">Site Institucional</a>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer">Fale Conosco</a>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer">Conta e Segurança</a>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer">Carreiras</a>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer">Parceiros</a>
                </div>

                {/* Coluna 2 */}
                <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-gray-800">Descubra</h3>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer">Cadastre seu Restaurante</a>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer">iMenu Shop</a>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer">iMenu Empresas</a>
                    <a className="text-gray-600 text-sm hover:text-gray-800 cursor-pointer">Blog iMenu</a>
                </div>

                {/* Coluna 3 */}
                <div className="flex flex-col gap-2">
                    <h3 className="font-semibold text-gray-800">Social</h3>
                    <div className="flex items-center gap-4 text-gray-600">
                        <span className="cursor-pointer hover:text-gray-800">📘</span>
                        <span className="cursor-pointer hover:text-gray-800">🐦</span>
                        <span className="cursor-pointer hover:text-gray-800">▶️</span>
                        <span className="cursor-pointer hover:text-gray-800">📸</span>
                    </div>
                </div>

            </div>

            <hr className="my-10 border-gray-200" />

            <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-start sm:items-center text-sm text-gray-500 gap-4">

                <div className="flex items-start gap-3">
                    <span className="text-3xl select-none">
                        <img src={"a.png"} alt={"whatever"} width={48} height={48} className="rounded-full"></img>
                    </span>
                    <p className="max-w-md leading-relaxed font-light">
                        © 2025 iMenu — Todos os direitos reservados.
                        <br />
                        CNPJ 00.000.000/0000-00 — Endereço Placeholder, 123 — Cidade, UF — CEP 00000-000
                    </p>
                </div>

                <div className="flex gap-4 text-sm flex-wrap">
                    <a className="hover:text-gray-800 cursor-pointer">Termos e Condições</a>
                    <a className="hover:text-gray-800 cursor-pointer">Código de Conduta</a>
                    <a className="hover:text-gray-800 cursor-pointer">Privacidade</a>
                    <a className="hover:text-gray-800 cursor-pointer">Dicas de Segurança</a>
                </div>

            </div>
        </footer>
    );
}
