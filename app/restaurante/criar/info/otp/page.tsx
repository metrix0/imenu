"use client";

import {
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import type { ClipboardEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/database/supabaseClient";
import {
    getOrCreateOnboardingRestaurant,
    isEmailConfirmed,
} from "@/lib/finishEmailConfirmation";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { getCreationStepPath } from "@/lib/restaurantCreation";

const PENDING_EMAIL_KEY = "imenu-pending-signup-email";

function formatAuthError(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes("email address not authorized")) {
        return "Não foi possível enviar o e-mail de confirmação para este endereço.";
    }

    if (
        normalized.includes("rate limit") ||
        normalized.includes("security purposes")
    ) {
        return "Aguarde um pouco antes de solicitar outro código.";
    }

    return message;
}

function isAlreadyConfirmedError(message: string): boolean {
    const normalized = message.toLowerCase();

    return (
        normalized.includes("already confirmed") ||
        normalized.includes("email confirmed") ||
        normalized.includes("user already registered")
    );
}

function Verification() {
    const router = useRouter();
    const {
        email,
        setEmail,
        setRestaurantId,
        setRestaurantSlug,
    } = useCreationStore();
    const [targetEmail, setTargetEmail] = useState(email || "");
    const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [message, setMessage] = useState("");
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);
    const [timer, setTimer] = useState(60);
    const inputs = useRef<(HTMLInputElement | null)[]>([]);
    const redirecting = useRef(false);

    const finishConfirmedUser = useCallback(
        async (user: User) => {
            if (redirecting.current) return;

            redirecting.current = true;
            setLoading(true);
            setMessage("");

            try {
                const restaurant =
                    await getOrCreateOnboardingRestaurant(user);
                const normalizedEmail =
                    user.email?.trim().toLowerCase() || targetEmail;

                setEmail(normalizedEmail);
                setRestaurantId(restaurant.id);
                setRestaurantSlug(restaurant.url_slug);
                window.localStorage.removeItem(PENDING_EMAIL_KEY);

                router.replace(
                    restaurant.first_time === false
                        ? "/painel"
                        : getCreationStepPath(restaurant.creation_step)
                );
            } catch (caught) {
                redirecting.current = false;
                setLoading(false);
                setPageLoading(false);
                setMessage(
                    caught instanceof Error
                        ? caught.message
                        : "Não foi possível continuar o cadastro."
                );
            }
        },
        [
            router,
            setEmail,
            setRestaurantId,
            setRestaurantSlug,
            targetEmail,
        ]
    );

    useEffect(() => {
        let active = true;

        const initialize = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            const pendingEmail =
                window.localStorage.getItem(PENDING_EMAIL_KEY) || "";
            const resolved =
                email || session?.user?.email || pendingEmail;

            if (!resolved) {
                router.replace("/restaurante/registrar");
                return;
            }

            if (!active) return;

            const normalizedEmail = resolved.trim().toLowerCase();
            setTargetEmail(normalizedEmail);
            setEmail(normalizedEmail);
            window.localStorage.setItem(
                PENDING_EMAIL_KEY,
                normalizedEmail
            );

            if (session?.user && isEmailConfirmed(session.user)) {
                await finishConfirmedUser(session.user);
                return;
            }

            if (!active) return;
            setPageLoading(false);
            window.setTimeout(() => inputs.current[0]?.focus(), 100);
        };

        void initialize();

        return () => {
            active = false;
        };
    }, [email, finishConfirmedUser, router, setEmail]);

    useEffect(() => {
        if (timer <= 0) return;

        const id = window.setInterval(
            () => setTimer((current) => current - 1),
            1000
        );

        return () => window.clearInterval(id);
    }, [timer]);

    const fillOtp = useCallback((rawValue: string) => {
        const digits = rawValue
            .replace(/\D/g, "")
            .slice(0, 6)
            .split("");

        if (!digits.length) return;

        const next = Array(6).fill("") as string[];
        digits.forEach((digit, index) => {
            next[index] = digit;
        });
        setOtp(next);

        const focusIndex = Math.min(digits.length, 5);
        window.setTimeout(() => inputs.current[focusIndex]?.focus(), 0);
    }, []);

    useEffect(() => {
        const handleDocumentPaste = (event: globalThis.ClipboardEvent) => {
            const pasted = event.clipboardData?.getData("text") || "";
            const digits = pasted.replace(/\D/g, "");

            if (!digits) return;

            event.preventDefault();
            event.stopPropagation();
            fillOtp(digits);
        };

        document.addEventListener("paste", handleDocumentPaste, true);
        return () =>
            document.removeEventListener("paste", handleDocumentPaste, true);
    }, [fillOtp]);

    const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
        const pasted = event.clipboardData.getData("text");
        const digits = pasted.replace(/\D/g, "");

        if (!digits) return;

        event.preventDefault();
        event.stopPropagation();
        fillOtp(digits);
    };

    const resend = async () => {
        if (!targetEmail || timer > 0 || resending) return;

        setResending(true);
        setMessage("");

        try {
            const {
                data: { user: currentUser },
            } = await supabase.auth.getUser();

            if (currentUser && isEmailConfirmed(currentUser)) {
                await finishConfirmedUser(currentUser);
                return;
            }

            const { error } = await supabase.auth.resend({
                type: "signup",
                email: targetEmail,
                options: {
                    emailRedirectTo: `${window.location.origin}/restaurante/confirmar-email`,
                },
            });

            if (error) {
                if (isAlreadyConfirmedError(error.message)) {
                    const {
                        data: { session },
                    } = await supabase.auth.getSession();

                    if (
                        session?.user &&
                        isEmailConfirmed(session.user)
                    ) {
                        await finishConfirmedUser(session.user);
                        return;
                    }

                    throw new Error(
                        "Este e-mail já foi confirmado. Faça login para continuar."
                    );
                }

                throw new Error(formatAuthError(error.message));
            }

            window.localStorage.setItem(
                PENDING_EMAIL_KEY,
                targetEmail
            );
            setOtp(Array(6).fill(""));
            setTimer(60);
            setToast({
                message: "Código reenviado!",
                type: "success",
            });
            window.setTimeout(() => inputs.current[0]?.focus(), 100);
        } catch (caught) {
            setMessage(
                caught instanceof Error
                    ? caught.message
                    : "Erro ao reenviar o código."
            );
        } finally {
            setResending(false);
        }
    };

    const verify = async () => {
        const token = otp.join("");

        if (token.length !== 6) {
            setMessage("Digite os 6 números do código.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            const {
                data: { user: currentUser },
            } = await supabase.auth.getUser();

            if (currentUser && isEmailConfirmed(currentUser)) {
                await finishConfirmedUser(currentUser);
                return;
            }

            const { data, error } = await supabase.auth.verifyOtp({
                email: targetEmail,
                token,
                type: "email",
            });

            if (error || !data.user) {
                throw new Error("Código inválido ou expirado.");
            }

            await finishConfirmedUser(data.user);
        } catch (caught) {
            setMessage(
                caught instanceof Error
                    ? caught.message
                    : "Não foi possível confirmar o código."
            );
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <div className="flex min-h-[60vh] w-full min-w-0 items-center justify-center overflow-x-hidden">
                <Loader className="border-t-brand" />
            </div>
        );
    }

    return (
        <>
            <main className="flex min-h-[calc(100vh-80px)] w-full min-w-0 flex-1 items-start justify-center overflow-x-hidden bg-gray-50 p-4 sm:p-6">
                <Card className="mt-8 w-full min-w-0 max-w-full border border-gray-200 p-5 text-center shadow-sm sm:max-w-2xl sm:p-12">
                    <h1 className="mb-2 text-2xl font-bold">
                        Confirme seu e-mail
                    </h1>
                    <p className="mb-8 break-words text-gray-600">
                        Digite o código enviado para{" "}
                        <strong>{targetEmail}</strong>.
                    </p>

                    <div className="mx-auto mb-6 grid w-full max-w-sm grid-cols-6 gap-1.5 sm:gap-3">
                        {otp.map((digit, index) => (
                            <input
                                key={index}
                                ref={(element) => {
                                    inputs.current[index] = element;
                                }}
                                type="tel"
                                inputMode="numeric"
                                autoComplete={
                                    index === 0 ? "one-time-code" : "off"
                                }
                                maxLength={1}
                                value={digit}
                                onPaste={handlePaste}
                                onChange={(event) => {
                                    const digits =
                                        event.target.value.replace(
                                            /\D/g,
                                            ""
                                        );

                                    if (digits.length > 1) {
                                        fillOtp(digits);
                                        return;
                                    }

                                    const next = [...otp];
                                    next[index] = digits;
                                    setOtp(next);

                                    if (digits && index < 5) {
                                        inputs.current[index + 1]?.focus();
                                    }
                                }}
                                onKeyDown={(event) => {
                                    if (
                                        event.key === "Backspace" &&
                                        !otp[index] &&
                                        index > 0
                                    ) {
                                        const next = [...otp];
                                        next[index - 1] = "";
                                        setOtp(next);
                                        inputs.current[index - 1]?.focus();
                                    }
                                }}
                                onFocus={(event) => event.currentTarget.select()}
                                className="h-12 min-w-0 w-full rounded-md border border-gray-300 text-center text-xl focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand sm:h-14"
                                aria-label={`Dígito ${index + 1} do código`}
                            />
                        ))}
                    </div>

                    {message && (
                        <div className="animate-fadeUp mb-5 rounded-md bg-red-50 p-3 text-sm text-red-700">
                            {message}
                        </div>
                    )}

                    <div className="flex flex-col items-center gap-5">
                        <button
                            type="button"
                            onClick={resend}
                            disabled={timer > 0 || resending}
                            className={`cursor-pointer text-sm ${
                                timer > 0 || resending
                                    ? "cursor-not-allowed text-gray-400"
                                    : "font-semibold text-brand underline"
                            }`}
                        >
                            {resending
                                ? "Reenviando..."
                                : timer > 0
                                  ? `Reenviar em ${timer}s`
                                  : "Reenviar código"}
                        </button>

                        <Button
                            onClick={verify}
                            loading={loading}
                            className="w-full sm:w-auto sm:min-w-48"
                        >
                            Confirmar
                        </Button>
                    </div>
                </Card>
            </main>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </>
    );
}

export default function OtpPage() {
    return (
        <Suspense
            fallback={
                <div className="flex min-h-screen w-full min-w-0 items-center justify-center overflow-x-hidden">
                    <Loader className="border-t-brand" />
                </div>
            }
        >
            <Verification />
        </Suspense>
    );
}
