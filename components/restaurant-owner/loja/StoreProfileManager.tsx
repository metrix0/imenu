"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faCopy, faGlobe } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Toast from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import type { SaveState } from "@/components/ui/SaveStatus";
import PixPayoutFields from "@/components/restaurant-owner/PixPayoutFields";
import StoreVisuals from "./StoreVisuals";
import CustomDomainModal from "./CustomDomainModal";
import StoreWhatsappField from "./StoreWhatsappField";

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
    onPaymentInfoChange?: (paymentInfo: string) => void;
    onPixPayoutValidationChange?: (invalid: boolean) => void;
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

export default function StoreProfileManager({
    restaurant,
    hideCustomDomainButton = false,
    onNameChange,
    onPaymentInfoChange,
    onPixPayoutValidationChange,
    onSaveStatusChange,
}: StoreProfileProps) {
    const setRestaurantSlug = useCreationStore(state => state.setRestaurantSlug);
    const [name, setName] = useState(restaurant.name);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [fieldStatuses, setFieldStatuses] = useState<Record<string, SaveState>>({});
    const [whatsappStatus, setWhatsappStatus] = useState<SaveState>("idle");
    const isSaving = whatsappStatus === "saving" || Object.values(fieldStatuses).includes("saving");
    const hasSaveError = whatsappStatus === "error" || Object.values(fieldStatuses).includes("error");
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
        restaurant.payment_info_type || "AUTO"
    );
    const [pixAutoDetectionFailed, setPixAutoDetectionFailed] = useState(false);
    const needsPixType = Boolean(paymentInfo.trim() && !paymentInfoType);
    useEffect(() => {
        onPixPayoutValidationChange?.(needsPixType || pixAutoDetectionFailed);
    }, [needsPixType, onPixPayoutValidationChange, pixAutoDetectionFailed]);
    const [urlSlug, setUrlSlug] = useState(restaurant.url_slug || "");
    const [savedUrlSlug, setSavedUrlSlug] = useState(restaurant.url_slug || "");
    const [customDomain, setCustomDomain] = useState(
        restaurant.custom_domain || ""
    );
    const [customDomainVerified, setCustomDomainVerified] = useState(false);
    const [customDomainOpen, setCustomDomainOpen] = useState(false);
    const activeDomain = customDomainVerified ? customDomain : "";
    const menuHref = activeDomain
        ? `https://${activeDomain}`
        : savedUrlSlug ? `/${encodeURIComponent(savedUrlSlug)}` : "";

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
        if (normalized === savedUrlSlug && savedUrlSlug) return;
        if (normalized.length < 3) {
            setToast({
                msg: "O endereço precisa ter pelo menos 3 caracteres.",
                type: "error",
            });
            return;
        }
        setUrlSlug(normalized);
        try {
            const saved = await saveFields({ url_slug: normalized });
            const savedSlug = saved.url_slug ?? normalized;
            setSavedUrlSlug(savedSlug);
            setRestaurantSlug(savedSlug);
            setToast({ msg: "Endereço atualizado!", type: "success" });
        } catch {
            setUrlSlug(savedUrlSlug);
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
                    />

                    <PixPayoutFields
                        paymentInfo={paymentInfo}
                        paymentInfoType={paymentInfoType}
                        onPaymentInfoChange={(value) => {
                            setPaymentInfo(value);
                            onPaymentInfoChange?.(value);
                        }}
                        onPaymentInfoTypeChange={setPaymentInfoType}
                        onValidationChange={setPixAutoDetectionFailed}
                        onSave={saveFields}
                    />

                    <div className={`grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] md:items-end ${hideCustomDomainButton ? "" : "xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)_auto]"}`}>
                        <StoreWhatsappField
                            key={restaurant.id}
                            restaurantId={restaurant.id}
                            initialValue={restaurant.store_whatsapp}
                            onSaveStatusChange={setWhatsappStatus}
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
                            <div data-ui="field" className="flex min-w-0 flex-col gap-1.5">
                                <label
                                    data-ui="field-label"
                                    htmlFor={`menu-link-${restaurant.id}`}
                                    className="block text-xs font-medium leading-[18px] text-[#1d1d1d]"
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
                            <div className="flex flex-wrap gap-3 md:col-span-2 md:justify-end xl:col-span-1">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    leftIcon={<FontAwesomeIcon icon={faGlobe} aria-hidden="true" />}
                                    onClick={() => setCustomDomainOpen(true)}
                                    className="h-11 flex-1 whitespace-nowrap md:flex-none"
                                >
                                    {activeDomain ? "Domínio conectado" : "Usar meu domínio"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="primary"
                                    className="h-11 flex-1 whitespace-nowrap md:flex-none"
                                    disabled={!menuHref || (!activeDomain && urlSlug !== savedUrlSlug)}
                                    onClick={() => window.open(menuHref, "_blank", "noopener,noreferrer")}
                                >
                                    Abrir cardápio
                                </Button>
                            </div>
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
