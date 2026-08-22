"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo, faCopy } from "@fortawesome/free-solid-svg-icons";
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
        restaurant.payment_info_type || "AUTO"
    );
    const [storeWhatsapp, setStoreWhatsapp] = useState(
        formatPhone(restaurant.store_whatsapp || "")
    );
    const [urlSlug, setUrlSlug] = useState(restaurant.url_slug || "");
    const [customDomainOpen, setCustomDomainOpen] = useState(false);

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
            `https://imenuapp.com.br/${urlSlug || "nome-da-loja"}`
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
                                    setPaymentInfoType(nextType);
                                    void saveFields({
                                        payment_info_type:
                                            nextType === "AUTO" ? null : nextType,
                                    });
                                }}
                            />
                        </div>

                        <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex items-center gap-2 text-xs font-medium 2xl:text-base">
                                <span>Chave Pix para Repasse</span>
                                <Tooltip
                                    text="Repasses são apenas para clientes que pagaram com Pix Online. São feitos todo domingo às 14:00 no PIX cadastrado."
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
                                onBlur={() =>
                                    void saveFields({ payment_info: paymentInfo })
                                }
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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
                    </div>

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setCustomDomainOpen(true)}
                        className="w-fit"
                    >
                        Usar meu domínio
                    </Button>

                    <WarningBox
                        icon={faCircleInfo}
                        className="mt-4 bg-brand! text-white!"
                    >
                        <b>AVISO:</b> Repasses de pagamentos em Pix (ONLINE) são
                        realizados semanalmente, sempre aos domingos a partir
                        das 14h. O repasse é realizado na Chave Pix cadastrada
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
                initialDomain={restaurant.custom_domain}
            />
        </div>
    );
}
