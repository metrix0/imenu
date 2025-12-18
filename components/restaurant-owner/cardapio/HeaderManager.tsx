"use client";

import { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import { supabase } from "@/lib/database/supabaseClient";
import { uploadBannerImage } from "@/lib/database/uploadBannerImage";
import { uploadLogoImage } from "@/lib/database/uploadLogoImage";
import Loader from "@/components/ui/Loader";

interface HeaderManagerProps {
    restaurantId: string;
    initialData: {
        logo_url: string | null;
        banner_url?: string | null;
    } | null;
    onUpdate: () => void; // Callback para notificar o pai (toast, reload, etc)
}

export default function HeaderManager({ restaurantId, initialData, onUpdate }: HeaderManagerProps) {
    const [isBannerUploading, setIsBannerUploading] = useState(false);
    const [isLogoUploading, setIsLogoUploading] = useState(false);
    
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Helpers de URL
    const getBannerUrl = () => {
        if (!initialData?.banner_url) return null;
        if (initialData.banner_url.startsWith("http")) return initialData.banner_url;
        return supabase.storage.from("menu-banners").getPublicUrl(initialData.banner_url).data.publicUrl;
    };

    const getLogoUrl = () => {
        if (!initialData?.logo_url) return null;
        return supabase.storage.from("restaurant-logos").getPublicUrl(initialData.logo_url).data.publicUrl;
    };

    const bannerSrc = getBannerUrl();
    const logoSrc = getLogoUrl();

    // Handlers
    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setIsBannerUploading(true);
        try {
            const path = await uploadBannerImage(e.target.files[0]);
            await supabase.from("restaurants").update({ banner_url: path } as any).eq("id", restaurantId);
            onUpdate();
        } catch (error) {
            alert("Erro ao enviar banner.");
        } finally {
            setIsBannerUploading(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0]) return;
        setIsLogoUploading(true);
        try {
            const path = await uploadLogoImage(e.target.files[0]);
            await supabase.from("restaurants").update({ logo_url: path }).eq("id", restaurantId);
            onUpdate();
        } catch (error) {
            alert("Erro ao enviar logo.");
        } finally {
            setIsLogoUploading(false);
        }
    };

    return (
         // WRAPPER PARA SEPARAR OS HOVERS
        <div className="relative mb-16">

            {/* BANNER */}
            <div
                className="relative h-48 bg-gray-100 rounded-xl group cursor-pointer overflow-hidden border border-gray-200 shadow-sm"
                onClick={() => bannerInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={bannerInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleBannerUpload}
                />

                {isBannerUploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                        {/*<FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-gray-400" /> */}
                        <Loader />
                    </div>
                ) : bannerSrc ? (
                    <img src={bannerSrc} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                        <FontAwesomeIcon icon={icons.faGripLines} className="text-3xl opacity-20" />
                    </div>
                )}

                {/* OVERLAY DO BANNER */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                    <span className="text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 drop-shadow-md">
                        <FontAwesomeIcon icon={icons.faEdit} />
                    </span>
                </div>
            </div>

            {/* LOGO — AGORA FORA DO GROUP DO BANNER */}
            <div
                className="absolute bottom-5 left-8 w-24 h-24 rounded-full border-4 border-white shadow-md z-10 cursor-pointer overflow-hidden group/logo"
                onClick={(e) => {
                    e.stopPropagation();
                    logoInputRef.current?.click();
                }}
            >
                <input
                    type="file"
                    ref={logoInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleLogoUpload}
                />

                <div className="w-full h-full bg-white flex items-center justify-center relative">
                    {isLogoUploading ? (
                        <Loader />
                    ) : logoSrc ? (
                        <img src={logoSrc} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                        <FontAwesomeIcon icon={icons.faStore} className="text-2xl text-gray-300" />
                    )}

                    {/* Overlay da logo */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover/logo:bg-black/20 transition-colors">
                        <span className="text-white text-sm opacity-0 group-hover/logo:opacity-100 transition-opacity flex items-center gap-1 drop-shadow-md">
                            <FontAwesomeIcon icon={icons.faEdit} />
                        </span>
                    </div>
                </div>
            </div>

        </div>
    );
}