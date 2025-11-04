// app/restaurante/criar/info/page.tsx
import Link from "next/link";

export default function CriarInfoPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <div className="w-full max-w-lg space-y-6 rounded-lg bg-white p-10 shadow-md">
                <h1 className="text-3xl font-bold text-gray-900">
                    O que você precisará
                </h1>
                <p className="text-lg text-gray-600">
                    Para agilizar o processo, tenha em mãos as seguintes
                    informações da sua loja:
                </p>
                
                <ul className="space-y-2 text-left text-gray-700">
                    <li className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        Informações básicas (Nome, Endereço)
                    </li>
                   {/*  <li className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        Dados bancários (para saques)
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="text-green-500">✓</span>
                        Seu cardápio (para o setup inicial)
                    </li>*/}
                </ul>

                <p className="text-sm text-gray-500">
                    Você poderá alterar essas informações depois.
                </p>
                
                <Link
                    href="/restaurante/criando"
                    className="inline-block w-full rounded-md bg-black px-8 py-4 text-base font-semibold text-white shadow-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
                >
                    Entendido, continuar
                </Link>
            </div>
        </div>
    );
}