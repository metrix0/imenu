"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faCopy, faGlobe } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Toast from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import type { SaveState } from "@/components/ui/SaveStatus";
import PixPayoutFields, {
    inferPixKeyType,
} from "@/components/restaurant-owner/PixPayoutFields";
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
    hideCustomDomainButton?: boolean;
    onNameChange?: (name: string) => void;
    onSaveStatusChange: (status: SaveState) => void;
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
    hideCustomDomainButton = false,
    onNameChange,
    onSaveStatusChange,
}: StoreProfileProps) {
    const [name, setName] = useState(restaurant.name);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [fieldStatuses, setFieldStatuses] = useState<Record<string, SaveState>>({});
    const isSaving = Object.values(fieldStatuses).includes("saving");
    const hasSaveError = Object.values(fieldStatuses).includes("error");
    useEffect(() => {
        onSaveStatusChange(hasSaveError ? "error" : isSaving ? "saving" : "saved");
    }, [hasSaveError, isSaving, onSaveStatusChange]);
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
        const updateStatus = (status: SaveState) => setFieldStatuses(previous => ({
            ...previous, ...Object.fromEntries(Object.keys(fields).map(key => [key, status])),
        }));
        updateStatus("saving");
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
            updateStatus("saved");
            return payload;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Erro ao salvar.";
            setToast({ msg: message, type: "error" });
            updateStatus("error");
            throw error;
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
            <Card className="overflow-visible">
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
                        onChange={(event) => {
                            setName(event.target.value);
                            onNameChange?.(event.target.value);
                        }}
                        onBlur={() => void saveFields({ name: name.trim() })}
                        placeholder="Ex: Burger King"
                        className="font-medium"
                    />

                    <PixPayoutFields
                        paymentInfo={paymentInfo}
                        paymentInfoType={paymentInfoType}
                        onPaymentInfoChange={setPaymentInfo}
                        onPaymentInfoTypeChange={setPaymentInfoType}
                        onSave={saveFields}
                    />

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)_auto] md:items-end">
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
                                value={`https://${customDomain}`}
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
                            <div data-ui="field" className="min-w-0">
                                <label
                                    data-ui="field-label"
                                    htmlFor={`menu-link-${restaurant.id}`}
                                >
                                    Link do cardápio
                                </label>
                                <div className="flex h-11 min-w-0 overflow-hidden rounded-lg border border-gray-200 bg-white transition focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
                                    <span className="flex shrink-0 items-center border-r border-gray-200 bg-gray-50 px-3 text-xs text-gray-500 sm:text-sm">
                                        imenuapp.com.br/
                                    </span>
                                    <input
                                        id={`menu-link-${restaurant.id}`}
                                        value={urlSlug}
                                        placeholder="nome-da-loja"
                                        onChange={(event) =>
                                            setUrlSlug(
                                                sanitizeSlug(event.target.value)
                                            )
                                        }
                                        onBlur={saveSlug}
                                        autoComplete="off"
                                        spellCheck={false}
                                        className="min-w-0 flex-1 bg-transparent px-3 text-base text-gray-900 outline-none md:text-sm"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => void copyMenuLink()}
                                        aria-label="Copiar link do cardápio"
                                        title="Copiar link"
                                        className="flex w-11 shrink-0 cursor-pointer items-center justify-center border-l border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-brand"
                                    >
                                        <FontAwesomeIcon icon={faCopy} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {!hideCustomDomainButton && (
                            <Button
                                type="button"
                                variant={
                                    customDomain && customDomainVerified
                                        ? "secondary"
                                        : "primary"
                                }
                                onClick={() => setCustomDomainOpen(true)}
                                className="h-11 w-full shrink-0 md:w-auto"
                            >
                                <FontAwesomeIcon icon={faGlobe} className="mr-2" />
                                {customDomain && customDomainVerified
                                    ? "Domínio conectado"
                                    : "Usar meu domínio"}
                            </Button>
                        )}
                    </div>
                </div>
            </Card>

            {toast && (
                <Toast
                    message={toast.msg}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            {!hideCustomDomainButton && (
                <CustomDomainModal
                    open={customDomainOpen}
                    onClose={() => setCustomDomainOpen(false)}
                    restaurantId={restaurant.id}
                    initialDomain={customDomain}
                    onDomainChange={setCustomDomain}
                    onVerificationChange={setCustomDomainVerified}
                />
            )}
        </div>
    );
}
