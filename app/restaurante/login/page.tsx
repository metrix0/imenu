"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/database/supabaseClient";
import Toast from "@/components/ui/Toast";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

export default function AdminLogin() {
    const router = useRouter();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [passwordFocused, setPasswordFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [showToast, setShowToast] = useState(false);

    // ⭐ ADDED — Zustand setters
    const { setRestaurantId, setEmail: setZustandEmail, setRestaurantSlug } = useCreationStore();

    const isValid = email.includes("@") && email.includes(".") && password.length >= 6;

    // 👉 #1 Auto redirect if user already logged in
    useEffect(() => {
        const checkSession = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session) {
                router.replace("/painel");
            }
        };
        checkSession();
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;

        setLoading(true);
        setErrorMsg("");

        const { data: signInData, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setErrorMsg(error.message);
            setLoading(false);
            return;
        }

        // ⭐ ADDED — get logged user id
        const userId = signInData.user?.id;
        if (!userId) {
            setErrorMsg("Usuário inválido.");
            setLoading(false);
            return;
        }

        // ⭐ ADDED — fetch user's restaurantId
        const { data: restaurant, error: restError } = await supabase
            .from("restaurants")
            .select("id, url_slug")
            .eq("user_id", userId)
            .single();

        if (restError) {
            setErrorMsg("Não foi possível encontrar o restaurante.");
            setLoading(false);
            return;
        }

        // ⭐ ADDED — save in Zustand
        setRestaurantId(restaurant.id);
        setZustandEmail(email);
        setRestaurantSlug(restaurant.url_slug)

        // ⭐ show toast and redirect
        setShowToast(true);
        setTimeout(() => router.replace("/painel"), 1000);

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex flex-col">
            <div className="w-full bg-red-600 text-white text-center text-sm sm:text-base font-medium py-2 px-4">
                Estamos enfrentando instabilidades no servidor. Falhas podem ocorrer. Nossa equipe já está trabalhando para resolver o problema o mais rápido possível. Agradecemos sua compreensão e paciência!
            </div>
            {/* HEADER */}
            <header className="w-full  px-2 py-7 flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="relative h-6 w-32 ml-4">
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
                        alt="iMenu Logo"
                        fill
                        className="object-contain object-left"
                    />
                </div>
            </header>
            <div className="relative flex justify-center w-full min-h-[75vh] items-center px-4 2xl:py-8">

            {/* MAIN */}
            <main className="flex-1 flex flex-col items-center justify-start sm:pt-8 px-4 pb-16 ">
                <Card className="w-full max-w-lg 2xl:max-w-xl space-y-8 p-8 2xl:p-12 2xl:shadow-lg border border-gray-200 shadow-sm">

                    <div className="text-center space-y-2">
                        <h1 className="text-xl sm:text-2xl 2xl:text-3xl font-bold text-gray-900">
                            Entrar no Painel Administrativo
                        </h1>
                    </div>

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <Input
                            label="E-mail"
                            placeholder="admin@exemplo.com"
                            type="email"
                            autoComplete={"email"}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <div className="relative">
                            <Input
                                label="Senha"
                                placeholder="Digite sua senha"
                                type={showPassword ? "text" : "password"}
                                autoComplete={"current-password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                onFocus={() => setPasswordFocused(true)}
                                onBlur={() => setPasswordFocused(false)}
                            />
                            {(passwordFocused || showPassword) && (
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                    e.preventDefault(); // 🔑 NÃO perde o foco do input
                                    setShowPassword(prev => !prev);
                                }}
                                    className="tabIndex={-1} cursor-pointer absolute right-3 top-[38px] text-gray-500 hover:text-gray-700 text-sm"
                                >
                                    {showPassword ? <FontAwesomeIcon icon={faEyeSlash} className="mr-2" /> : <FontAwesomeIcon icon={faEye} className="mr-2" />}
                                </button>
                            )}
                            <div className="text-left pt-1">
                                <button
                                    type="button"
                                    onClick={() => router.push("/restaurante/login/esqueci-senha")}
                                    className="text-xs 2xl:text-sm underline mt-2 text-gray-500 hover:text-gray-700 transition cursor-pointer"
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

                        <Button
                            variant="primary"
                            loading={loading}
                            disabled={!isValid}
                            className="w-full mt-4 2xl:text-xl"
                            onClick={handleLogin}
                        >
                            Entrar
                        </Button>
                        <p className={"text-sm 2xl:text-base"}>
                            Novo no iMenu? <a className={"text-blue-500 hover:text-blue-700 duration-200 cursor-pointer"} onClick={()=>router.replace("registrar")}>Registre-se agora</a>
                        </p>
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

        </div>
        </div>
    );
}
