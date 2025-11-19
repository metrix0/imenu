// app/restaurante/criar/info/otp/page.tsx
"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCreationStore } from "@/lib/creationStore";

function OtpVerificationComponent() {
    const router = useRouter();
    
    const { restaurantId, email, clear: clearCreationStore } = useCreationStore();

    const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const { value } = e.target;
        if (!/^[0-9]$/.test(value) && value !== "") return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value !== "" && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace" && otp[index] === "" && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        if (!email || !restaurantId) {
            setMessage("Sessão expirada. Volte e preencha seu e-mail novamente.");
            setLoading(false);
            return;
        }

        const token = otp.join("");
        if (token.length !== 6) {
            setMessage("O código OTP deve ter 6 dígitos.");
            setLoading(false);
            return;
        }

        try {
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token,
                type: "signup",
            });

            if (verifyError) throw new Error(verifyError.message);
            if (!verifyData.session || !verifyData.user) {
                throw new Error("Falha ao verificar o OTP. Tente novamente.");
            }
            
            const newUserId = verifyData.user.id;

            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: newUserId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Conta verificada, mas falha ao linkar ao restaurante.");
            }
            
            // 3. Painel
            clearCreationStore();
            // redireciona para painel do restaurante criado
            router.push(`/criar/disponibilidade`);

        } catch (error) {
            setMessage((error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!email) {
            setMessage("E-mail não encontrado.");
            return;
        }
        const { error } = await supabase.auth.resend({
            type: "signup",
            email: email,
        });
        if (error) {
            setMessage(`Erro ao reenviar: ${error.message}`);
        } else {
            setMessage("Um novo código foi enviado para o seu e-mail.");
        }
    };
    const isButtonDisabled = otp.join("").length !== 6 || loading;

    return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
            <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-lg">
                <h1 className="text-3xl font-bold text-center text-gray-900">
                    Validação de e-mail
                </h1>
                <p className="text-center text-gray-600">
                    Insira abaixo o código enviado para{" "}
                    <strong className="text-gray-800">{email || "seu e-mail"}</strong>
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="flex justify-center gap-2">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => { inputRefs.current[index] = el; }}
                                type="tel"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(e, index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                className="h-12 w-10 sm:w-12 rounded-md border border-gray-300 text-center text-2xl font-semibold shadow-sm"
                            />
                        ))}
                    </div>
                    <button
                        type="submit"
                        disabled={isButtonDisabled}
                        className="w-full rounded-md bg-black px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-gray-900 disabled:opacity-60"
                    >
                        {loading ? "Verificando..." : "Confirmar e Criar Conta"}
                    </button>
                </form>
                {message && (
                    <p className="text-center text-sm text-red-600">{message}</p>
                )}
                <div className="text-center text-sm text-gray-600">
                    <p>
                        Não recebeu o código?{" "}
                        <button
                            onClick={handleResend}
                            className="font-medium text-indigo-600 hover:underline"
                        >
                            Reenviar código
                        </button>
                    </p>
                    <p className="mt-2">
                        Verifique também sua caixa de spam.{" "}
                        <button
                            onClick={() => router.push("/restaurante/criar/info")}
                            className="font-medium text-indigo-600 hover:underline"
                        >
                            Voltar
                        </button>
                    </p>
                </div>
            </div>
        </main>
    );
}

export default function OtpPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
            <OtpVerificationComponent />
        </Suspense>
    );
}