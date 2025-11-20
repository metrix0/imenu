// app/restaurante/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import posthog from "posthog-js";

export default function RestaurantLandingPage() {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        posthog.capture("admin_access_create_restaurant_page", {
            page: "/restaurante",
            timestamp: new Date().toISOString(),
        });
    }, []);


    const { setRestaurantId, setEmail: saveEmailToStore } = useCreationStore();

    const handleSubmitLead = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            const response = await fetch("/api/restaurants/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Falha ao enviar e-mail.");
            }

            const newId = data.id;
            setRestaurantId(newId);

            saveEmailToStore(email);

            router.push("/restaurante/criar/localizacao");

        } catch (error) {
            setMessage((error as Error).message);
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 max-w-4xl w-full">

                <div className="w-full max-w-md">
                    <h1 className="text-4xl font-bold text-gray-900">Seu cardápio digital.</h1>
                    <p className="mt-4 text-lg text-gray-600">
                        Comece de graça e configure seu restaurante em minutos.
                    </p>
                </div>

                <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
                    <h2 className="text-3xl font-bold text-center text-gray-900">
                        Comece agora
                    </h2>

                    <form onSubmit={handleSubmitLead} className="space-y-5">
                        <div>
                            <label
                                htmlFor="email"
                                className="block text-base font-medium text-gray-700"
                            >
                                Qual o seu e-mail?
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                placeholder="exemplo@email.com"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-md bg-black px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-60"
                        >
                            {loading ? "Criando..." : "Continuar"}
                        </button>

                        {message && (
                            <p className="text-center text-sm text-red-600">{message}</p>
                        )}
                    </form>
                </div>
            </div>
        </main>
    );
}