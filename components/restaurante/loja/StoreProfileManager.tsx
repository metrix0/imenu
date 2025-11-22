"use client";

import { useState, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { uploadBannerImage } from "@/lib/uploadBannerImage";
import { uploadLogoImage } from "@/lib/uploadLogoImage";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card";
import Toast from "@/components/ui/Toast";

interface StoreProfileProps {
    restaurant: {
        id: string;
        name: string;
        description: string | null;
        logo_url: string | null;
        banner_url: string | null;
    };
}

export default function StoreProfileManager({ restaurant }: StoreProfileProps) {
    const [name, setName] = useState(restaurant.name);
    const [description, setDescription] = useState(restaurant.description || "");
    
    // Estados visuais para imagens (URLs públicas)
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [bannerUrl, setBannerUrl] = useState<string | null>(null);

    const [isBannerUploading, setIsBannerUploading] = useState(false);
    const [isLogoUploading, setIsLogoUploading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [toast, setToast] = useState<{ msg: string, type: "success" | "error" } | null>(null);

    const bannerInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Carregar URLs iniciais
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

    // --- AUTO SAVE LOGIC ---
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

    // --- IMAGE UPLOADS ---
    
    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsBannerUploading(true);
        try {
            const path = await uploadBannerImage(file);
            await supabase.from("restaurants").update({ banner_url: path }).eq("id", restaurant.id);
            
            const { data } = supabase.storage.from("menu-banners").getPublicUrl(path);
            setBannerUrl(data.publicUrl);
            setToast({ msg: "Capa atualizada!", type: "success" });
        } catch (error) {
            setToast({ msg: "Erro ao enviar capa.", type: "error" });
        } finally {
            setIsBannerUploading(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLogoUploading(true);
        try {
            const path = await uploadLogoImage(file);
            await supabase.from("restaurants").update({ logo_url: path }).eq("id", restaurant.id);
            
            const { data } = supabase.storage.from("restaurant-logos").getPublicUrl(path);
            setLogoUrl(data.publicUrl);
            setToast({ msg: "Logo atualizada!", type: "success" });
        } catch (error) {
            setToast({ msg: "Erro ao enviar logo.", type: "error" });
        } finally {
            setIsLogoUploading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-20">
            
            {/* Header Section */}
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

            <Card className="p-0 overflow-hidden">
                {/* BANNER AREA */}
                <div 
                    className="relative h-48 bg-gray-100 group cursor-pointer overflow-hidden border-b border-gray-200"
                    onClick={() => bannerInputRef.current?.click()}
                >
                    <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={handleBannerUpload} />
                    
                    {isBannerUploading ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-gray-400" />
                        </div>
                    ) : bannerUrl ? (
                        <img src={bannerUrl} alt="Capa" className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                            <FontAwesomeIcon icon={icons.faGripLines} className="text-3xl opacity-20" />
                        </div>
                    )}

                    {/* Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                        <span className="text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 drop-shadow-md">
                            <FontAwesomeIcon icon={icons.faEdit} /> Alterar Capa
                        </span>
                    </div>
                </div>

                {/* LOGO + INFO AREA */}
                <div className="px-8 pb-8 relative">
                    {/* Logo Flutuante */}
                    <div 
                        className="absolute -top-12 left-8 w-24 h-24 bg-white rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 cursor-pointer overflow-hidden hover:brightness-95 transition-all group"
                        onClick={(e) => { e.stopPropagation(); logoInputRef.current?.click(); }}
                    >
                        <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        
                        {isLogoUploading ? (
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-brand" />
                        ) : logoUrl ? (
                            <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                        ) : (
                            <FontAwesomeIcon icon={icons.faStore} className="text-2xl text-gray-300" />
                        )}

                        {/* Mini Overlay para Logo */}
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <FontAwesomeIcon icon={icons.faEdit} className="text-white text-xs" />
                        </div>
                    </div>

                    {/* Espaço para a logo não sobrepor o texto */}
                    <div className="pt-16 space-y-6">
                        <Input 
                            label="Nome do Restaurante"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => autoSave("name", name)}
                            placeholder="Ex: Burger King"
                            className="text-lg font-medium"
                        />

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Bio</label>
                            <textarea 
                                className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-brand focus:border-brand outline-none min-h-[100px] resize-none"
                                placeholder="Conte um pouco sobre sua loja..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                onBlur={() => autoSave("description", description)}
                            />
                            <p className="text-xs text-gray-400 mt-1 text-right">{description.length}/250</p>
                        </div>
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
        </div>
    );
}