// app/painel/configuracoes/nova-senha/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";

export default function NovaSenhaPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: "error" | "success"; content: string } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (newPassword.length < 6) {
            setMessage({ type: "error", content: "A nova senha deve ter pelo menos 6 caracteres." });
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage({ type: "error", content: "As senhas não coincidem." });
            return;
        }

        setLoading(true);

        try {
            // A função updateUser (sem a senha antiga) exige que o usuário tenha feito login recentemente.
            // Se o usuário não tiver uma sessão recente, o Supabase retornará um erro exigindo reautenticação.
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                // Se a sessão expirou, o erro será algo como "JWT expired" ou "Stale user session"
                if (error.status === 401 || error.message.includes("refresh")) {
                    setMessage({
                        type: "error",
                        content: "Sua sessão expirou. Por favor, faça login novamente para alterar a senha."
                    });
                    // Opcional: Redirecionar para o login
                    // setTimeout(() => router.push("/admin/login"), 3000); 
                } else {
                    throw error;
                }
            } else {
                setMessage({ type: "success", content: "Senha alterada com sucesso! Redirecionando..." });
                setTimeout(() => {
                    // Limpa a sessão (opcional, mas recomendado) e redireciona
                    supabase.auth.signOut();
                    router.push("/restaurante/login");
                }, 3000);
            }
        } catch (err: any) {
            console.error("Erro ao alterar senha:", err);
            setMessage({ type: "error", content: `Erro ao alterar senha: ${err.message || "Tente novamente."}` });
        } finally {
            setLoading(false);
        }
    };

    const getMessageClasses = (type: "error" | "success") => {
        return type === "success"
            ? "bg-green-100 text-green-800 border border-green-300"
            : "bg-red-100 text-red-800 border border-red-300";
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-gray-50">
            <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
                <h1 className="text-2xl font-bold text-center text-gray-900">
                    Alterar Senha
                </h1>
                <p className="text-center text-gray-600">
                    Defina uma nova senha para sua conta de administrador.
                </p>

                {message && (
                    <div className={`rounded-md p-3 text-sm font-medium ${getMessageClasses(message.type)}`}>
                        {message.content}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                            Nova Senha (Mínimo 6 caracteres)
                        </label>
                        <input
                            id="newPassword"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="••••••••"
                        />
                    </div>
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                            Confirmar Nova Senha
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            minLength={6}
                            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <FontAwesomeIcon icon={icons.faSpinner} spin />
                                Alterando...
                            </>
                        ) : (
                            "Alterar Senha"
                        )}
                    </button>
                </form>

                <div className="text-center">
                    <button
                        onClick={() => router.push("/painel/configuracoes")}
                        className="text-sm text-gray-600 hover:text-indigo-600"
                    >
                        <FontAwesomeIcon icon={icons.faArrowLeft} className="mr-1" /> Voltar para Configurações
                    </button>
                </div>
            </div>
        </div>
    );
}