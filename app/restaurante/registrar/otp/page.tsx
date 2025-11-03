// app/registro/otp/page.tsx
"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabaseClient";

function OtpVerificationComponent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const email = searchParams.get("email");

    const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
       
        inputRefs.current[0]?.focus();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const { value } = e.target;

        //Allow only numbers e limit by 1 value
        if (!/^[0-9]$/.test(value) && value !== "") return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Go to next input
        if (value !== "" && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        // By backspacing goes to the previous input
        if (e.key === "Backspace" && otp[index] === "" && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        if (!email) {
            setMessage("E-mail não encontrado. Volte e tente novamente.");
            setLoading(false);
            return;
        }

        const token = otp.join("");
        if (token.length !== 6) {
            setMessage("O código OTP deve ter 6 dígitos.");
            setLoading(false);
            return;
        }

        const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: "signup",
        });

        if (error) {
            setMessage(`Erro: ${error.message}`);
        } else if (data.session) {
            router.push("/restaurante/criar");
        } else {
            setMessage("Falha ao verificar o OTP. Tente novamente.");
        }

        setLoading(false);
    };

    const handleResend = async () => {
        if (!email) {
            setMessage("E-mail não encontrado.");
            return;
        }
        
        // Re-send OTP
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
                    {/* OTP Inputs */}
                    <div className="flex justify-center gap-2">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(el) => { inputRefs.current[index] = el; }}
                                type="tel" // better for mobile
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleChange(e, index)}
                                onKeyDown={(e) => handleKeyDown(e, index)}
                                className="h-12 w-10 sm:w-12 rounded-md border border-gray-300 text-center text-2xl font-semibold shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        ))}
                    </div>

                    <button
                        type="submit"
                        disabled={isButtonDisabled}
                        className="w-full rounded-md bg-black px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black disabled:opacity-60"
                    >
                        {loading ? "Verificando..." : "Cadastrar"}
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
                        Verifique também sua caixa de spam ou verificar se o email fornecido está correto.{" "}

                    </p>
                                            <button
                            onClick={() => router.push("/restaurante/registrar")}
                            className="font-medium text-indigo-600 hover:underline"
                        >
                            Voltar
                        </button>
                        
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

