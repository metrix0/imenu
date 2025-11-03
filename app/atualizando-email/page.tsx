// app/atualizando-email/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function EmailChangeCallbackPage() {
    const router = useRouter();
    const [message, setMessage] = useState("Processando sua solicitação...");
    const [status, setStatus] = useState<"loading" | "success" | "info" | "error">("loading");
    
    
    const [isHandled, setIsHandled] = useState(false);

    const handleSuccess = () => {
        if (isHandled) return;
        setIsHandled(true);
        
        setStatus("success");
        setMessage("E-mail atualizado com sucesso! Redirecionando para suas configurações...");

        setTimeout(() => {
            router.push("/configuracoes/conta");
        }, 3000);
    };

    useEffect(() => {
        const hash = window.location.hash;

        // ---
        // CASE 1: FIRST EMAIL LINK
        // (Supabase doesnt consume hash)
        // ---
        if (hash.includes("message=Confirmation+link+accepted")) {
            if (isHandled) return;
            setIsHandled(true);

            setStatus("info");
            setMessage("Confirmação inicial recebida. Por favor, verifique seu outro e-mail para concluir a alteração.");
            
            
            if (window.history.replaceState) {
                window.history.replaceState(null, "", window.location.pathname);
            }
            return; 
        }

        // ---
        // CASE 2: SECOND EMAIL LINK OR INVALID ACESS
        // (supabse already consumed)
        // ---

      
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "USER_UPDATED" && session) {
                handleSuccess(); 
            }
        });

        
        const checkSessionFallback = async () => {
            
            await new Promise(resolve => setTimeout(resolve, 250));
            
            if (isHandled) return; 

            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                // VALID SESSION
                handleSuccess();
            } else {
                // NO SESSION
                if (isHandled) return;
                setIsHandled(true);
                
                setStatus("error");
                setMessage("Link de confirmação inválido ou expirado. Redirecionando...");
                setTimeout(() => {
                    router.push("/configuracoes/conta");
                }, 3000);
            }
        };

        checkSessionFallback();


        return () => {
            subscription.unsubscribe();
        };

    }, [router, isHandled]);



    const messageColor = {
        loading: "text-gray-700",
        info: "text-black",
        success: "text-green-700",
        error: "text-red-700",
    }[status];

    return (
        <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
            <div className="w-full max-w-md space-y-4">
                <h1 className={`text-2xl font-bold ${messageColor}`}>
                    {status === "loading" && "Aguardando confirmação..."}
                    {status === "info" && "Quase lá!"}
                    {status === "success" && "Sucesso!"}
                    {status === "error" && "Erro"}
                </h1>
                <p 
                    className={`text-lg ${messageColor}`}
                    dangerouslySetInnerHTML={{ __html: message }}
                />
            </div>
        </div>
    );
}