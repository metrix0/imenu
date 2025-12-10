// app/restaurante/login/nova-senha/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";

import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLock, faCheck } from "@fortawesome/free-solid-svg-icons";

export default function NewPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ show: boolean, msg: string, type: "success" | "error" }>({
        show: false, msg: "", type: "success"
    });

    // Verifica se o usuário chegou aqui autenticado (pelo link do email)
    useEffect(() => {
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (!data.session) {
                // Se não tem sessão, o link expirou ou é inválido
                router.replace("/restaurante/login");
            }
        };
        checkSession();
    }, [router]);

    const handleUpdatePassword = async () => {
        if (password.length < 6) {
            setToast({ show: true, msg: "A senha deve ter no mínimo 6 caracteres.", type: "error" });
            return;
        }

        setLoading(true);
        try {
            // Atualiza a senha do usuário LOGADO (via link mágico)
            const { error } = await supabase.auth.updateUser({ password: password });

            if (error) throw error;

            setToast({ show: true, msg: "Senha alterada com sucesso!", type: "success" });
            
            // Redireciona para o login ou painel após sucesso
            setTimeout(() => {
                router.push("/restaurante/login");
            }, 2000);

        } catch (err: any) {
            setToast({ show: true, msg: err.message || "Erro ao atualizar senha.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <Card className="w-full max-w-md p-8 space-y-6 shadow-md border border-gray-200">
                <div className="text-center space-y-2">
                    <h1 className="text-2xl font-bold text-gray-900">Nova Senha</h1>
                    <p className="text-gray-500 text-sm">
                        Digite sua nova senha abaixo.
                    </p>
                </div>

                <div className="space-y-4">
                    <Input
                        label="Nova Senha"
                        placeholder="Mínimo 6 caracteres"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        icon={<FontAwesomeIcon icon={faLock} />}
                    />

                    <Button 
                        variant="primary" 
                        className="w-full py-3" 
                        loading={loading}
                        onClick={handleUpdatePassword}
                    >
                        <FontAwesomeIcon icon={faCheck} className="mr-2" />
                        Salvar Nova Senha
                    </Button>
                </div>
            </Card>

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