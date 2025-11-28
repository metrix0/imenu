// restaurante/criar/info/otp/page.tsx

"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useCreationStore } from "@/lib/creationStore";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

function OtpVerificationComponent() {
    const router = useRouter();
    const { restaurantId, email, clear } = useCreationStore();

    const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

      // --- LÓGICA PARA BARRA FIXA INTELIGENTE ---
  const [isAtBottom, setIsAtBottom] = useState(false);
  const footerSentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (inputRefs.current[0]) {
            inputRefs.current[0]?.focus();
        }
        const observer = new IntersectionObserver(
      ([entry]) => {
        // Se o final da página está visível, mudamos o estado
        setIsAtBottom(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0, 
        rootMargin: "0px" // Pode ajustar para "10px" se quiser que pare um pouco antes
      }
    );

    if (footerSentinelRef.current) {
      observer.observe(footerSentinelRef.current);
    }

    return () => {
      if (footerSentinelRef.current) observer.unobserve(footerSentinelRef.current);
    };

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

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData("text").trim();
        const cleanPaste = pasteData.replace(/[^0-9]/g, "").slice(0, 6);

        if (cleanPaste) {
            const newOtp = [...otp];
            const digits = cleanPaste.split("");
            digits.forEach((digit, i) => { if (i < 6) newOtp[i] = digit; });
            setOtp(newOtp);
            const focusIndex = Math.min(digits.length, 5);
            inputRefs.current[focusIndex]?.focus();
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        setMessage("");

        if (!email || !restaurantId) {
            setMessage("Sessão expirada.");
            setLoading(false);
            return;
        }

        const token = otp.join("");
        if (token.length !== 6) {
            setMessage("O código deve ter 6 dígitos.");
            setLoading(false);
            return;
        }

        try {
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token,
                type: "email",
            });

            if (verifyError) throw new Error("Código inválido ou expirado.");
            if (!verifyData.user) throw new Error("Falha na verificação.");

            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ user_id: verifyData.user.id }),
            });

            if (!response.ok) throw new Error("Erro ao vincular conta.");

            // ALTERAÇÃO AQUI: Redireciona para o painel de pedidos específico
            router.push(`/painel`);
            
        } catch (error) {
            setMessage((error as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (!email) return;
        const { error } = await supabase.auth.resend({ type: "signup", email });
        setMessage(error ? "Erro ao reenviar." : "Novo código enviado!");
    };



    const isButtonDisabled = otp.join("").length !== 6 || loading;

    return (
        // Ajustei o padding-top para pt-8 para ficar mais próximo ao header como pedido
       <div className="min-h-screen flex flex-col bg-white relative">
        <main className="flex-1 flex flex-col items-center justify-start pt-8 px-4 pb-32 sm:pt-16">
            
            <Card className="w-full max-w-2xl p-6 sm:p-12 md:p-20 shadow-sm border border-gray-200 text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Validação de e-mail</h1>

                <div className="flex items-center justify-center gap-2 text-gray-600 mb-8">
                    <span>Insira abaixo o código enviado para</span>
                </div>
                
                {/* Email com ícone de edição */}
                <div className="flex items-center justify-center gap-2 -mt-6 mb-8">
                    <strong className="text-gray-800">{email || "seu e-mail"}</strong>
                    <button 
                        onClick={() => router.push("/restaurante")} 
                        className="text-gray-400 hover:text-brand transition-colors"
                        title="Corrigir e-mail"
                    >
                        <FontAwesomeIcon icon={faEdit} className="cursor-pointer" />
                    </button>
                </div>

                {/* Inputs OTP */}
                <div className="flex justify-center gap-3 mb-6">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={(el) => { inputRefs.current[index] = el; }}
                            type="tel"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleChange(e, index)}
                            onKeyDown={(e) => handleKeyDown(e, index)}
                            onPaste={handlePaste}
                            className="h-14 w-12 rounded-md border border-gray-300 text-center text-2xl font-normal text-gray-700 shadow-sm focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none transition-all"
                        />
                    ))}
                </div>

                {/* Reenviar Código */}
                <button 
                    onClick={handleResend} 
                    className="font-bold text-brand hover:opacity-80 text-sm mb-8 block w-fit mx-auto text-center cursor-pointer"
                >
                    Reenviar código
                </button>

                {message && (
                    <div className={`mb-6 p-2 rounded text-sm ${message.includes("enviado") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                        {message}
                    </div>
                )}


                {/* Aviso de Spam */}
                <div className="flex items-start justify-center gap-3 text-gray-500 text-xs text-left max-w-xs mx-auto">
                    <FontAwesomeIcon icon={faExclamationCircle} className="text-lg mt-0.5 flex-shrink-0" />
                    <p>
                        Verifique se o e-mail fornecido está correto. <br />
                        Além disso, não se esqueça de conferir sua caixa de spam.
                    </p>
                </div>
            </Card>
            
            </main>
            <div ref={footerSentinelRef} className="absolute  bottom-0 w-full h-px pointer-events-none opacity-0" />

            {/* Footer Bar Sticky */}
            <footer 
        className={`sticky w-full bg-white border-t border-gray-200 px-6 py-4  transition-all duration-200 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]
            ${isAtBottom ? "absolute bottom-0" : "fixed bottom-0"}`}
      >
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex-1">

                    </div>
                    <div className=" mx-auto ">
                        <Button
                            onClick={handleSubmit}
                            variant={isButtonDisabled ? "secondary" : "primary"}
                            disabled={isButtonDisabled}
                            className="w-full sm:w-auto px-8 py-3 text-base disabled:pointer-events-none disabled:opacity-50"
                        >
                            {loading ? "Verificando..." : "Cadastrar"}
                        </Button>
                    </div>
                </div>
            </footer>
        
        </div>
        
    );
}

export default function OtpPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>}>
            <OtpVerificationComponent />
        </Suspense>
    );
}