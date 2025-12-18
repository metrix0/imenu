// app/painel/configuracoes/atualizar-email/page.tsx
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { faEnvelope, faCheckCircle, faArrowLeft } from "@fortawesome/free-solid-svg-icons";

// UI Components
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

// Tipos de Estado
type Stage = "INPUT_EMAIL" | "AWAITING_CONFIRMATION" | "SUCCESS";

export default function UpdateEmailPage() {
    const router = useRouter();

    const [stage, setStage] = useState<Stage>("INPUT_EMAIL");
    const [currentEmail, setCurrentEmail] = useState<string>("");
    const [newEmail, setNewEmail] = useState<string>("");

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string>("");

    // URL de redirecionamento após clique no e-mail
    const REDIRECT_URL = typeof window !== "undefined"
        ? `${window.location.origin}/painel/configuracoes?email_updated=true`
        : "";

    // Carrega e-mail atual
    useEffect(() => {
        (async () => {
            const { data } = await supabase.auth.getUser();
            if (!data?.user) {
                router.push("/admin/login");
                return;
            }
            setCurrentEmail(data.user.email ?? "");
        })();
    }, [router]);

    // Handler de envio
    const handleRequestConfirmationLink = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setMessage("");

        const cleaned = (newEmail || "").trim().toLowerCase();

        if (!cleaned) {
            setMessage("Por favor, digite o novo e-mail.");
            return;
        }
        if (cleaned === currentEmail) {
            setMessage("O novo e-mail deve ser diferente do atual.");
            return;
        }

        setLoading(true);

        try {
            // 1. Verificar duplicidade na tabela users (opcional, mas recomendado)
            const { data: foundUser, error: usersError } = await supabase
                .from("users")
                .select("id,email")
                .eq("email", cleaned)
                .maybeSingle();

            if (foundUser) {
                const { data: existingRestaurant } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", foundUser.id)
                    .maybeSingle();

                if (existingRestaurant) {
                    setMessage("Este e-mail já está cadastrado em outra conta.");
                    setLoading(false);
                    return;
                }
            } else if (usersError) {
                console.warn("Erro ao verificar users view:", usersError);
            }

            // 2. Update Auth
            const { error: updateAuthError } = await supabase.auth.updateUser({
                email: cleaned,
            }, {
                emailRedirectTo: REDIRECT_URL,
            });

            if (updateAuthError) {
                console.error("updateUser error:", updateAuthError);
                if (updateAuthError.message.includes("Email already taken")) {
                    setMessage("Este e-mail já está em uso.");
                } else {
                    setMessage(`Erro ao solicitar troca: e-mail em uso ou não existe`);
                }
                return;
            }

            // Sucesso
            setNewEmail(cleaned);
            setStage("AWAITING_CONFIRMATION");

        } catch (err: any) {
            console.error("Erro inesperado:", err);
            setMessage("Ocorreu um erro inesperado. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    // ------------------------------
    // RENDERIZAÇÃO
    // ------------------------------

    // 1. Tela de Input
    if (stage === "INPUT_EMAIL") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md">
                    <div className="text-center mb-6">
                        <h1 className="text-2xl font-bold text-brand">Atualizar E-mail</h1>
                        <p className="text-sm text-gray-500 mt-2">
                            Seu e-mail atual é <span className="font-medium text-gray-900">{currentEmail}</span>
                        </p>
                    </div>

                    {message && (
                        <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
                            {message}
                        </div>
                    )}

                    <form onSubmit={handleRequestConfirmationLink} className="space-y-6">
                        <Input
                            label="Novo E-mail"
                            type="email"
                            placeholder="exemplo@loja.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            icon={<FontAwesomeIcon icon={icons.faEnvelope} />}
                        />

                        <div className="space-y-3">
                            <Button
                                variant="primary"
                                type="submit" // Garante submit no Enter
                                loading={loading}
                                className="w-full"
                            >
                                Enviar Link de Confirmação
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

    // 2. Tela de Aguardando Confirmação
    if (stage === "AWAITING_CONFIRMATION") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md text-center py-10">
                    <div className="mb-6 flex justify-center">
                        <div className="h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faEnvelope} className="text-brand text-3xl" />
                        </div>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900 mb-3">Verifique seu E-mail</h2>

                    <p className="text-gray-600 mb-8 leading-relaxed">
                        Enviamos um link de confirmação para:<br />
                        <strong className="text-gray-900">{newEmail}</strong>
                        <br /><br />
                        Por favor, clique no link enviado para confirmar a alteração.
                    </p>

                    <Button
                        variant="secondary"
                        onClick={() => setStage("INPUT_EMAIL")}
                        className="w-full"
                    >
                        Corrigir e-mail ou tentar novamente
                    </Button>
                </Card>
            </div>
        );
    }

    // 3. Tela de Sucesso (Opcional, caso o redirecionamento falhe ou seja rápido)
    if (stage === "SUCCESS") {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <Card className="w-full max-w-md text-center py-10">
                    <div className="mb-6 flex justify-center">
                        <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 text-5xl" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 mb-2">E-mail atualizado!</h2>
                    <p className="text-gray-500">Redirecionando para configurações...</p>
                </Card>
            </div>
        );
    }

    return null;
}