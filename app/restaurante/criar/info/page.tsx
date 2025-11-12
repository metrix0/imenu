// app/restaurante/criar/info/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import { supabase } from "@/lib/supabaseClient"; // client-side

export default function InfoPage() {
    const router = useRouter();
    

    const { restaurantId, email, clear: clearCreationStore } = useCreationStore();

    const [nome, setNome] = useState("");
    const [telefone, setTelefone] = useState("");
    const [password, setPassword] = useState("");

    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!email || !restaurantId) {
            setMessage("Erro: Sessão de criação expirada. Volte ao início.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const response = await fetch("/api/auth/create-restaurant-user", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password,
                    nome,
                    telefone,
                    restaurantId
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Falha ao criar conta.");
            }

            if (data.session) {
                await supabase.auth.setSession(data.session);
            }

            clearCreationStore();

            router.push("/painel"); 

        } catch (error) {
            setMessage((error as Error).message);
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
            <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
                <h1 className="text-3xl font-bold text-center text-gray-900">
                    Tudo pronto!
                </h1>
                <p className="text-center text-gray-600">
                    Falta só criar sua conta de acesso. Seu e-mail é <strong className="text-gray-900">{email || "..."}</strong>.
                </p>

                <form onSubmit={handleCreateAccount} className="space-y-5">
                    <div>
                        <label htmlFor="nome" className="block text-base font-medium text-gray-700">
                            Seu Nome
                        </label>
                        <input
                            id="nome" type="text" value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            required
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm"
                            placeholder="João Vitor"
                        />
                    </div>
                    <div>
                        <label htmlFor="telefone" className="block text-base font-medium text-gray-700">
                            Telefone (WhatsApp)
                        </label>
                        <input
                            id="telefone" type="tel" value={telefone}
                            onChange={(e) => setTelefone(e.target.value)}
                            required
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm"
                            placeholder="(19) 99999-8888"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-base font-medium text-gray-700">
                            Crie uma Senha
                        </label>
                        <input
                            id="password" type="password" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required minLength={6}
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !email}
                        className="w-full rounded-md bg-black px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-60"
                    >
                        {loading ? "Criando conta..." : "CRIAR CONTA"}
                    </button>

                    {message && (
                        <p className="text-center text-sm text-red-600">{message}</p>
                    )}
                </form>
            </div>
        </main>
    );
}