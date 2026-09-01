"use client";

import { useState, useRef } from "react";
import Cropper from "react-easy-crop"; // Biblioteca de Crop
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSpinner, faCheck, faTimes, faSearchPlus, faSearchMinus } from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import { supabase } from "@/lib/database/supabaseClient";
import { uploadBannerImage } from "@/lib/database/uploadBannerImage";
import { uploadLogoImage } from "@/lib/database/uploadLogoImage";
import { getCroppedImg } from "@/lib/utils/canvasUtils"; // Nosso helper criado
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button"; // Reutilizando seu botão
import Modal from "@/components/ui/Modal"; // Reutilizando seu modal

interface StoreVisualsProps {
    restaurantId: string;
    logoUrl: string | null;
    bannerUrl: string | null;
    onUpdate: (type: "logo" | "banner", publicUrl: string, dbPath: string) => void;
    onError: (msg: string) => void;
}

export default function StoreVisuals({ 
    restaurantId, 
    logoUrl, 
    bannerUrl, 
    onUpdate, 
    onError 
}: StoreVisualsProps) {
    const [isUploading, setIsUploading] = useState(false);
    
    // --- ESTADOS DO CROPPER ---
    const [cropImage, setCropImage] = useState<string | null>(null); // A imagem em base64 sendo editada
    const [cropType, setCropType] = useState<"logo" | "banner" | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
    
    const bannerInputRef = useRef<HTMLInputElement>(null);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // 1. O usuário seleciona o arquivo -> Lemos e abrimos o Modal
    const onSelectFile = (e: React.ChangeEvent<HTMLInputElement>, type: "logo" | "banner") => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener("load", () => {
                setCropImage(reader.result as string);
                setCropType(type);
                setZoom(1); // Reset zoom
            });
            reader.readAsDataURL(file);
        }
        // Limpa o input para permitir selecionar a mesma foto se cancelar e tentar de novo
        e.target.value = "";
    };

    const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
        setCroppedAreaPixels(croppedAreaPixels);
    };

    // 2. O usuário confirma o corte -> Geramos o arquivo e fazemos upload
    const handleCropSave = async () => {
        if (!cropImage || !cropType || !croppedAreaPixels) return;

        setIsUploading(true);
        try {
            // Gera o arquivo cortado usando nosso helper
            const croppedFile = await getCroppedImg(
                cropImage,
                croppedAreaPixels,
                `cropped-${cropType}.jpg`
            );

            if (!croppedFile) throw new Error("Falha ao cortar imagem");

            let path = "";
            let publicUrl = "";

            if (cropType === "banner") {
                path = await uploadBannerImage(croppedFile);
                const res = supabase.storage.from("menu-banners").getPublicUrl(path);
                publicUrl = res.data.publicUrl;
            } else {
                path = await uploadLogoImage(croppedFile);
                const res = supabase.storage.from("restaurant-logos").getPublicUrl(path);
                publicUrl = res.data.publicUrl;
            }

            onUpdate(cropType, publicUrl, path);
            handleCloseCrop(); // Fecha modal
        } catch (error) {
            console.error(error);
            onError("Erro ao processar imagem.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleCloseCrop = () => {
        setCropImage(null);
        setCropType(null);
        setIsUploading(false);
    };

    return (
        <div className="relative mb-12 2xl:mb-16">
            
            {/* --- MODAL DE RECORTE --- */}
            <Modal open={!!cropImage} onClose={handleCloseCrop} className="max-w-2xl w-full">
                <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 mb-4">
                        Ajustar {cropType === "logo" ? "Logotipo" : "Capa"}
                    </h3>
                    
                    {/* Área do Cropper */}
                    <div className="relative w-full h-[400px] bg-gray-900 rounded-lg overflow-hidden mb-6">
                        {cropImage && (
                            <Cropper
                                image={cropImage}
                                crop={crop}
                                zoom={zoom}
                                aspect={cropType === "logo" ? 1 / 1 : 4 / 1} // 1:1 para Logo, 4:1 para Banner
                                onCropChange={setCrop}
                                onCropComplete={onCropComplete}
                                onZoomChange={setZoom}
                                showGrid={true}
                                cropShape={cropType === "logo" ? "round" : "rect"} // Logo redondo para preview (opcional)
                            />
                        )}
                    </div>

                    {/* Controles de Zoom */}
                    <div className="flex items-center gap-4 mb-6">
                         <FontAwesomeIcon icon={faSearchMinus} className="text-gray-400" />
                         <input
                            type="range"
                            value={zoom}
                            min={1}
                            max={3}
                            step={0.1}
                            aria-labelledby="Zoom"
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-brand"
                        />
                        <FontAwesomeIcon icon={faSearchPlus} className="text-gray-400" />
                    </div>

                    <div className="flex justify-between items-center">
                        <span className="text-xs text-gray-500">
                             {cropType === "logo" ? "Logos quadrados ficam melhores." : "Arraste para centralizar o banner."}
                        </span>
                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={handleCloseCrop} disabled={isUploading}>
                                Cancelar
                            </Button>
                            <Button onClick={handleCropSave} loading={isUploading}>
                                <FontAwesomeIcon icon={faCheck} className="mr-2" />
                                Salvar Recorte
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>


            {/* --- UI PRINCIPAL (BANNER) --- */}
            <div className="relative group">
                <div 
                    className="relative h-48 2xl:h-60 2xl:rounded-lg bg-gray-100 cursor-pointer overflow-hidden border-b border-gray-200"
                    onClick={() => bannerInputRef.current?.click()}
                >
                    <input 
                        type="file" 
                        ref={bannerInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => onSelectFile(e, "banner")} 
                    />
                    
                    {bannerUrl ? (
                        <img src={bannerUrl} alt="Capa" className="w-full h-full object-cover" />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2">
                            <FontAwesomeIcon icon={icons.faGripLines} className="text-3xl opacity-20" />
                        </div>
                    )}

                    {/* Overlay Banner */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                        <span className="text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 drop-shadow-md">
                            <FontAwesomeIcon icon={icons.faEdit} /> Alterar Capa
                        </span>
                    </div>
                </div>
                
                {/* Dica de Resolução Banner */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm pointer-events-none">
                    Recomendado: 560x250px
                </div>
            </div>


            {/* --- UI PRINCIPAL (LOGO) --- */}
            <div className="relative">
                <div 
                    className="absolute -top-12 left-8 w-24 h-24 2xl:w-28 2xl:h-28 bg-white rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 cursor-pointer overflow-hidden hover:brightness-95 transition-all group/logo"
                    onClick={(e) => { e.stopPropagation(); logoInputRef.current?.click(); }}
                >
                    <input 
                        type="file" 
                        ref={logoInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={(e) => onSelectFile(e, "logo")} 
                    />
                    
                    {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                        <FontAwesomeIcon icon={icons.faStore} className="text-2xl text-gray-300" />
                    )}

                    {/* Overlay Logo */}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/logo:opacity-100 flex items-center justify-center transition-opacity">
                        <FontAwesomeIcon icon={icons.faEdit} className="text-white text-xs" />
                    </div>
                </div>

                {/* Dica de Resolução Logo (Aparece ao lado da logo quando hover nela) */}
                <div className="absolute -top-4 left-36 opacity-0 group-hover/logo:opacity-100 transition-opacity bg-gray-800 text-white text-[10px] px-2 py-1 rounded shadow-sm pointer-events-none whitespace-nowrap z-20">
                    Recomendado: 500x500px (1:1)
                </div>
            </div>
        </div>
    );
}