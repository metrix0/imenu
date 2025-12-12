"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import Card from "@/components/ui/Card";
import Toast from "@/components/ui/Toast";
import Input from "@/components/ui/Input";
import Dropdown from "@/components/ui/Dropdown";

// Sub-componentes
import StoreVisuals from "./StoreVisuals";
import StoreName from "./StoreName";
// StoreBio não foi fornecido, mas assumo que exista e seja similar ao StoreName
// import StoreBio from "./StoreBio"; 

interface StoreProfileProps {
    restaurant: {
        id: string;
        name: string;
        description: string | null;
        logo_url: string | null;
        banner_url: string | null;
        payment_method: string
        payment_info: string
    };
    compact?: boolean;

}

export default function StoreProfileManager({ restaurant, compact = false }: StoreProfileProps) {
    // Estados locais
    const [name, setName] = useState(restaurant.name);
    // const [description, setDescription] = useState(restaurant.description || "");
    
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: "success" | "error" } | null>(null);
    const [paymentMethod, setPaymentMethod] = useState("pix");
    const [paymentInfo, setPaymentInfo] = useState("");

    useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // Verifique aqui sua variável de estado (ex: isSaving, status === 'saving')
        if (isSaving) { 
            e.preventDefault();
            e.returnValue = ""; 
        }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [isSaving]); // Adicione a variável de estado nas dependências

    // Inicializa URLs públicas
    useEffect(() => {
        if (restaurant.logo_url) {
            const { data } = supabase.storage.from("restaurant-logos").getPublicUrl(restaurant.logo_url);
            setLogoUrl(data.publicUrl);
        }
        if (restaurant.banner_url) {
            const { data } = supabase.storage.from("menu-banners").getPublicUrl(restaurant.banner_url);
            setBannerUrl(data.publicUrl);
        }
        setPaymentMethod(restaurant.payment_method || "pix");
        setPaymentInfo(restaurant.payment_info || "");
    }, [restaurant]);

    // --- AUTO-SAVE VIA API ---
    const autoSave = async (field: string, value: string) => {
        setIsSaving(true);
        try {
            // CORREÇÃO: Usando API Route
            const response = await fetch(`/api/restaurants/${restaurant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: value }),
            });

            if (!response.ok) throw new Error("Erro ao salvar");

        } catch (err) {
            console.error(err);
            setToast({ msg: "Erro ao salvar.", type: "error" });
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    // --- VISUAL UPDATE VIA API ---
    // O componente filho StoreVisuals já deve estar preparado para retornar (type, publicUrl, dbPath)
    // Se ele ainda retorna apenas url, precisaremos usar o que ele mandar, mas idealmente ele manda o path.
    // No seu código anterior de StoreVisuals, corrigimos para retornar dbPath.
    const handleVisualUpdate = async (type: "logo" | "banner", publicUrl: string, dbPath: string) => {
        if (type === "logo") setLogoUrl(publicUrl);
        if (type === "banner") setBannerUrl(publicUrl);

        setIsSaving(true);
        try {
            const field = type === "logo" ? "logo_url" : "banner_url";
            
            const response = await fetch(`/api/restaurants/${restaurant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ [field]: dbPath }),
            });

            if (!response.ok) throw new Error("Erro ao salvar imagem");

            setToast({ msg: `${type === 'logo' ? 'Logo' : 'Capa'} atualizada!`, type: "success" });
        } catch (err) {
            console.error(err);
            setToast({ msg: "Erro ao salvar imagem.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={compact ? "mb-8" : "flex-1 w-full max-w-6xl mx-auto px-6 pt-8 pb-32 space-y-8"}>
            
            {!compact && (
                <div className="flex justify-between items-end px-2">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Perfil da Loja</h1>
                        <p className="text-gray-500 mt-1 2xl:text-lg">Como seu restaurante aparece para os clientes.</p>
                    </div>
                    <div className="h-6 text-sm font-medium">
                        {isSaving ? (
                            <span className="text-brand animate-pulse">Salvando...</span>
                        ) : (
                            <span className="text-green-600 flex items-center gap-1">
                                <FontAwesomeIcon icon={icons.faCheck} className="text-xs" /> Salvo
                            </span>
                        )}
                    </div>
                </div>
            )}

            <Card className="px-4 overflow-hidden pb-8 border border-gray-200 shadow-sm">
                {/* 1. VISUAIS */}
                <StoreVisuals 
                    restaurantId={restaurant.id}
                    logoUrl={logoUrl}
                    bannerUrl={bannerUrl}
                    onUpdate={handleVisualUpdate}
                    onError={(msg) => setToast({ msg, type: "error" })}
                />

                <div className="space-y-6">
                    {/* 2. NOME */}
                    <StoreName 
                        value={name} 
                        onChange={setName} 
                        onBlur={() => autoSave("name", name)} 
                    />
                    
                    {/* Se tiver StoreBio, adicione aqui similar ao StoreName */}
                </div>

                <div className={"flex gap-6"}>
                {/* MÉTODO DE PAGAMENTO */}
                <Dropdown
                    label="Método de pagamento"
                    options={[
                        { value: "pix", label: "PIX" },
                    ]}
                    value={paymentMethod}
                    onChange={(e) => {
                        const method = (e.target.value as unknown) as "pix" | "deposit";
                        setPaymentMethod(method);
                    }}
                />

                {/* CAMPOS DINÂMICOS */}
                {paymentMethod === "pix" ? (
                    <Input
                        label="Chave PIX"
                        placeholder="Ex: 123456789"
                        value={paymentInfo}
                        onChange={(e) => setPaymentInfo(e.target.value)}
                        onBlur={() => autoSave("payment_info", paymentInfo)}
                    />
                ) : (
                    <Input
                        label="Dados para Depósito"
                        placeholder={`Banco, Agência, Conta, Tipo, Titular...`}
                        value={paymentInfo}
                        onChange={(e) => setPaymentInfo(e.target.value)}
                        onBlur={() => autoSave("payment_info", paymentInfo)}
                    />
                )}
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