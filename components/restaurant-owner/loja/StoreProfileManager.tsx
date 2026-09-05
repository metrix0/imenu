"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCircleInfo,
    faCopy,
    faGlobe,
} from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Toast from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import Tooltip from "@/components/ui/Tooltip";
import WarningBox from "@/components/ui/WarningBox";
import StoreVisuals from "./StoreVisuals";
import CustomDomainModal from "./CustomDomainModal";

interface StoreProfileProps {
    restaurant: {
        id: string;
        name: string;
        description: string | null;
        logo_url: string | null;
        banner_url: string | null;
        payment_method: string | null;
        payment_info: string | null;
        payment_info_type: string | null;
        url_slug: string | null;
        custom_domain: string | null;
        store_whatsapp: string | null;
    };
    compact?: boolean;
}

type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

function sanitizeSlug(value: string): string {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

function formatPhone(value: string): string {
    let digits = value.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
    digits = digits.slice(0, 11);
    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function inferPixKeyType(value: string): PixKeyType | null {
    const raw = value.trim();
    if (!raw) return null;

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
        return "EVP";
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return "EMAIL";
    if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(raw)) return "CNPJ";
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(raw)) return "CPF";
    if (/^\+55\D*\d{2}\D*\d{8,9}$/.test(raw) || /^\(\d{2}\)\s*\d{4,5}-?\d{4}$/.test(raw)) {
        return "PHONE";
    }

    const digits = raw.replace(/\D/g, "");
    if (digits.length === 14) return "CNPJ";
    if (digits.length === 13 && digits.startsWith("55")) return "PHONE";
    return null;
}

