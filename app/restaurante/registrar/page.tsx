"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { getCreationStepPath } from "@/lib/restaurantCreation";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

type Field = "email" | "phone" | "password" | "terms";

const PENDING_EMAIL_KEY = "imenu-pending-signup-email";

function formatAuthError(message: string): string {
    if (message.toLowerCase().includes("email address not authorized")) {
        return "Não foi possível enviar o e-mail de confirmação para este endereço.";
    }

    return message;
}

type AuthFailure = {
    message?: string;
    status?: number;
};

function isRateLimitError(error: AuthFailure | null): boolean {
    const message = error?.message?.toLowerCase() || "";

    return (
        error?.status === 429 ||
        message.includes("rate limit") ||
        message.includes("security purposes")
    );
}

export default function RestaurantRegistrationPage() {
    const router = useRouter();
    const { setRestaurantId, setEmail, setRestaurantSlug } = useCreationStore();
    const [email, setLocalEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [error, setError] = useState("");
    const [invalid, setInvalid] = useState<Field[]>([]);

    useEffect(() => {
        let active = true;

        void supabase.auth.getSession().then(async ({ data }) => {
            const user = data.session?.user;
            if (!active || !user) return;

            setEmail(user.email?.trim().toLowerCase() || "");

            const { data: restaurant, error: restaurantError } = await supabase
                .from("restaurants")
                .select("id, url_slug, first_time, creation_step")
                .eq("user_id", user.id)
                .maybeSingle();

            if (!active) return;

            if (restaurantError) {
                setError("Não foi possível carregar o restaurante.");
                return;
            }

            if (!restaurant) {
                router.replace("/restaurante/criar/info/otp");
                return;
            }

            setRestaurantId(restaurant.id);
            setRestaurantSlug(restaurant.url_slug);
            router.replace(
                restaurant.first_time === false
                    ? "/painel"
                    : getCreationStepPath(restaurant.creation_step)
            );
        });

        return () => {
            active = false;
        };
    }, [router, setEmail, setRestaurantId, setRestaurantSlug]);

    const formatPhone = (raw: string) => {
        const value = raw.replace(/\D/g, "").slice(0, 11);

        if (value.length <= 2) return value ? `(${value}` : "";
        if (value.length <= 7) {
            return `(${value.slice(0, 2)}) ${value.slice(2)}`;
        }

        return `(${value.slice(0, 2)}) ${value.slice(2, 7)}-${value.slice(7)}`;
    };

    const validate = () => {
        const missing: Field[] = [];

        if (!/^\S+@\S+\.\S+$/.test(email.trim())) missing.push("email");
        if (phone.replace(/\D/g, "").length !== 11) missing.push("phone");
        if (password.length < 6) missing.push("password");
        if (!acceptedTerms) missing.push("terms");

        setInvalid(missing);

        if (!missing.length) return true;

        const labels: Record<Field, string> = {
            email: "um e-mail válido",
            phone: "o celular do responsável",
            password: "uma senha com pelo menos 6 caracteres",
            terms: "o aceite dos termos",
        };

        setError(
            `Falta preencher: ${missing
                .map((item) => labels[item])
                .join(", ")}.`
        );

        return false;
    };

    const register = async () => {
        if (!validate()) return;

        const normalizedEmail = email.trim().toLowerCase();

        setLoading(true);
        setError("");

        try {
            const check = await fetch("/api/auth/email-exists", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: normalizedEmail }),
            });
            const checkData = await check.json();

            if (!check.ok) {
                throw new Error(
                    checkData?.error ||
                        "Não foi possível verificar este e-mail."
                );
            }

            if (checkData.exists) {
                if (checkData.confirmed === false) {
                    setEmail(normalizedEmail);
                    window.localStorage.setItem(
                        PENDING_EMAIL_KEY,
                        normalizedEmail
                    );

                    const { error: resendError } =
                        await supabase.auth.resend({
                            type: "signup",
                            email: normalizedEmail,
                            options: {
                                emailRedirectTo: `${window.location.origin}/restaurante/confirmar-email`,
                            },
                        });

                    if (
                        resendError &&
                        !isRateLimitError(resendError)
                    ) {
                        throw new Error(
                            formatAuthError(resendError.message)
                        );
                    }

                    router.push("/restaurante/criar/info/otp");
                    return;
                }

                setError("Esse e-mail já foi registrado.");
                return;
            }

            const { data, error: signUpError } =
                await supabase.auth.signUp({
                    email: normalizedEmail,
                    password,
                    options: {
                        emailRedirectTo: `${window.location.origin}/restaurante/confirmar-email`,
                        data: {
                            phone: phone.replace(/\D/g, ""),
                        },
                    },
                });

            if (signUpError) {
                throw new Error(formatAuthError(signUpError.message));
            }

            if (!data.user) {
                throw new Error("Não foi possível criar a conta.");
            }

            setEmail(normalizedEmail);
            window.localStorage.setItem(
                PENDING_EMAIL_KEY,
                normalizedEmail
            );
            router.push("/restaurante/criar/info/otp");
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Erro ao criar a conta."
            );
        } finally {
            setLoading(false);
        }
    };

    const registerWithGoogle = async () => {
        setGoogleLoading(true);
        setError("");

        const { error: oauthError } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/restaurante/confirmar-email`,
            },
        });

        if (oauthError) {
            setError(
                oauthError.message || "Não foi possível continuar com Google."
            );
            setGoogleLoading(false);
        }
    };

    const inputError = (field: Field) =>
        invalid.includes(field)
            ? "!border-red-500 focus:!border-red-500 focus:!ring-red-500"
            : "";

    return (
        <div className="flex min-h-screen w-full min-w-0 max-w-full flex-col overflow-x-hidden bg-white">
            <header className="flex w-full min-w-0 items-center px-4 py-6 sm:px-6">
                <Image
                    src="/logos/CombinationMarkLogo_Brand.png"
                    alt="iMenu"
                    width={128}
                    height={32}
                />
            </header>

            <main className="flex w-full min-w-0 flex-1 items-center justify-center overflow-x-hidden px-4 py-8">
                <Card className="w-full min-w-0 max-w-full space-y-6 border border-gray-200 p-6 shadow-sm sm:max-w-lg sm:p-8 2xl:max-w-xl 2xl:p-12">
                    <h1 className="text-center text-2xl font-bold text-gray-900">
                        Crie seu Cardápio Digital
                    </h1>

                    <Button
                        type="button"
                        variant="secondary"
                        loading={googleLoading}
                        onClick={() => void registerWithGoogle()}
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
                        label="E-mail*"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(event) => {
                            setLocalEmail(event.target.value);
                            setInvalid((current) =>
                                current.filter(
                                    (field) => field !== "email"
                                )
                            );
                        }}
                        className={inputError("email")}
                    />

                    <div>
                        <Input
                            label="Celular do Responsável*"
                            type="tel"
                            autoComplete="tel"
                            value={phone}
                            maxLength={15}
                            onChange={(event) => {
                                setPhone(formatPhone(event.target.value));
                                setInvalid((current) =>
                                    current.filter(
                                        (field) => field !== "phone"
                                    )
                                );
                            }}
                            className={inputError("phone")}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            Usado para suporte e casos de emergência.
                        </p>
                    </div>

                    <div className="relative">
                        <Input
                            label="Senha*"
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            value={password}
                            onChange={(event) => {
                                setPassword(event.target.value);
                                setInvalid((current) =>
                                    current.filter(
                                        (field) => field !== "password"
                                    )
                                );
                            }}
                            className={inputError("password")}
                        />
                        <button
                            type="button"
                            onClick={() =>
                                setShowPassword((current) => !current)
                            }
                            className="absolute right-3 top-6 flex h-12 items-center cursor-pointer text-gray-500 2xl:top-8 2xl:h-[52px]"
                            aria-label={
                                showPassword
                                    ? "Ocultar senha"
                                    : "Mostrar senha"
                            }
                        >
                            <FontAwesomeIcon
                                icon={showPassword ? faEyeSlash : faEye}
                            />
                        </button>
                        <p className="mt-1 text-xs text-gray-500">
                            Mínimo de 6 caracteres.
                        </p>
                    </div>

                    <label
                        className={`flex cursor-pointer items-start gap-2 rounded-md p-1 ${
                            invalid.includes("terms")
                                ? "ring-1 ring-red-500"
                                : ""
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={acceptedTerms}
                            onChange={(event) => {
                                setAcceptedTerms(event.target.checked);
                                setInvalid((current) =>
                                    current.filter(
                                        (field) => field !== "terms"
                                    )
                                );
                            }}
                            className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-brand)]"
                        />
                        <span className="text-xs text-gray-600">
                            Eu li e aceito os{" "}
                            <a
                                href="/dados/termos"
                                target="_blank"
                                className="text-brand underline"
                            >
                                Termos de Uso
                            </a>{" "}
                            e a{" "}
                            <a
                                href="/dados/privacidade"
                                target="_blank"
                                className="text-brand underline"
                            >
                                Política de Privacidade
                            </a>
                            .
                        </span>
                    </label>

                    {error && (
                        <div className="animate-fadeUp rounded-md border border-red-200 bg-red-50 p-3 text-center text-sm text-red-700">
                            {error}
                            {error.includes("já foi registrado") && (
                                <>
                                    {" "}
                                    <Link
                                        href="/restaurante/login"
                                        className="font-semibold underline"
                                    >
                                        Clique aqui para fazer login.
                                    </Link>
                                </>
                            )}
                        </div>
                    )}

                    <Button
                        onClick={register}
                        loading={loading}
                        className="w-full"
                    >
                        Criar Conta Grátis
                    </Button>

                    <p className="text-sm">
                        Já tem uma conta?{" "}
                        <Link
                            href="/restaurante/login"
                            className="text-brand underline"
                        >
                            Fazer login
                        </Link>
                    </p>
                </Card>
            </main>
        </div>
    );
}
