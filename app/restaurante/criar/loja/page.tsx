"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import AllowedPaymentMethods, {
    DEFAULT_ALLOWED_PAYMENT_METHODS,
} from "@/components/restaurant-owner/configuracoes/AllowedPaymentMethods";
import PixPayoutFields, {
    inferPixKeyType,
} from "@/components/restaurant-owner/PixPayoutFields";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";

const formatPhone = (raw: string) => {
    const digits = raw
        .replace(/\D/g, "")
        .replace(/^55(?=\d{10,11}$)/, "")
        .slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 7)
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export default function LojaPage() {
    const router = useRouter();
    const { setRestaurantId } = useCreationStore();
    const [restaurantId, setId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [methods, setMethods] = useState<string[]>(
        DEFAULT_ALLOWED_PAYMENT_METHODS
    );
    const [paymentInfo, setPaymentInfo] = useState("");
    const [paymentInfoType, setPaymentInfoType] = useState("AUTO");
    const [hasInvalidPixPayout, setHasInvalidPixPayout] = useState(false);
    const [responsiblePhone, setResponsiblePhone] = useState("");
    const [needsResponsiblePhone, setNeedsResponsiblePhone] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);

    useEffect(() => {
        void (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session) {
                router.replace("/restaurante/login");
                return;
            }

            const [{ data: restaurant, error }, { data: userData }] =
                await Promise.all([
                    supabase
                        .from("restaurants")
                        .select(
                            "id,name,allowed_payment_methods,payment_info,payment_info_type"
                        )
                        .eq("user_id", session.user.id)
                        .single(),
                    supabase.auth.getUser(),
                ]);

            if (error || !restaurant) {
                setToast({
                    message: "Restaurante não encontrado.",
                    type: "error",
                });
                setLoading(false);
                return;
            }

            setId(restaurant.id);
            setRestaurantId(restaurant.id);
            setName(restaurant.name || "");
            setMethods(
                Array.isArray(restaurant.allowed_payment_methods) &&
                    restaurant.allowed_payment_methods.length
                    ? restaurant.allowed_payment_methods
                    : DEFAULT_ALLOWED_PAYMENT_METHODS
            );
            setPaymentInfo(restaurant.payment_info || "");
            setPaymentInfoType(restaurant.payment_info_type || "AUTO");
            setNeedsResponsiblePhone(
                !String(userData.user?.user_metadata?.phone || "").replace(
                    /\D/g,
                    ""
                )
            );
            setLoading(false);
        })();
    }, [router, setRestaurantId]);

    const autoSave = async (fields: Record<string, unknown>) => {
        if (!restaurantId) return null;
        const response = await fetch(`/api/restaurants/${restaurantId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
        });
        const payload = await response.json();
        if (!response.ok) {
            const message = payload?.error || "Erro ao salvar.";
            setToast({ message, type: "error" });
            throw new Error(message);
        }
        return payload;
    };

    const inferredPixType =
        paymentInfoType === "AUTO" && paymentInfo.trim()
            ? inferPixKeyType(paymentInfo)
            : null;
    const missingPixPayoutKey = methods.includes("pix") && !paymentInfo.trim();
    const missingPixPayoutType =
        methods.includes("pix") &&
        (hasInvalidPixPayout ||
            (paymentInfoType === "AUTO" &&
                Boolean(paymentInfo.trim()) &&
                !inferredPixType));
    const responsiblePhoneInvalid =
        needsResponsiblePhone &&
        responsiblePhone.replace(/\D/g, "").length !== 11;
    const finishVisuallyBlocked = !name.trim() || responsiblePhoneInvalid;

    const continueOnboarding = async () => {
        if (missingPixPayoutKey) {
            setToast({
                message: "Preencha sua chave PIX para repasses",
                type: "error",
            });
            return;
        }
        if (missingPixPayoutType) {
            setToast({
                message: "Defina o tipo da chave PIX acima.",
                type: "error",
            });
            return;
        }
        if (!name.trim()) {
            setToast({
                message: "Informe o nome do restaurante.",
                type: "error",
            });
            return;
        }

        const responsiblePhoneDigits = responsiblePhone.replace(/\D/g, "");
        if (needsResponsiblePhone && responsiblePhoneDigits.length !== 11) {
            setToast({
                message: "Informe o celular do responsável.",
                type: "error",
            });
            return;
        }

        setSaving(true);
        try {
            if (needsResponsiblePhone) {
                const { error: phoneError } = await supabase.auth.updateUser({
                    data: { phone: responsiblePhoneDigits },
                });
                if (phoneError) throw phoneError;
            }

            const resolvedPaymentInfoType =
                paymentInfoType === "AUTO"
                    ? inferredPixType
                    : paymentInfoType || null;

            await autoSave({
                name: name.trim(),
                allowed_payment_methods: methods,
                payment_info: paymentInfo,
                payment_info_type: paymentInfo.trim()
                    ? resolvedPaymentInfoType
                    : null,
                creation_step: 4,
            });
            router.push("/restaurante/criar/localizacao");
        } catch (caught) {
            setToast({
                message:
                    caught instanceof Error
                        ? caught.message
                        : "Não foi possível salvar os dados da loja.",
                type: "error",
            });
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <main className="flex min-h-[60vh] items-center justify-center">
                <Loader className="border-t-brand" />
            </main>
        );
    }

    if (!restaurantId) return null;

    return (
        <main className="flex min-h-screen flex-col items-center bg-white px-4 pb-32 pt-4 sm:px-6">
            <div className="mt-4 w-full max-w-4xl">
                <div className="mb-8 text-center sm:text-left">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-brand">
                        Etapa 3/4
                    </p>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Defina sua Loja
                    </h1>
                    <p className="mt-1 text-gray-500">
                        Defina o nome e as formas de pagamento da sua loja.
                    </p>
                </div>

                <div className="space-y-8">
                    <Card className="space-y-6">
                        <Input
                            label="Nome do Restaurante"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            onBlur={() => {
                                if (name.trim()) {
                                    void autoSave({ name: name.trim() }).catch(() => undefined);
                                }
                            }}
                            placeholder="Ex: Burger King"
                            className="font-medium"
                        />

                        <PixPayoutFields
                            paymentInfo={paymentInfo}
                            paymentInfoType={paymentInfoType}
                            onPaymentInfoChange={setPaymentInfo}
                            onPaymentInfoTypeChange={setPaymentInfoType}
                            onValidationChange={setHasInvalidPixPayout}
                            onSave={autoSave}
                        />
                    </Card>

                    <AllowedPaymentMethods
                        value={methods}
                        onChange={(next) => {
                            setMethods(next);
                            void autoSave({ allowed_payment_methods: next }).catch(() => undefined);
                        }}
                    />

                    {needsResponsiblePhone && (
                        <div>
                            <Input
                                label="Celular do Responsável*"
                                type="tel"
                                autoComplete="tel"
                                value={responsiblePhone}
                                maxLength={15}
                                onChange={(event) =>
                                    setResponsiblePhone(
                                        formatPhone(event.target.value)
                                    )
                                }
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                Usado para suporte e casos de emergência.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4">
                <div className="mx-auto flex max-w-4xl items-center justify-between">
                    <button
                        onClick={() =>
                            router.push("/restaurante/criar/disponibilidade")
                        }
                        className="cursor-pointer font-medium text-brand"
                    >
                        Voltar
                    </button>
                    <Tooltip
                        text={
                            missingPixPayoutKey
                                ? "Preencha sua chave PIX para repasses"
                                : missingPixPayoutType
                                  ? "Defina o tipo da chave PIX acima."
                                  : !name.trim()
                                    ? "Você precisa completar os dados primeiro"
                                    : responsiblePhoneInvalid
                                      ? "Informe o celular do responsável"
                                      : ""
                        }
                    >
                        <Button
                            onClick={continueOnboarding}
                            loading={saving}
                            disabled={
                                saving ||
                                missingPixPayoutKey ||
                                missingPixPayoutType
                            }
                            className={`px-8 ${
                                finishVisuallyBlocked
                                    ? "opacity-[0.55] hover:!bg-[#d93d00]"
                                    : ""
                            }`}
                        >
                            Salvar e Continuar
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </main>
    );
}
