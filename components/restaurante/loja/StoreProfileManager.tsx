"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import Card from "@/components/ui/Card";
import Toast from "@/components/ui/Toast";

// Sub-componentes
import StoreVisuals from "./StoreVisuals";
import StoreName from "./StoreName";
import StoreBio from "./StoreBio";

interface StoreProfileProps {
    restaurant: {
        id: string;
        name: string;
        description: string | null;
        logo_url: string | null;
        banner_url: string | null;
    };
    compact?: boolean; // Se true, esconde a descrição
}

export default function StoreProfileManager({ restaurant, compact = false }: StoreProfileProps) {
    // Estados locais de texto
    const [name, setName] = useState(restaurant.name);
    const [description, setDescription] = useState(restaurant.description || "");
    
    // Estados locais de imagem
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);

    // Estados de UI
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: "success" | "error" } | null>(null);

    // Inicializa URLs
    useEffect(() => {
        if (restaurant.logo_url) {
            const { data } = supabase.storage.from("restaurant-logos").getPublicUrl(restaurant.logo_url);
            setLogoUrl(data.publicUrl);
        }
        if (restaurant.banner_url) {
            const { data } = supabase.storage.from("menu-banners").getPublicUrl(restaurant.banner_url);
            setBannerUrl(data.publicUrl);
        }
    }, [restaurant]);

    // Auto-Save Lógica
    const autoSave = async (field: string, value: string) => {
        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("restaurants")
                .update({ [field]: value })
                .eq("id", restaurant.id);

            if (error) throw error;
        } catch (err) {
            console.error(err);
            setToast({ msg: "Erro ao salvar.", type: "error" });
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    // Handlers de Update visual (passados para StoreVisuals)
    const handleVisualUpdate = (type: "logo" | "banner", url: string) => {
        if (type === "logo") setLogoUrl(url);
        if (type === "banner") setBannerUrl(url);
        setToast({ msg: `${type === 'logo' ? 'Logo' : 'Capa'} atualizada!`, type: "success" });
    };

    return (
        <div className={compact ? "mb-8" : "flex-1 w-full max-w-6xl mx-auto px-6 pt-8 pb-32 space-y-8"}>
            
            {/* Header do Painel (Escondido no modo compacto) */}
            {!compact && (
                <div className="flex justify-between items-end px-2">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Perfil da Loja</h1>
                        <p className="text-gray-500 mt-1">Como seu restaurante aparece para os clientes.</p>
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
                {/* 1. VISUAIS (Banner + Logo) */}
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

                    {/* 3. BIO (Condicional) */}
                    {!compact && (
                        <StoreBio 
                            value={description} 
                            onChange={setDescription} 
                            onBlur={() => autoSave("description", description)} 
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