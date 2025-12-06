"use client";

import { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/fontawesome";
import { supabase } from "@/lib/database/supabaseClient";
import { uploadBannerImage } from "@/lib/uploadBannerImage";
import { uploadLogoImage } from "@/lib/uploadLogoImage";
import Loader from "@/components/ui/Loader";

interface StoreVisualsProps {
    restaurantId: string;
    logoUrl: string | null;
    bannerUrl: string | null;
    onUpdate: (type: "logo" | "banner", url: string) => void; // Comunica a mudança pro pai
    onError: (msg: string) => void;
}

export default function StoreVisuals({ 
    restaurantId, 
    logoUrl, 
    bannerUrl, 
    onUpdate, 
    onError 
}: StoreVisualsProps) {
    const [isBannerUploading, setIsBannerUploading] = useState(false);
    const [isLogoUploading, setIsLogoUploading] = useState(false);
    
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsBannerUploading(true);
        try {
            const path = await uploadBannerImage(file);
            await supabase.from("restaurants").update({ banner_url: path }).eq("id", restaurantId);
            
            const { data } = supabase.storage.from("menu-banners").getPublicUrl(path);
            onUpdate("banner", data.publicUrl);
        } catch (error) {
            onError("Erro ao enviar capa.");
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
            await supabase.from("restaurants").update({ logo_url: path }).eq("id", restaurantId);
            
            const { data } = supabase.storage.from("restaurant-logos").getPublicUrl(path);
            onUpdate("logo", data.publicUrl);
        } catch (error) {
            onError("Erro ao enviar logo.");
        } finally {
            setIsLogoUploading(false);
        }
    };

    return (
        <div className="relative mb-12">
            {/* BANNER */}
            <div 
                className="relative h-48 bg-gray-100 group cursor-pointer overflow-hidden border-b border-gray-200"
                onClick={() => bannerInputRef.current?.click()}
            >
                <input type="file" ref={bannerInputRef} className="hidden" accept="image/*" onChange={handleBannerUpload} />
                
                {isBannerUploading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                        <Loader />
                    </div>
                ) : bannerUrl ? (
                    <img src={bannerUrl} alt="Capa" className="w-full h-full object-cover" />
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                        <FontAwesomeIcon icon={icons.faGripLines} className="text-3xl opacity-20" />
                    </div>
                )}

                {/* Overlay Banner */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                    <span className="text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 drop-shadow-md">
                        <FontAwesomeIcon icon={icons.faEdit} /> Alterar Capa
                    </span>
                </div>
            </div>

            {/* LOGO */}
            <div 
                className="absolute bottom-5 left-8 w-24 h-24 bg-white rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 cursor-pointer overflow-hidden hover:brightness-95 transition-all group/logo"
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

                {/* Overlay Logo */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition-opacity">
                    <FontAwesomeIcon icon={icons.faEdit} className="text-white text-xs" />
                </div>
            </div>
        </div>
    );
}