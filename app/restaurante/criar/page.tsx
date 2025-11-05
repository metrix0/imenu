// app/restaurante/criar/page.tsx
import Link from "next/link";

export default function CriarRestaurantePage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <div className="w-full max-w-lg space-y-6 rounded-lg bg-white p-10 shadow-md">
                <h1 className="text-4xl font-bold text-gray-900">
                    🍽️
                </h1>
                <h2 className="text-3xl font-bold text-gray-900">
                    Vamos começar sua loja e impulsionar suas vendas
                </h2>
                <p className="text-lg text-gray-600">
                    Configure seu cardápio digital em poucos minutos e comece a
                    receber pedidos imediatamente.
                </p>
                <Link
                    href="/restaurante/criar/info"
                    className="inline-block w-full rounded-md bg-black px-8 py-4 text-base font-semibold text-white shadow-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
                >
                    Criar Loja
                </Link>
            </div>
        </div>
    );
}