export default function StoreProfileManager({
    restaurant,
}: StoreProfileProps) {
    const [name, setName] = useState(restaurant.name);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{
        msg: string;
        type: "success" | "error";
    } | null>(null);
    const [paymentInfo, setPaymentInfo] = useState(
        restaurant.payment_info || ""
    );
    const [paymentInfoType, setPaymentInfoType] = useState(
        restaurant.payment_info_type ||
            (restaurant.payment_info && !inferPixKeyType(restaurant.payment_info)
                ? ""
                : "AUTO")
    );
    const [storeWhatsapp, setStoreWhatsapp] = useState(
        formatPhone(restaurant.store_whatsapp || "")
    );
    const [urlSlug, setUrlSlug] = useState(restaurant.url_slug || "");
    const [customDomain, setCustomDomain] = useState(
        restaurant.custom_domain || ""
    );
    const [customDomainVerified, setCustomDomainVerified] = useState(false);
    const [customDomainOpen, setCustomDomainOpen] = useState(false);
    const needsPixType = Boolean(paymentInfo.trim() && !paymentInfoType);

    useEffect(() => {
        if (restaurant.logo_url) {
            setLogoUrl(
                supabase.storage
                    .from("restaurant-logos")
                    .getPublicUrl(restaurant.logo_url).data.publicUrl
            );
        }
        if (restaurant.banner_url) {
            setBannerUrl(
                supabase.storage
                    .from("menu-banners")
                    .getPublicUrl(restaurant.banner_url).data.publicUrl
            );
        }
    }, [restaurant.banner_url, restaurant.logo_url]);

    useEffect(() => {
        if (!restaurant.custom_domain) {
            setCustomDomainVerified(false);
            return;
        }

        let active = true;
        void fetch(`/api/restaurants/${restaurant.id}/domain`, {
            cache: "no-store",
        })
            .then(async (response) => {
                if (!response.ok) return;
                const payload = (await response.json()) as {
                    verified?: boolean;
                };
                if (active) {
                    setCustomDomainVerified(Boolean(payload.verified));
                }
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [restaurant.custom_domain, restaurant.id]);

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (isSaving) {
                event.preventDefault();
                event.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isSaving]);

    const saveFields = async (fields: Record<string, unknown>) => {
        setIsSaving(true);
        try {
            const response = await fetch(`/api/restaurants/${restaurant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fields),
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload?.error || "Erro ao salvar");
            if (typeof payload.url_slug === "string") {
                setUrlSlug(payload.url_slug);
            }
            return payload;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Erro ao salvar.";
            setToast({ msg: message, type: "error" });
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    const savePaymentInfo = async () => {
        if (paymentInfoType === "AUTO" && paymentInfo.trim()) {
            const detectedType = inferPixKeyType(paymentInfo);
            if (detectedType) {
                setPaymentInfoType(detectedType);
                await saveFields({
                    payment_info: paymentInfo,
                    payment_info_type: detectedType,
                });
                return;
            }

            setPaymentInfoType("");
            await saveFields({
                payment_info: paymentInfo,
                payment_info_type: null,
            });
            return;
        }

        await saveFields({ payment_info: paymentInfo });
    };

    const saveSlug = async () => {
        const normalized = sanitizeSlug(urlSlug);
        if (normalized.length < 3) {
            setToast({
                msg: "O endereço precisa ter pelo menos 3 caracteres.",
                type: "error",
            });
            return;
        }
        setUrlSlug(normalized);
        try {
            await saveFields({ url_slug: normalized });
            setToast({ msg: "Endereço atualizado!", type: "success" });
        } catch {
            setUrlSlug(restaurant.url_slug || "");
        }
    };

    const copyMenuLink = async () => {
        await navigator.clipboard.writeText(
            customDomain && customDomainVerified
                ? `https://${customDomain}`
                : `https://imenuapp.com.br/${urlSlug || "nome-da-loja"}`
        );
        setToast({ msg: "Link copiado!", type: "success" });
    };

    const handleVisualUpdate = async (
        type: "logo" | "banner",
        publicUrl: string,
        dbPath: string
    ) => {
        if (type === "logo") setLogoUrl(publicUrl);
        else setBannerUrl(publicUrl);

        try {
            await saveFields({
                [type === "logo" ? "logo_url" : "banner_url"]: dbPath,
            });
            setToast({
                msg: `${type === "logo" ? "Logo" : "Capa"} atualizada!`,
                type: "success",
            });
        } catch {
            setToast({ msg: "Erro ao salvar imagem.", type: "error" });
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-end justify-between gap-4 px-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Perfil da Loja
                    </h1>
                    <p className="mt-1 text-gray-500 2xl:text-lg">
                        Como seu restaurante aparece para os clientes.
                    </p>
                </div>
                <div className="h-6 text-sm font-medium">
                    {isSaving ? (
                        <span className="animate-pulse text-brand">Salvando...</span>
                    ) : (
                        <span className="text-green-600">Tudo salvo</span>
                    )}
                </div>
            </div>

            <Card className="overflow-visible border border-gray-200 px-4 pb-8 shadow-sm">
                <StoreVisuals
                    restaurantId={restaurant.id}
                    logoUrl={logoUrl}
                    bannerUrl={bannerUrl}
                    onUpdate={handleVisualUpdate}
                    onError={(message) =>
                        setToast({ msg: message, type: "error" })
                    }
                />

                <div className="space-y-6">
                    <Input
                        label="Nome do Restaurante"
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        onBlur={() => void saveFields({ name: name.trim() })}
                        placeholder="Ex: Burger King"
                        className="text-lg font-medium"
                    />

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="relative z-10 flex min-w-0 flex-col gap-1">
                            <div className="text-xs font-medium 2xl:text-base">
                                Tipo da chave PIX
                            </div>
                            <Dropdown
                                options={[
                                    { value: "", label: "Definir tipo de chave" },
                                    { value: "AUTO", label: "Detectar automaticamente" },
                                    { value: "CPF", label: "CPF" },
                                    { value: "CNPJ", label: "CNPJ" },
                                    { value: "EMAIL", label: "E-mail" },
                                    { value: "PHONE", label: "Telefone" },
                                    { value: "EVP", label: "Chave aleatória" },
                                ]}
                                value={paymentInfoType}
                                onChange={(event) => {
                                    const nextType = event.target.value;
                                    if (nextType === "AUTO" && paymentInfo.trim()) {
                                        const detectedType = inferPixKeyType(paymentInfo);
                                        if (detectedType) {
                                            setPaymentInfoType(detectedType);
                                            void saveFields({ payment_info_type: detectedType });
                                        } else {
                                            setPaymentInfoType("");
                                            void saveFields({ payment_info_type: null });
                                        }
                                        return;
                                    }

                                    setPaymentInfoType(nextType);
                                    void saveFields({
                                        payment_info_type:
                                            nextType === "AUTO" || !nextType
                                                ? null
                                                : nextType,
                                    });
                                }}
                            />
                        </div>

                        <div className="flex min-w-0 flex-col gap-1">
                            <div className={`flex items-center gap-2 text-xs font-medium 2xl:text-base ${needsPixType ? "text-red-600" : ""}`}>
                                <span>Chave Pix para Repasse</span>
                                <Tooltip
                                    text="Repasses são apenas para clientes que pagaram com Pix Online. Repasses diários às 12:00 no PIX cadastrado."
                                    size="medium"
                                    showOnClick
                                >
                                    <FontAwesomeIcon
                                        icon={faCircleInfo}
                                        className="cursor-help text-gray-500"
                                    />
                                </Tooltip>
                            </div>
                            <Input
                                placeholder="Ex: 123456789"
                                value={paymentInfo}
                                onChange={(event) =>
                                    setPaymentInfo(event.target.value)
                                }
                                onBlur={() => void savePaymentInfo()}
                                className={needsPixType ? "border-red-400 focus:border-red-500 focus:ring-red-100" : ""}
                            />
                            {needsPixType && (
                                <p className="text-xs font-medium text-red-600">
                                    Defina o tipo da chave PIX acima.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)_auto] md:gap-4">
                        <Input
                            label="WhatsApp da loja"
                            placeholder="(00) 00000-0000"
                            type="tel"
                            inputMode="tel"
                            value={storeWhatsapp}
                            onChange={(event) =>
                                setStoreWhatsapp(formatPhone(event.target.value))
                            }
                            onBlur={() =>
                                void saveFields({
                                    store_whatsapp: storeWhatsapp.replace(/\D/g, ""),
                                })
                            }
                            maxLength={15}
                            autoComplete="tel"
                        />

                        {customDomain && customDomainVerified ? (
                            <Input
                                label="Link do cardápio"
                                value={customDomain}
                                readOnly
                                locked
                                iconPosition="right"
                                icon={
                                    <button
                                        type="button"
                                        onClick={() => void copyMenuLink()}
                                        aria-label="Copiar link do cardápio"
                                        title="Copiar link"
                                        className="cursor-pointer text-gray-500 hover:text-brand"
                                    >
                                        <FontAwesomeIcon icon={faCopy} />
                                    </button>
                                }
                            />
                        ) : (
                            <div className="min-w-0">
                                <Input
                                    label="Link do cardápio"
                                    value={urlSlug}
                                    placeholder="nome-da-loja"
                                    onChange={(event) =>
                                        setUrlSlug(sanitizeSlug(event.target.value))
                                    }
                                    onBlur={saveSlug}
                                    autoComplete="off"
                                />
                                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-gray-500">
                                    <span className="min-w-0 break-all">
                                        imenuapp.com.br/{urlSlug || "nome-da-loja"}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void copyMenuLink()}
                                        aria-label="Copiar link do cardápio"
                                        title="Copiar link"
                                        className="shrink-0 cursor-pointer text-gray-500 hover:text-brand"
                                    >
                                        <FontAwesomeIcon icon={faCopy} />
                                    </button>
                                </div>
                            </div>
                        )}

                        <Button
                            type="button"
                            variant={
                                customDomain && customDomainVerified
                                    ? "secondary"
                                    : "primary"
                            }
                            onClick={() => setCustomDomainOpen(true)}
                            className="w-fit shrink-0 self-start border border-transparent py-3! md:mt-5 2xl:mt-8 2xl:text-lg"
                        >
                            <FontAwesomeIcon icon={faGlobe} className="mr-2" />
                            {customDomain && customDomainVerified
                                ? "Domínio conectado"
                                : "Usar meu domínio"}
                        </Button>
                    </div>

                    <WarningBox
                        icon={faCircleInfo}
                        className="mt-4 bg-brand! text-white!"
                    >
                        <b>AVISO:</b> Repasses de pagamentos em Pix (ONLINE) são
                        realizados diariamente às 12:00 na Chave Pix cadastrada
                        acima.
                    </WarningBox>
                </div>
            </Card>

            {toast && (
                <Toast
                    message={toast.msg}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <CustomDomainModal
                open={customDomainOpen}
                onClose={() => setCustomDomainOpen(false)}
                restaurantId={restaurant.id}
                initialDomain={customDomain}
                onDomainChange={setCustomDomain}
                onVerificationChange={setCustomDomainVerified}
            />
        </div>
    );
}
