// app/configuracoes/conta/nova-senha/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient"; 

export default function NewPasswordPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState<{ type: 'success' | 'error', content: string } | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', content: 'As senhas não coincidem.' });
            setLoading(false);
            return;
        }

        if (newPassword.length < 6) {
             setMessage({ type: 'error', content: 'A senha deve ter pelo menos 6 caracteres.' });
            setLoading(false);
            return;
        }

        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            setMessage({ type: 'error', content: `Erro: ${error.message}` });
        } else {
            setMessage({ type: 'success', content: 'Senha atualizada com sucesso!' });
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => {
                router.push('/configuracoes/conta');
            }, 2000);
        }
        setLoading(false);
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md">
                <h1 className="text-center text-3xl font-bold text-gray-900">
                    Definir Nova Senha
                </h1>
                
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label
                            htmlFor="newPassword"
                            className="block text-base font-medium text-gray-700"
                        >
                            Nova Senha
                        </label>
                        <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="••••••••"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="confirmPassword"
                            className="block text-base font-medium text-gray-700"
                        >
                            Confirmar Nova Senha
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            className="mt-2 block w-full rounded-md border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="••••••••"
                        />
                    </div>
                    
                    {message && (
                        <div
                        className={`rounded-md p-3 text-sm font-medium ${
                            message.type === "success"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                        >
                        {message.content}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || message?.type === 'success'}
                        className="w-full rounded-md bg-indigo-600 px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-60"
                    >
                        {loading ? "Salvando..." : "Salvar Nova Senha"}
                    </button>
                </form>

                <div className="text-center text-sm">
                    <button
                        onClick={() => router.back()}
                        className="font-medium text-indigo-600 hover:underline"
                    >
                        Voltar para Configurações
                    </button>
                </div>

            </div>
        </div>
    );
}
