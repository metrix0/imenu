"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { getCreationStepPath } from "@/lib/restaurantCreation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

type AuthFailure = {
    code?: string;
    message?: string;
    status?: number;
};

type AuthUser = {
    id: string;
    email?: string | null;
    email_confirmed_at?: string | null;
    confirmed_at?: string | null;
};

type RestaurantRecord = {
    id: string;
    url_slug: string | null;
    first_time: boolean | null;
    creation_step: number | null;
};

const PENDING_EMAIL_KEY = "imenu-pending-signup-email";

function isEmailNotConfirmed(error: AuthFailure | null): boolean {
    return (
        error?.code === "email_not_confirmed" ||
        error?.message?.toLowerCase().includes("email not confirmed") === true
    );
}

function isRateLimitError(error: AuthFailure | null): boolean {
    const message = error?.message?.toLowerCase() || "";

    return (
        error?.status === 429 ||
        message.includes("rate limit") ||
        message.includes("security purposes")
    );
}

function formatAuthError(message: string): string {
    if (message.toLowerCase().includes("email address not authorized")) {
        return "Não foi possível enviar o e-mail de confirmação para este endereço.";
    }

    return message;
}

function isEmailConfirmed(user: AuthUser): boolean {
    return Boolean(user.email_confirmed_at || user.confirmed_at);
}

export default function AdminLogin() {
    const router = useRouter();
    const { setRestaurantId, setEmail, setRestaurantSlug } =
        useCreationStore();
    const [email, setLocalEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState("");
    const [show, setShow] = useState(false);
    const [toast, setToast] = useState(false);

    const redirectUser = async (user: AuthUser) => {
        const userEmail = user.email?.trim().toLowerCase() || "";
        setEmail(userEmail);

        if (!isEmailConfirmed(user)) {
            router.replace("/restaurante/criar/info/otp");
            return;
        }

        const { data: restaurant, error: restaurantError } = await supabase
            .from("restaurants")
            .select("id, url_slug, first_time, creation_step")
            .eq("user_id", user.id)
            .maybeSingle();

        if (restaurantError) {
            throw new Error("Não foi possível carregar o restaurante.");
        }

        if (!restaurant) {
            router.replace("/restaurante/criar/info/otp");
            return;
        }

        setRestaurantId(restaurant.id);
        setRestaurantSlug(restaurant.url_slug);

        const target =
            restaurant.first_time === false
                ? "/painel"
                : getCreationStepPath(restaurant.creation_step);

        setToast(true);
        window.setTimeout(() => router.replace(target), 500);
    };

    useEffect(() => {
        let active = true;

        void supabase.auth.getSession().then(async ({ data }) => {
            if (!active || !data.session?.user) return;

            try {
                await redirectUser(data.session.user);
            } catch (caught) {
                if (!active) return;
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "Não foi possível entrar."
                );
            }
        });

        return () => {
            active = false;
        };
    }, []);

    const continueEmailConfirmation = async (normalizedEmail: string) => {
        setEmail(normalizedEmail);
        window.localStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail);

        const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email: normalizedEmail,
            options: {
                emailRedirectTo: `${window.location.origin}/restaurante/confirmar-email`,
            },
        });

        if (resendError && !isRateLimitError(resendError)) {
            throw new Error(formatAuthError(resendError.message));
        }

        router.push("/restaurante/criar/info/otp");
    };

    const login = async (event: React.FormEvent) => {
        event.preventDefault();

        const normalizedEmail = email.trim().toLowerCase();

        if (
            !/^\S+@\S+\.\S+$/.test(normalizedEmail) ||
            password.length < 6
        ) {
            setError("Preencha e-mail e senha corretamente.");
            return;
        }

        setLoading(true);
        setError("");

        const { data, error: signInError } =
            await supabase.auth.signInWithPassword({
                email: normalizedEmail,
                password,
            });

        if (isEmailNotConfirmed(signInError)) {
            try {
                await continueEmailConfirmation(normalizedEmail);
            } catch (caught) {
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "Não foi possível reenviar o código."
                );
                setLoading(false);
            }
            return;
        }

        if (signInError || !data.user) {
            setError(signInError?.message || "Login inválido.");
            setLoading(false);
            return;
        }

        try {
            await redirectUser(data.user);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Não foi possível entrar."
            );
            setLoading(false);
        }
    };

    const loginWithGoogle = async () => {
        setGoogleLoading(true);
        setError("");

        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/restaurante/confirmar-email`,
            },
        });

        if (oauthError) {
            setError(oauthError.message || "Não foi possível entrar com Google.");
            setGoogleLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col">
            <header className="px-6 py-7">
                <Image
                    src="/logos/CombinationMarkLogo_Brand.png"
                    alt="iMenu"
                    width={128}
                    height={32}
                />
            </header>

            <main className="flex flex-1 items-center justify-center px-4 pb-16">
                <Card className="w-full max-w-lg space-y-7 border border-gray-200 p-8 shadow-sm">
                    <h1 className="text-center text-2xl font-bold">
                        Entrar no Painel
                    </h1>

                    <form onSubmit={login} className="space-y-6">
                        <Button
                            type="button"
                            variant="secondary"
                            loading={googleLoading}
                            onClick={() => void loginWithGoogle()}
                            className="w-full border border-gray-300 bg-white! hover:bg-gray-100!"
                        >
                            <Image
                                src="/logos/google-g.svg"
                                alt=""
                                width={18}
                                height={18}
                                className="mr-2"
                            />
                            Continuar com Google
                        </Button>

                        <div className="flex items-center gap-3 text-xs text-gray-400">
                            <span className="h-px flex-1 bg-gray-200" />
                            ou
                            <span className="h-px flex-1 bg-gray-200" />
                        </div>

                        <Input
                            label="E-mail"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) =>
                                setLocalEmail(event.target.value)
                            }
                        />

                        <div className="relative">
                            <Input
                                label="Senha"
                                type={show ? "text" : "password"}
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                            />
                            <button
                                type="button"
                                onClick={() => setShow((current) => !current)}
                                className="absolute right-3 top-6 flex h-12 items-center cursor-pointer text-gray-500 2xl:top-8 2xl:h-[52px]"
                            >
                                <FontAwesomeIcon
                                    icon={show ? faEyeSlash : faEye}
                                />
                            </button>
                            <Link
                                href="/restaurante/login/esqueci-senha"
                                className="mt-2 block text-xs text-gray-500 underline"
                            >
                                Esqueci minha senha
                            </Link>
                        </div>

                        {error && (
                            <div className="animate-fadeUp rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            loading={loading}
                            className="w-full"
                        >
                            Entrar
                        </Button>

                        <p className="text-sm">
                            Novo no iMenu?{" "}
                            <Link
                                href="/restaurante/registrar"
                                className="text-brand underline"
                            >
                                Registre-se agora
                            </Link>
                        </p>
                    </form>
                </Card>
            </main>

            {toast && (
                <Toast
                    message="Login realizado com sucesso!"
                    type="success"
                    onClose={() => setToast(false)}
                />
            )}
        </div>
    );
}
