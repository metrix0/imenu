"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import Card from "@/components/ui/Card";
import Toast from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";
import WarningBox from "@/components/ui/WarningBox";
import StoreVisuals from "./StoreVisuals";
import StoreName from "./StoreName";

interface StoreProfileProps {
    restaurant: {
        id: string;
        name: string;
        description: string | null;
        logo_url: string | null;
        banner_url: string | null;
        payment_method: string | null;
        payment_info: string | null;
        url_slug: string | null;
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

    if (digits.startsWith("55") && digits.length > 11) {
        digits = digits.slice(2);
    }

    digits = digits.slice(0, 11);

    if (digits.length <= 2) return digits ? `(${digits}` : "";
    if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function StoreProfileManager({
    restaurant,
    compact = false,
}: StoreProfileProps) {
    const [name, setName] = useState(restaurant.name);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{
        msg: string;
        type: "success" | "error";
    } | null>(null);
    const [paymentMethod, setPaymentMethod] = useState(
        restaurant.payment_method || "pix"
    );
    const [paymentInfo, setPaymentInfo] = useState(
        restaurant.payment_info || ""
    );
    const [storeWhatsapp, setStoreWhatsapp] = useState(
        formatPhone(restaurant.store_whatsapp || "")
    );
    const [urlSlug, setUrlSlug] = useState(restaurant.url_slug || "");

    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (isSaving) {
                event.preventDefault();
                event.returnValue = "";
            }
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () =>
            window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isSaving]);

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

    const saveFields = async (fields: Record<string, unknown>) => {
        setIsSaving(true);

        try {
            const response = await fetch(
                `/api/restaurants/${restaurant.id}`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(fields),
                }
            );

            const json = await response.json();

            if (!response.ok) {
                throw new Error(json?.error || "Erro ao salvar");
            }

            if (typeof json.url_slug === "string") {
                setUrlSlug(json.url_slug);
            }

            return json;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "Erro ao salvar.";
            setToast({ msg: message, type: "error" });
            throw error;
        } finally {
            setIsSaving(false);
        }
    };

    const autoSave = async (field: string, value: unknown) => {
        try {
            await saveFields({ [field]: value });
        } catch {
            // saveFields already shows the error.
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
            setToast({ msg: "Endereço da loja atualizado!", type: "success" });
        } catch {
            setUrlSlug(restaurant.url_slug || "");
        }
    };

    const handleVisualUpdate = async (
        type: "logo" | "banner",
        publicUrl: string,
        dbPath: string
    ) => {
        if (type === "logo") setLogoUrl(publicUrl);
        if (type === "banner") setBannerUrl(publicUrl);

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
        <div
            className={
                compact
                    ? "mb-8"
                    : "flex-1 w-full max-w-6xl mx-auto px-6 pt-8 space-y-8"
            }
        >
            {!compact && (
                <div className="flex justify-between items-end px-2">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">
                            Perfil da Loja
                        </h1>
                        <p className="text-gray-500 mt-1 2xl:text-lg">
                            Como seu restaurante aparece para os clientes.
                        </p>
                    </div>

                    <div className="h-6 text-sm font-medium">
                        {isSaving ? (
                            <span className="text-brand animate-pulse">
                                Salvando...
                            </span>
                        ) : (
                            <span className="text-green-600 flex items-center gap-1">
                                <FontAwesomeIcon
                                    icon={icons.faCheck}
                                    className="text-xs"
                                />
                                Salvo
                            </span>
                        )}
                    </div>
                </div>
            )}

            <Card className="px-4 overflow-hidden pb-8 border border-gray-200 shadow-sm">
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
                    <StoreName
                        value={name}
                        onChange={setName}
                        onBlur={() => autoSave("name", name)}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="min-w-0">
                            <Input
                                label="Endereço do cardápio"
                                value={urlSlug}
                                placeholder="nome-da-loja"
                                onChange={(event) =>
                                    setUrlSlug(sanitizeSlug(event.target.value))
                                }
                                onBlur={saveSlug}
                                autoComplete="off"
                            />
                            <p className="text-xs text-gray-500 mt-1 break-all">
                                imenuapp.com.br/{urlSlug || "nome-da-loja"}
                            </p>
                        </div>

                        <div className="min-w-0">
                            <Input
                                label="WhatsApp da loja"
                                placeholder="(00) 00000-0000"
                                type="tel"
                                inputMode="tel"
                                value={storeWhatsapp}
                                onChange={(event) =>
                                    setStoreWhatsapp(
                                        formatPhone(event.target.value)
                                    )
                                }
                                onBlur={() =>
                                    autoSave(
                                        "store_whatsapp",
                                        storeWhatsapp.replace(/\D/g, "")
                                    )
                                }
                                maxLength={15}
                                autoComplete="tel"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Número público usado pelos clientes para falar
                                com o restaurante.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Dropdown
                            label="Método de pagamento"
                            options={[{ value: "pix", label: "PIX" }]}
                            value={paymentMethod}
                            onChange={(event) => {
                                const nextMethod = event.target.value;
                                setPaymentMethod(nextMethod);
                                void autoSave("payment_method", nextMethod);
                            }}
                        />

                        <Input
                            label="Chave PIX"
                            placeholder="Ex: 123456789"
                            value={paymentInfo}
                            onChange={(event) =>
                                setPaymentInfo(event.target.value)
                            }
                            onBlur={() =>
                                autoSave("payment_info", paymentInfo)
                            }
                        />
                    </div>

                    <WarningBox
                        icon={faCircleInfo}
                        className="bg-brand! text-white! mt-4"
                    >
                        <b>AVISO:</b> Repasses de pagamentos em Pix (ONLINE)
                        são realizados semanalmente, sempre aos domingos a
                        partir das 14h. O repasse é realizado na Chave Pix
                        cadastrada acima.
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
        </div>
    );
}
