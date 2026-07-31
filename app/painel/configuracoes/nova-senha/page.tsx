"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faCheck,
    faLock,
} from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";

type Message = {
    type: "error" | "success";
    content: string;
};

export default function NovaSenhaPage() {
    const router = useRouter();
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [checkingSession, setCheckingSession] = useState(true);
    const [sessionValid, setSessionValid] = useState(false);
    const [message, setMessage] = useState<Message | null>(null);

    useEffect(() => {
        let active = true;

        const establishRecoverySession = async () => {
            try {
                const currentUrl = new URL(window.location.href);
                const code = currentUrl.searchParams.get("code");

                if (code) {
                    const { error } =
                        await supabase.auth.exchangeCodeForSession(code);
                    if (error) throw error;

                    currentUrl.searchParams.delete("code");
                    window.history.replaceState(
                        null,
                        "",
                        `${currentUrl.pathname}${currentUrl.search}`
                    );
                } else {
                    const hashParams = new URLSearchParams(
                        window.location.hash.replace(/^#/, "")
                    );
                    const accessToken = hashParams.get("access_token");
                    const refreshToken = hashParams.get("refresh_token");

                    if (accessToken && refreshToken) {
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });
                        if (error) throw error;

                        window.history.replaceState(
                            null,
                            "",
                            `${window.location.pathname}${window.location.search}`
                        );
                    }
                }

                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session) {
                    throw new Error(
                        "O link de recuperação expirou ou é inválido. Solicite um novo link."
                    );
                }

                if (active) setSessionValid(true);
            } catch (error) {
                if (!active) return;
                setMessage({
                    type: "error",
                    content:
                        error instanceof Error
                            ? error.message
                            : "Não foi possível validar o link de recuperação.",
                });
            } finally {
                if (active) setCheckingSession(false);
            }
        };

        void establishRecoverySession();

        return () => {
            active = false;
        };
    }, []);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setMessage(null);

        if (newPassword.length < 6) {
            setMessage({
                type: "error",
                content: "A nova senha deve ter pelo menos 6 caracteres.",
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage({
                type: "error",
                content: "As senhas não coincidem.",
            });
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            setMessage({
                type: "success",
                content: "Senha alterada com sucesso! Redirecionando...",
            });
            setNewPassword("");
            setConfirmPassword("");

            window.setTimeout(async () => {
                await supabase.auth.signOut();
                router.replace("/restaurante/login");
            }, 1500);
        } catch (error) {
            setMessage({
                type: "error",
                content:
                    error instanceof Error
                        ? `Erro ao alterar senha: ${error.message}`
                        : "Erro ao alterar senha. Tente novamente.",
            });
        } finally {
            setLoading(false);
        }
    };

    if (checkingSession) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader className="border-t-brand" />
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <div className="mb-8 text-center">
                    <h1 className="text-2xl font-bold text-brand">
                        Alterar Senha
                    </h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Defina uma nova senha segura para sua conta.
                    </p>
                </div>

                {message && (
                    <div
                        className={`mb-6 rounded-md border p-3 text-sm ${
                            message.type === "success"
                                ? "border-green-200 bg-green-50 text-green-800"
                                : "border-red-200 bg-red-50 text-red-800"
                        }`}
                    >
                        {message.content}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Nova Senha"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Mínimo 6 caracteres"
                        value={newPassword}
                        onChange={(event) =>
                            setNewPassword(event.target.value)
                        }
                        icon={<FontAwesomeIcon icon={faLock} />}
                        required
                        disabled={!sessionValid}
                    />

                    <Input
                        label="Confirmar Nova Senha"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Repita a nova senha"
                        value={confirmPassword}
                        onChange={(event) =>
                            setConfirmPassword(event.target.value)
                        }
                        icon={<FontAwesomeIcon icon={faCheck} />}
                        required
                        disabled={!sessionValid}
                    />

                    <div className="space-y-3 pt-2">
                        <Button
                            variant="primary"
                            type="submit"
                            className="w-full"
                            loading={loading}
                            disabled={!sessionValid || loading}
                        >
                            Alterar Senha
                        </Button>

                        <Button
                            variant="secondary"
                            type="button"
                            className="w-full"
                            onClick={() =>
                                router.push("/restaurante/login")
                            }
                        >
                            <FontAwesomeIcon
                                icon={faArrowLeft}
                                className="mr-2"
                            />
                            Voltar para o Login
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
