"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient"; 
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; 
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEdit, faExclamationCircle } from "@fortawesome/free-solid-svg-icons";

function OtpVerificationComponent() {
    const router = useRouter();


    const { restaurantId, setRestaurantId, email, clear } = useCreationStore();

    const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true); // Loading inicial da verificação
    const [message, setMessage] = useState("");
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // --- ESTADO DO TIMER ---
    const [resendTimer, setResendTimer] = useState(0);
    
    const hasSentOtp = useRef(false);

    // --- 1. VERIFICAÇÃO DE STATUS AO CARREGAR ---
    useEffect(() => {
        const checkStatusAndInit = async () => {
            setPageLoading(true);
            
            // Verifica sessão básica
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                // Sem sessão, não tem como validar nada
                alert("Sessão inválida.")
                router.replace("/restaurante/login");
                return;
            }


            const targetEmail = email || session?.user?.email;
            
            // 2. Tenta recuperar o ID do Restaurante (Store OU Banco)
            let targetRestaurantId = restaurantId;

            if (!targetRestaurantId) {
                console.log("Store vazio (hidratação), buscando no banco...");
                const { data: rest } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .maybeSingle();
                
                if (rest) {
                    targetRestaurantId = rest.id;
                    setRestaurantId(rest.id); // Ressincroniza o store
                }
            }

            // AGORA sim, se depois de tentar buscar no banco ainda for null, redireciona
            if (!targetRestaurantId) {
                console.error("Nenhum restaurante encontrado para este usuário.");
                router.replace("/restaurante/login");
                return;
            }

            // 3. Checa o status `first_time` no banco
            const { data: restaurantData } = await supabase
                .from("restaurants")
                .select("first_time")
                .eq("id", targetRestaurantId) // Usa a variável local garantida
                .single();

            // Se first_time for FALSE, ele já terminou o cadastro. Manda pro painel.
            if (restaurantData && restaurantData.first_time === false) {
                clear(); 
                router.replace("/painel");
                return;
            }

            // Se chegou aqui, envia o OTP
            if (targetEmail && !hasSentOtp.current) {
                hasSentOtp.current = true;
                handleSendOtp(targetEmail);
            }
            
            setPageLoading(false);
            
            setTimeout(() => inputRefs.current[0]?.focus(), 100);
        };

        checkStatusAndInit();
        
    }, []); // Dependências vazias para rodar apenas na montagem

    // --- TIMER EFFECT ---
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const handleSendOtp = async (emailToSend: string) => {
        setResendTimer(60);
        const { error } = await supabase.auth.signInWithOtp({
            email: emailToSend,
            options: { shouldCreateUser: false }
        });
        if (error) {
            setMessage("Erro ao enviar código: " + error.message);
        }
        else {
            if (message.includes("Erro")) setMessage("");
        }
    };

    // ... (handleChange, handleKeyDown, handlePaste mantidos iguais) ...
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const { value } = e.target;
        if (!/^[0-9]$/.test(value) && value !== "") return;
        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);
        if (value !== "" && index < 5) inputRefs.current[index + 1]?.focus();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace" && otp[index] === "" && index > 0) inputRefs.current[index - 1]?.focus();
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
            // 1. Verifica Código no Supabase Auth
            const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
                email,
                token,
                type: "email",
            });

            if (verifyError) throw new Error("Código inválido ou expirado.");
            if (!verifyData.user) throw new Error("Falha na verificação.");

            // 2. Atualiza o Restaurante: Vincula User ID e marca first_time = FALSE
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    user_id: verifyData.user.id
                }),
            });

            if (!response.ok) throw new Error("Erro ao finalizar cadastro.");

            // 3. Limpeza e Redirecionamento
            clear(); 
            router.push(`/painel`);
            
        } catch (error) {
            setMessage((error as Error).message);
            setLoading(false); // Só para loading se der erro
        }
    };

    const handleResend = async () => {
        if (email) {
            await handleSendOtp(email);
            setMessage("Código reenviado!");
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        clear(); 
        router.push("/restaurante/login");
    };

    // Se estiver verificando o status inicial, mostra loading
    if (pageLoading) {
        return <div className="min-h-screen flex items-center justify-center text-gray-500">Verificando status...</div>;
    }

    const isButtonDisabled = otp.join("").length !== 6 || loading;

    return (
        <main className="flex flex-col items-center justify-start p-6 bg-gray-50 flex-1 min-h-[calc(100vh-80px)]">
            
            <Card className="w-full max-w-2xl p-20 shadow-sm border border-gray-200 text-center">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Validação de e-mail</h1>

                <div className="flex items-center justify-center gap-2 text-gray-600 mb-8">
                    <span>Insira abaixo o código enviado para</span>
                </div>
                
                <div className="flex items-center justify-center gap-2 -mt-6 mb-8">
                    <strong className="text-gray-800">{email || "seu e-mail"}</strong>
                    <button 
                        onClick={() => router.push("/restaurante/registrar")} 
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

                {/* BOTÃO DE REENVIAR COM TIMER */}
                <button 
                    onClick={handleResend} 
                    disabled={resendTimer > 0}
                    className={`text-sm mb-8 block w-fit mx-auto text-center transition-colors ${
                        resendTimer > 0 
                            ? "text-gray-400 cursor-not-allowed font-medium" 
                            : "font-bold text-brand hover:opacity-80 cursor-pointer"
                    }`}
                >
                    {resendTimer > 0 
                        ? `Solicitar novo código em ${resendTimer}s` 
                        : "Reenviar código"
                    }
                </button>

                {message && (
                    <div className={`mb-6 p-2 rounded text-sm ${message.toLowerCase().includes("erro") || message.toLowerCase().includes("inválido") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                        {message}
                    </div>
                )}

                <div className="flex items-start justify-center gap-3 text-gray-500 text-xs text-left max-w-xs mx-auto">
                    <FontAwesomeIcon icon={faExclamationCircle} className="text-lg mt-0.5 flex-shrink-0" />
                    <p>
                        Verifique se o e-mail fornecido está correto. <br />
                        Além disso, não se esqueça de conferir sua caixa de spam.
                    </p>
                </div>
            </Card>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-40">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div>

                    </div>
                    
                    <Button
                        onClick={handleSubmit}
                        variant={isButtonDisabled ? "secondary" : "primary"}
                        disabled={isButtonDisabled}
                        className="px-8 min-w-[120px] disabled:opacity-80 disabled:pointer-events-none"
                    >
                        {loading ? "Verificando..." : "Cadastrar"}
                    </Button>
                </div>
            </div>
        </main>
    );
}

export default function OtpPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">Carregando...</div>}>
            <OtpVerificationComponent />
        </Suspense>
    );
}