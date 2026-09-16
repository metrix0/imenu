"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import StoreSettings, {
    type StoreSettingsRestaurant,
} from "@/components/restaurant-owner/loja/StoreSettings";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import Tooltip from "@/components/ui/Tooltip";
import type { SaveState } from "@/components/ui/SaveStatus";
import { DEFAULT_ALLOWED_PAYMENT_METHODS } from "@/components/restaurant-owner/configuracoes/AllowedPaymentMethods";

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
    const [restaurant, setRestaurant] =
        useState<StoreSettingsRestaurant | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState("");
    const [methods, setMethods] = useState<string[]>(
        DEFAULT_ALLOWED_PAYMENT_METHODS
    );
    const [paymentInfo, setPaymentInfo] = useState("");
    const [hasInvalidPixPayout, setHasInvalidPixPayout] = useState(false);
    const [storeStatus, setStoreStatus] = useState<SaveState>("saved");
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

            const [{ data: restaurantData, error }, { data: userData }] =
                await Promise.all([
                    supabase
                        .from("restaurants")
                        .select(
                            "id,name,description,logo_url,banner_url,payment_method,payment_info,payment_info_type,allowed_payment_methods,url_slug,custom_domain,store_whatsapp"
                        )
                        .eq("user_id", session.user.id)
                        .single(),
                    supabase.auth.getUser(),
                ]);

            if (error || !restaurantData) {
                setToast({
                    message: "Restaurante não encontrado.",
                    type: "error",
                });
                setLoading(false);
                return;
            }

            setRestaurant(restaurantData);
            setRestaurantId(restaurantData.id);
            setName(restaurantData.name || "");
            setMethods(
                Array.isArray(restaurantData.allowed_payment_methods) &&
                    restaurantData.allowed_payment_methods.length
                    ? restaurantData.allowed_payment_methods
                    : DEFAULT_ALLOWED_PAYMENT_METHODS
            );
            setPaymentInfo(restaurantData.payment_info || "");
            setNeedsResponsiblePhone(
                !String(userData.user?.user_metadata?.phone || "").replace(
                    /\D/g,
                    ""
                )
            );
            setLoading(false);
        })();
    }, [router, setRestaurantId]);

    const missingPixPayoutKey = methods.includes("pix") && !paymentInfo.trim();
    const missingPixPayoutType = methods.includes("pix") && hasInvalidPixPayout;
    const responsiblePhoneInvalid =
        needsResponsiblePhone &&
        responsiblePhone.replace(/\D/g, "").length !== 11;
    const finishVisuallyBlocked =
        !name.trim() || storeStatus === "error" || responsiblePhoneInvalid;

    const continueOnboarding = async () => {
        if (!restaurant) return;
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
        if (storeStatus === "saving") {
            setToast({
                message: "Aguarde os dados da loja terminarem de salvar.",
                type: "error",
            });
            return;
        }
        if (storeStatus === "error") {
            setToast({
                message: "Corrija o erro ao salvar os dados da loja antes de continuar.",
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

            const response = await fetch(`/api/restaurants/${restaurant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ creation_step: 4 }),
            });
            if (!response.ok) throw new Error("Não foi possível continuar.");
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

    if (!restaurant) return null;

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
                        Defina como sua loja aparece e as formas de pagamento.
                    </p>
                </div>

                <StoreSettings
                    restaurant={restaurant}
                    hideCustomDomainButton
                    onNameChange={setName}
                    onPaymentInfoChange={setPaymentInfo}
                    onPixPayoutValidationChange={setHasInvalidPixPayout}
                    onAllowedPaymentMethodsChange={setMethods}
                    onSaveStatusChange={setStoreStatus}
                />

                {needsResponsiblePhone && (
                    <div className="mt-8">
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
                                    : storeStatus === "saving"
                                      ? "Aguarde os dados terminarem de salvar"
                                      : storeStatus === "error"
                                        ? "Corrija o erro ao salvar os dados da loja"
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
                                storeStatus === "saving" ||
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
