// app/painel/configuracoes/atualizar-email/page.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";

// Alteramos o fluxo de estados para Link de Confirmação
type Stage = "INPUT_EMAIL" | "AWAITING_CONFIRMATION" | "SUCCESS";

export default function UpdateEmailPage() {
    const router = useRouter();

    const [stage, setStage] = useState<Stage>("INPUT_EMAIL");
    const [currentEmail, setCurrentEmail] = useState<string>("");
    const [newEmail, setNewEmail] = useState<string>("");

    // Removidas as variáveis e refs relacionadas ao OTP
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string>("");

    // URL para onde o Supabase deve redirecionar após o clique no link de confirmação
    // É crucial que esta URL aponte para uma página que finalize o processo (ex: /auth/callback)
    const REDIRECT_URL = `${window.location.origin}/painel/configuracoes?email_updated=true`;

    // Carrega o e-mail atual do usuário (client-side)
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

    // ------------------------------
    // ETAPA 1 — Validar e solicitar LINK de Confirmação
    // ------------------------------
    const handleRequestConfirmationLink = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage("");

        const cleaned = (newEmail || "").trim().toLowerCase();
        if (!cleaned || cleaned === currentEmail) {
            setMessage("Insira um novo e-mail válido diferente do atual.");
            return;
        }

        setLoading(true);

        try {
            // ---------- 1) VERIFICAR DUPLICIDADE DE E-MAIL ----------
            // Bloqueia se o e-mail já estiver em uso por outro usuário/restaurante.

            // Verifica na sua tabela 'users' (ou similar)
            const { data: foundUser, error: usersError } = await supabase
                .from("users")
                .select("id,email")
                .eq("email", cleaned)
                .maybeSingle();

            // Lógica de verificação de duplicidade mantida
            if (foundUser) {
                const { data: existingRestaurant } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", foundUser.id)
                    .maybeSingle();

                if (existingRestaurant) {
                    setMessage("Este e-mail já está cadastrado em outra conta que possui restaurante.");
                    setLoading(false);
                    return;
                }
            } else if (usersError) {
                // Erro se a view 'users' não existe ou erro de permissão. 
                // Permite seguir, mas avisa o desenvolvedor no console.
                console.warn("Aviso: Falha ao verificar e-mail globalmente (users view). Procedendo...", usersError);
            }

            // ---------- 2) INICIA A TROCA DE E-MAIL (ENVIA O LINK) ----------
            // Este método envia um link de confirmação para o novo e-mail.
            const { error: updateAuthError } = await supabase.auth.updateUser({
                email: cleaned,
            }, {
                emailRedirectTo: REDIRECT_URL, // Redireciona para esta URL após o clique no link
            });

            if (updateAuthError) {
                console.error("updateUser error:", updateAuthError);
                if (updateAuthError.message.includes("Email already taken")) {
                    setMessage("Este e-mail já está em uso por outro usuário.");
                } else {
                    setMessage(`Erro ao solicitar troca: ${updateAuthError.message}`);
                }
                setLoading(false);
                return;
            }

            // Sucesso: instruir o usuário a verificar o e-mail
            setNewEmail(cleaned);
            setStage("AWAITING_CONFIRMATION");

        } catch (err: any) {
            console.error("handleRequestConfirmationLink unexpected:", err);
            setMessage("Erro inesperado. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    // --- Funções de OTP (handleOtpChange, handleKeyDown, handlePaste) foram removidas, pois não são mais necessárias ---
    // --- A função handleVerifyOtp também foi removida, pois a verificação é feita pelo Supabase após o clique no link ---


    // ------------------------------ UI: Tela 1 - Inserir Email ------------------------------
    if (stage === "INPUT_EMAIL") {
        return (
            <div className="flex min-h-screen justify-center items-center p-6 bg-gray-50">
                <div className="w-full max-w-md space-y-6">
                    <h1 className="text-2xl font-bold text-center text-gray-900">Atualizar E-mail</h1>

                    {message && <div className="p-3 bg-red-100 text-red-700 rounded text-sm">{message}</div>}

                    <form onSubmit={handleRequestConfirmationLink} className="space-y-4">
                        <p className="text-sm text-gray-600">Seu e-mail atual é <b>{currentEmail}</b>.</p>

                        <input
                            type="email"
                            placeholder="novo.email@dominio.com"
                            value={newEmail}
                            onChange={(e) => setNewEmail(e.target.value)}
                            className="w-full border rounded px-3 py-2"
                        />

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700"
                        >
                            {loading ? "Enviando link..." : "Enviar Link de Confirmação"}
                        </button>
                    </form>

                    <button onClick={() => router.push("/painel/configuracoes")} className="text-sm text-gray-600 hover:text-indigo-600">
                        Voltar
                    </button>
                </div>
            </div>
        );
    }

    // ------------------------------ UI: Tela 2 - Aguardando Confirmação ------------------------------
    if (stage === "AWAITING_CONFIRMATION") {
        return (
            <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
                <div className="bg-white border rounded-lg shadow p-10 w-full max-w-md text-center">
                    <FontAwesomeIcon icon={icons.faEnvelope} className="text-indigo-600 text-5xl mb-4" />
                    <h2 className="text-xl font-bold mb-4">Verifique seu E-mail</h2>
                    <p className="text-gray-600 mb-6">
                        Enviamos um link de confirmação para <b>{newEmail}</b>.
                        Por favor, clique no link para completar a troca.
                    </p>
                    <button
                        onClick={() => setStage("INPUT_EMAIL")}
                        className="text-sm text-indigo-600 hover:text-indigo-700 mt-4"
                    >
                        Trocar e-mail ou re-enviar link
                    </button>
                </div>
            </main>
        );
    }

    // ------------------------------ UI: Tela 3 - Sucesso (Esta tela é opcional, pois o link redireciona) ------------------------------
    if (stage === "SUCCESS") {
        return (
            <div className="flex min-h-screen justify-center items-center p-6 bg-gray-50">
                <div className="text-center space-y-4">
                    <FontAwesomeIcon icon={icons.faCheckCircle} className="text-green-600 text-5xl" />
                    <h2 className="text-xl font-semibold">E-mail atualizado!</h2>
                    <p className="text-gray-600">Redirecionando para configurações…</p>
                </div>
            </div>
        );
    }

    return null;
}