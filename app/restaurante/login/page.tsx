"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/database/supabaseClient";
import Toast from "@/components/ui/Toast";
import Popup from "@/components/ui/Popup";

export default function AdminLogin() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [showToast, setShowToast] = useState(false);
    const [showPopup, setShowPopup] = useState(false);

    const isValid = email.includes("@") && email.includes(".") && password.length >= 6;

    // 👉 #1 Auto redirect if user already logged in
    useEffect(() => {
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                router.replace("/painel/pedidos");
            }
        };
        checkSession();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setLoading(true);
        setErrorMsg("");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMsg(error.message);
        } else {
            setShowToast(true);
            setTimeout(() => router.replace("/painel/pedidos"), 1000);
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col bg-white">
            {/* HEADER */}
            <header className="w-full border-b border-gray-200 px-2 py-7 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="relative h-6 w-32 ml-4">
                    <Image
                        src="/logo-full.png"
                        alt="iMenu Logo"
                        fill
                        className="object-contain object-left"
                    />
                </div>
            </header>

            {/* MAIN */}
            <main className="flex-1 flex flex-col items-center justify-start pt-8 px-4 pb-16 sm:pt-16">
                <Card className="w-full max-w-2xl space-y-8 p-8 border border-gray-200 shadow-sm">

                    <div className="text-center space-y-2">
                        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                            Entrar no Painel Administrativo
                        </h1>
                        <p className="text-base text-gray-500">
                            Receba pedidos e customize seu restaurante.
                        </p>
                    </div>

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <Input
                            label="E-mail"
                            placeholder="admin@exemplo.com"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <div>
                            <Input
                                label="Senha"
                                placeholder="Digite sua senha"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <div className="text-left pt-1">
                                <button
                                    type="button"
                                    onClick={() => router.push("/esqueci-senha")}
                                    className="text-xs underline mt-2 text-gray-500 hover:text-gray-700 transition cursor-pointer"
                                >
                                    Esqueci minha senha
                                </button>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-md text-sm text-red-600 text-center">
                                {errorMsg}
                            </div>
                        )}

                        {/* 👉 NORMAL BUTTON (not in footer) */}
                        <Button
                            variant="primary"
                            loading={loading}
                            disabled={!isValid}
                            className="w-full mt-4"
                            onClick={handleLogin}
                        >
                            Entrar
                        </Button>
                    </form>
                </Card>
            </main>

            {/* TOAST + POPUP */}
            {showToast && (
                <Toast
                    message="Login realizado com sucesso!"
                    type="success"
                    onClose={() => setShowToast(false)}
                />
            )}

            <Popup open={showPopup} onClose={() => setShowPopup(false)}>
                {/* optional content */}
            </Popup>
        </div>
    );
}
