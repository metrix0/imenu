// app/painel/configuracoes/nova-senha/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faArrowLeft, faCheck } from "@fortawesome/free-solid-svg-icons";

// UI Components
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

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
            // A função updateUser exige sessão ativa recente
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) {
                // Tratamento para sessão expirada
                if (error.status === 401 || error.message.includes("refresh")) {
                    setMessage({
                        type: "error",
                        content: "Sua sessão expirou. Por favor, faça login novamente."
                    });
                    // Opcional: redirecionar após tempo
                } else {
                    throw error;
                }
            } else {
                setMessage({ type: "success", content: "Senha alterada com sucesso! Redirecionando..." });
                setNewPassword("");
                setConfirmPassword("");

                setTimeout(() => {
                    supabase.auth.signOut(); // Logout de segurança
                    router.push("/restaurante/login");
                }, 2000);
            }
        } catch (err: any) {
            console.error("Erro ao alterar senha:", err);
            setMessage({ type: "error", content: `Erro ao alterar senha: ${err.message || "Tente novamente."}` });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-indigo-50 mb-4">
                        <FontAwesomeIcon icon={faLock} className="text-brand text-xl" />
                    </div>
                    <h1 className="text-2xl font-bold text-brand">Alterar Senha</h1>
                    <p className="text-sm text-gray-500 mt-2">
                        Defina uma nova senha segura para sua conta de administrador.
                    </p>
                </div>

                {message && (
                    <div className={`mb-6 p-3 rounded-md text-sm border ${message.type === 'success'
                            ? 'bg-green-50 text-green-800 border-green-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}>
                        {message.content}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Nova Senha"
                        type="password"
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        icon={<FontAwesomeIcon icon={faLock} />}
                        required
                    />

                    <Input
                        label="Confirmar Nova Senha"
                        type="password"
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        icon={<FontAwesomeIcon icon={faCheck} />}
                        required
                    />

                    <div className="space-y-3 pt-2">
                        <Button
                            variant="primary"
                            type="submit"
                            className="w-full"
                            loading={loading}
                        >
                            Alterar Senha
                        </Button>

                        <Button
                            variant="secondary"
                            type="button"
                            className="w-full"
                            onClick={() => router.push("/painel/configuracoes")}
                        >
                            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" /> Voltar
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}