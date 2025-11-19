// app/restaurante/criar/info/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function InfoPage() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [nome, setNome] = useState("");
    const [telefone, setTelefone] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleCreateAccount = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        try {
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: nome,
                        phone: telefone,
                    },
                },
            });

            if (error) throw new Error(error.message);

            router.push("/restaurante/criar/localizacao");

        } catch (err) {
            setMessage((err as Error).message);
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
            <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
                <h1 className="text-3xl font-bold text-center text-gray-900">
                    Crie sua conta
                </h1>

                <form onSubmit={handleCreateAccount} className="space-y-5">
                    <div>
                        <label className="block text-base font-medium text-gray-700">
                            Seu E-mail
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm"
                            placeholder="email@exemplo.com"
                        />
                    </div>

                    <div>
                        <label className="block text-base font-medium text-gray-700">
                            Seu Nome
                        </label>
                        <input
                            type="text"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            required
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm"
                            placeholder="João Vitor"
                        />
                    </div>

                    <div>
                        <label className="block text-base font-medium text-gray-700">
                            Telefone (WhatsApp)
                        </label>
                        <input
                            type="tel"
                            value={telefone}
                            onChange={(e) => setTelefone(e.target.value)}
                            required
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm"
                            placeholder="(19) 99999-8888"
                        />
                    </div>

                    <div>
                        <label className="block text-base font-medium text-gray-700">
                            Senha
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-md bg-black px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-gray-900 disabled:opacity-60"
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
