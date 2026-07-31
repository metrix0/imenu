"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faEnvelope,
    faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{
        show: boolean;
        msg: string;
        type: "success" | "error";
    }>({ show: false, msg: "", type: "success" });

    const handleResetRequest = async (event: React.FormEvent) => {
        event.preventDefault();
        const normalizedEmail = email.trim().toLowerCase();

        if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
            setToast({
                show: true,
                msg: "Digite um e-mail válido.",
                type: "error",
            });
            return;
        }

        setLoading(true);

        try {
            const redirectTo = new URL(
                "/painel/configuracoes/nova-senha",
                window.location.origin
            ).toString();

            const { error } = await supabase.auth.resetPasswordForEmail(
                normalizedEmail,
                { redirectTo }
            );

            if (error) throw error;

            setToast({
                show: true,
                msg: "Link de recuperação enviado para o e-mail!",
                type: "success",
            });
            setEmail("");
        } catch (error) {
            setToast({
                show: true,
                msg:
                    error instanceof Error
                        ? error.message
                        : "Erro ao enviar e-mail.",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col">
            <header className="z-10 flex w-full items-center justify-center bg-white px-4 py-6 sm:justify-start">
                <div className="relative h-8 w-32 sm:ml-4">
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
                        alt="iMenu Logo"
                        fill
                        className="object-contain"
                    />
                </div>
            </header>

            <div className="flex flex-1 items-center justify-center bg-gray-50 px-4 pb-20">
                <Card className="w-full max-w-md space-y-6 border border-gray-200 p-8 shadow-md">
                    <div className="space-y-2 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                            <FontAwesomeIcon
                                icon={faEnvelope}
                                className="text-xl"
                            />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Esqueceu a senha?
                        </h1>
                        <p className="text-sm text-gray-500">
                            Digite seu e-mail e enviaremos um link para você
                            redefinir sua senha.
                        </p>
                    </div>

                    <form onSubmit={handleResetRequest} className="space-y-6">
                        <Input
                            label="E-mail cadastrado"
                            placeholder="exemplo@restaurante.com"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            icon={<FontAwesomeIcon icon={faEnvelope} />}
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            className="w-full py-3"
                            loading={loading}
                            disabled={!email || loading}
                        >
                            <FontAwesomeIcon
                                icon={faPaperPlane}
                                className="mr-2"
                            />
                            Enviar Link
                        </Button>
                    </form>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => router.push("/restaurante/login")}
                            className="mx-auto flex cursor-pointer items-center justify-center gap-2 text-sm text-gray-500 transition-colors hover:text-brand"
                        >
                            <FontAwesomeIcon icon={faArrowLeft} />
                            Voltar para o Login
                        </button>
                    </div>
                </Card>
            </div>

            {toast.show && (
                <Toast
                    message={toast.msg}
                    type={toast.type}
                    onClose={() =>
                        setToast((current) => ({ ...current, show: false }))
                    }
                />
            )}
        </div>
    );
}
