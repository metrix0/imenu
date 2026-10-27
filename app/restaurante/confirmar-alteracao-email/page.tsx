"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import { supabase } from "@/lib/database/supabaseClient";

type ConfirmationResult = "pending" | "complete";
type PageState = "loading" | ConfirmationResult | "error";

async function confirmEmailChange(): Promise<ConfirmationResult> {
    const url = new URL(window.location.href);
    const query = url.searchParams;
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

    try {
        if (
            query.get("error") ||
            query.get("error_description") ||
            hash.get("error") ||
            hash.get("error_description")
        ) {
            throw new Error("Este link de confirmação expirou ou é inválido.");
        }

        const code = query.get("code");
        const accessToken = hash.get("access_token");
        const refreshToken = hash.get("refresh_token");
        const tokenHash = query.get("token_hash");
        const type = query.get("type");

        if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
        } else if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });
            if (error) throw error;
        } else if (tokenHash && type === "email_change") {
            const { error } = await supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: "email_change",
            });
            if (error) throw error;
        } else if (query.get("message") || hash.get("message")) {
            // Secure email changes can acknowledge the first link without a session.
            return "pending";
        } else {
            throw new Error("Link de confirmação incompleto.");
        }

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error || !user) {
            throw new Error("Não foi possível verificar a alteração do e-mail.");
        }

        const pendingEmail = (user as typeof user & { new_email?: string }).new_email;
        return pendingEmail && pendingEmail !== user.email
            ? "pending"
            : "complete";
    } finally {
        // Do not retain codes or auth tokens in the address bar.
        window.history.replaceState(null, document.title, url.pathname);
    }
}

export default function ConfirmarAlteracaoEmailPage() {
    const router = useRouter();
    const confirmation = useRef<Promise<ConfirmationResult> | null>(null);
    const [state, setState] = useState<PageState>("loading");

    useEffect(() => {
        // Keep one confirmation request even when React re-runs effects.
        if (!confirmation.current) {
            confirmation.current = confirmEmailChange();
        }

        let active = true;
        void confirmation.current
            .then((result) => {
                if (active) setState(result);
            })
            .catch(() => {
                if (active) setState("error");
            });

        return () => {
            active = false;
        };
    }, []);

    const loading = state === "loading";
    const pending = state === "pending";
    const failed = state === "error";

    return (
        <div className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-4 py-10">
            <Card className="w-full max-w-md p-6 text-center">
                {loading ? (
                    <div className="flex flex-col items-center gap-4 py-5">
                        <Loader className="border-t-brand" />
                        <h1 className="text-xl font-semibold text-gray-900">
                            Confirmando alteração de e-mail...
                        </h1>
                    </div>
                ) : (
                    <>
                        <h1 className="text-xl font-semibold text-gray-900">
                            {failed
                                ? "Não foi possível confirmar o e-mail"
                                : pending
                                  ? "Confirmação recebida"
                                  : "E-mail atualizado!"}
                        </h1>
                        <p className="mt-3 text-sm leading-relaxed text-gray-600">
                            {failed
                                ? "O link pode ter expirado ou ser inválido. Entre na sua conta e solicite a alteração novamente."
                                : pending
                                  ? "Para concluir a troca, confirme também o link enviado ao outro endereço de e-mail."
                                  : "A alteração foi concluída. Você já pode usar o novo e-mail para acessar sua conta."}
                        </p>
                        <Button
                            className="mt-6 w-full"
                            onClick={() =>
                                router.replace(
                                    failed || pending
                                        ? "/restaurante/login"
                                        : "/painel/configuracoes"
                                )
                            }
                        >
                            {failed || pending ? "Ir para o login" : "Ir para configurações"}
                        </Button>
                    </>
                )}
            </Card>
        </div>
    );
}
