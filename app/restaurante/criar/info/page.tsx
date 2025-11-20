// app/restaurante/criar/info/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import { supabase } from "@/lib/supabaseClient";
import posthog from "posthog-js";

export default function InfoPage() {
    const router = useRouter();
    const { restaurantId, email } = useCreationStore();

    const [nome, setNome] = useState("");
    const [telefone, setTelefone] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        posthog.capture("info_page_access", {
            page: "/restaurante/criar/info",
            timestamp: new Date().toISOString(),
        });
    }, []);

    const handleCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        if (!email || !restaurantId) {
            setMessage("Erro: Sessão de criação expirada. Volte ao início.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const { error: authError } = await supabase.auth.signUp({
                email: email,
                password: password,
                
                options: {
                    data: {
                        phone: telefone,
                        full_name: nome 
                          
                    }
                }
            });

            if (authError) {
                // Deal with errors (e.g.: "User already registered")
                throw new Error(authError.message);
            }

            // 3. OTP
            router.push(`/restaurante/criar/info/otp`);

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
                        className="w-full rounded-md bg-black px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-gray-900 disabled:opacity-60"
                    >
                        {loading ? "Enviando código..." : "CRIAR CONTA"}
                    </button>
                    {message && (
                        <p className="text-center text-sm text-red-600">{message}</p>
                    )}
                </form>
            </div>
        </main>
    );
}