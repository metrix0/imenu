// app/restaurante/login/esqueci-senha/page.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";

// UI
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";

// Icons
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEnvelope, faArrowLeft, faPaperPlane } from "@fortawesome/free-solid-svg-icons";

export default function ForgotPasswordPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, msg: string, type: "success" | "error" }>({
        show: false, msg: "", type: "success"
    });

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.includes("@")) return;

        setLoading(true);
        try {
            // Define a URL para onde o usuário voltará (Página de Nova Senha)
            // Usa window.location.origin para funcionar em localhost e produção
            const redirectTo = `${window.location.origin}/restaurante/login/nova-senha`;

            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: redirectTo,
            });

            if (error) throw error;

            setToast({ show: true, msg: "Link de recuperação enviado para o e-mail!", type: "success" });
            
            // Opcional: Limpar campo
            setEmail("");
            
        } catch (err: any) {
            setToast({ show: true, msg: err.message || "Erro ao enviar e-mail.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header Simples */}
            <header className="w-full px-4 py-6 flex items-center justify-center sm:justify-start bg-white z-10">
                <div className="relative h-8 w-32 sm:ml-4">
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
                        alt="iMenu Logo"
                        fill
                        className="object-contain"
                    />
                </div>
            </header>

            <div className="flex-1 flex items-center justify-center px-4 bg-gray-50 pb-20">
                <Card className="w-full max-w-md p-8 space-y-6 shadow-md border border-gray-200">
                    <div className="text-center space-y-2">
                        <div className="w-12 h-12 bg-brand/10 text-brand rounded-full flex items-center justify-center mx-auto mb-4">
                            <FontAwesomeIcon icon={faEnvelope} className="text-xl" />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">Esqueceu a senha?</h1>
                        <p className="text-gray-500 text-sm">
                            Digite seu e-mail e enviaremos um link para você redefinir sua senha.
                        </p>
                    </div>

                    <form onSubmit={handleResetRequest} className="space-y-6">
                        <Input
                            label="E-mail cadastrado"
                            placeholder="exemplo@restaurante.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            icon={<FontAwesomeIcon icon={faEnvelope} />}
                        />

                        <Button 
                            variant="primary" 
                            className="w-full py-3" 
                            loading={loading}
                            disabled={!email || loading}
                        >
                            <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                            Enviar Link
                        </Button>
                    </form>

                    <div className="text-center">
                        <button 
                            onClick={() => router.push("/restaurante/login")}
                            className="text-sm text-gray-500 hover:text-brand transition-colors flex items-center justify-center gap-2 mx-auto"
                        >
                            <FontAwesomeIcon icon={faArrowLeft} /> Voltar para o Login
                        </button>
                    </div>
                </Card>
            </div>

            {toast.show && (
                <Toast 
                    message={toast.msg} 
                    type={toast.type} 
                    onClose={() => setToast({ ...toast, show: false })} 
                />
            )}
        </div>
    );
}