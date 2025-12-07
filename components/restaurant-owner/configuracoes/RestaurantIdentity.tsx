"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { uploadLogoImage } from "@/lib/uploadLogoImage"; // Usando a helper function
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faSpinner } from "@fortawesome/free-solid-svg-icons";
import Input from "@/components/ui/Input";
import Card from "@/components/ui/Card"; // Usando o componente de Card

interface RestaurantIdentityProps {
    restaurantId: string | null;
    name: string;
    setName: (name: string) => void;
    logoUrl: string | null;
    setLogoUrl: (url: string | null) => void;
    className?: string;
}

export default function RestaurantIdentity({
    restaurantId,
    name,
    setName,
    logoUrl,
    setLogoUrl,
    className = ""
}: RestaurantIdentityProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleLogoClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !restaurantId) return;

        setIsUploading(true);
        try {
            // 1. Upload usando a helper function (limpa o código aqui)
            const filePath = await uploadLogoImage(file);

            // 2. Get Public URL for preview
            const { data: { publicUrl } } = supabase.storage
                .from('restaurant-logos')
                .getPublicUrl(filePath);

            setLogoUrl(publicUrl);

            // 3. Salva o path no DB
            await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logo_url: filePath }), 
            });

        } catch (err) {
            console.error("Error uploading logo:", err);
            alert("Erro ao fazer upload da imagem.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        // Substituímos a div manual pelo componente Card
        <Card className={`flex flex-col sm:flex-row items-center gap-6 p-6 ${className}`}>
            {/* Logo Upload */}
            <div className="relative group cursor-pointer flex-shrink-0" onClick={handleLogoClick}>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    accept="image/*" 
                    className="hidden" 
                />
                
                <div className={`w-24 h-24 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative bg-gray-50 transition-all group-hover:border-brand ${isUploading ? 'opacity-50' : ''}`}>
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                        <FontAwesomeIcon icon={faCamera} className="text-gray-400 text-2xl group-hover:text-brand" />
                    )}
                    
                    {/* Overlay on Hover */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <span className="text-white text-xs font-medium">Alterar</span>
                    </div>
                </div>

                {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <FontAwesomeIcon icon={faSpinner} spin className="text-brand text-xl" />
                    </div>
                )}
            </div>

            {/* Name Input */}
            <div className="flex-1 w-full">
                {/* Usando a prop label do Input diretamente */}
                <Input 
                    label="Nome do Restaurante*"
                    value={name || ""}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Hamburgueria do João"
                    className="text-lg font-medium"
                />
                <p className="text-xs text-gray-400 mt-2">
                    Este nome aparecerá no cardápio e na URL.
                </p>
            </div>
        </Card>
    );
}