"use client";

import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faTrash, faCheck, faTimes, faSpinner, faCog } from "@fortawesome/free-solid-svg-icons";
import { uploadMenuImage } from "@/lib/uploadMenuImage"; 
import { supabase } from "@/lib/supabaseClient";
import ToggleInput from "@/components/ui/ToggleInput"; // Assumindo que você tem esse componente, se não, usarei um input checkbox simples

export type MenuItemType = {
    id: string;
    name: string;
    price_cents: number;
    description?: string | null;
    image_url?: string | null; 
    image_path?: string | null;
    is_available: boolean;
    category_id: string;
};

interface MenuItemRowProps {
    item: MenuItemType;
    isNew?: boolean; 
    onSave: (item: MenuItemType) => Promise<void>;
    onDelete?: (id: string) => void;
    onCancel?: () => void;
    onOpenDetails?: () => void; // Conexão com o Modal de Complementos
}

export default function MenuItemRow({ 
    item, 
    isNew = false, 
    onSave, 
    onDelete,
    onCancel,
    onOpenDetails
}: MenuItemRowProps) {
    const [isEditing, setIsEditing] = useState(isNew);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    // Estados locais
    const [name, setName] = useState(item.name);
    const [description, setDescription] = useState(item.description || "");
    const [price, setPrice] = useState((item.price_cents / 100).toFixed(2).replace(".", ","));
    const [imageUrl, setImageUrl] = useState(item.image_url); 
    const [imagePath, setImagePath] = useState(item.image_path);
    // Estado local de disponibilidade para feedback instantâneo
    const [isAvailable, setIsAvailable] = useState(item.is_available);

    const nameInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isNew && nameInputRef.current) nameInputRef.current.focus();
    }, [isNew]);

    // --- AÇÕES ---

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const path = await uploadMenuImage(file);
            const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
            setImagePath(path);
            setImageUrl(data.publicUrl);

            // Auto-save se não estiver editando texto
            if (!isEditing && !isNew) {
                await onSave({ ...item, image_path: path, image_url: data.publicUrl });
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar imagem.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleToggleAvailability = async (e: React.MouseEvent) => {
        e.stopPropagation(); // Não abre modo edição
        const newState = !isAvailable;
        setIsAvailable(newState); // UI otimista
        try {
            await onSave({ ...item, is_available: newState });
        } catch (error) {
            setIsAvailable(!newState); // Reverte se der erro
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsLoading(true);
        try {
            const cleanPrice = price.replace(/[^0-9,]/g, "").replace(",", ".");
            const priceCents = Math.round(parseFloat(cleanPrice || "0") * 100);
            
            await onSave({
                ...item,
                name,
                description,
                price_cents: priceCents,
                image_path: imagePath,
                image_url: imageUrl,
                is_available: isAvailable
            });
            
            if (isNew) {
                // Reset para próxima inserção
                setName("");
                setPrice("0,00");
                setDescription("");
                setImageUrl(null);
                setImagePath(null);
                if(onCancel) onCancel();
            } else {
                setIsEditing(false);
            }
        } catch (error) {
            alert("Erro ao salvar.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") {
            if (isNew && onCancel) onCancel();
            else {
                setName(item.name);
                setPrice((item.price_cents / 100).toFixed(2).replace(".", ","));
                setIsEditing(false);
            }
        }
    };

    const renderImageArea = () => (
        <div 
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="w-12 h-12 shrink-0 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden border border-gray-200 cursor-pointer hover:bg-gray-200 transition-all relative group/img"
        >
            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
            {isUploading ? (
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-brand" />
            ) : imageUrl ? (
                <>
                    <img src={imageUrl} alt={name} className={`w-full h-full object-cover ${!isAvailable ? "grayscale" : ""}`} />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <FontAwesomeIcon icon={faImage} className="text-white text-xs" />
                    </div>
                </>
            ) : (
                <FontAwesomeIcon icon={faImage} />
            )}
        </div>
    );

    // --- MODO VISUALIZAÇÃO ---
    if (!isEditing) {
        return (
            <div 
                className={`group flex items-center justify-between p-4 bg-white border-b border-gray-100 hover:bg-gray-50 transition-all cursor-pointer ${!isAvailable ? "opacity-60 bg-gray-50" : ""}`}
                onClick={() => setIsEditing(true)}
            >
                <div className="flex items-center gap-4 overflow-hidden">
                    {renderImageArea()}
                    
                    <div className="flex flex-col min-w-0">
                        <span className="font-medium text-gray-900 truncate">{name}</span>
                        {description ? (
                            <span className="text-xs text-gray-500 truncate block max-w-[200px] sm:max-w-xs">{description}</span>
                        ) : (
                            <span className="text-xs text-gray-300 italic">Sem descrição...</span>
                        )}
                        {!isAvailable && <span className="text-[10px] font-bold text-red-500 uppercase mt-1">Pausado</span>}
                    </div>
                </div>

                <div className="flex items-center gap-4 pl-4">
                    <span className="font-medium text-gray-900 whitespace-nowrap">
                        {parseFloat(price.replace(",", ".")).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    
                    {/* Botão Opções (Complementos) */}
                    {!isNew && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); if(onOpenDetails) onOpenDetails(); }}
                            className="text-sm font-medium text-gray-500 hover:text-brand bg-white border border-gray-200 hover:border-brand px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <FontAwesomeIcon icon={faCog} />
                            <span className="hidden sm:inline cursor-pointer">Opções</span>
                        </button>
                    )}

                    {/* Toggle Disponibilidade */}
                    <div 
                        onClick={handleToggleAvailability}
                        className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors flex items-center ${isAvailable ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"}`}
                        title={isAvailable ? "Pausar item" : "Ativar item"}
                    >
                        <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                    </div>

                    {/* Botão Delete (Hover) */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onDelete && confirm("Excluir item?")) onDelete(item.id);
                        }}
                        className="cursor-pointer w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            </div>
        );
    }

    // --- MODO EDIÇÃO ---
    return (
        <div className="flex flex-col sm:flex-row sm:items-center p-4 bg-white border-b border-gray-100 shadow-md relative z-10 gap-4 animate-fadeUp">
            <div className="flex items-start gap-4 flex-1 w-full">
                {renderImageArea()}
                <div className="flex-1 space-y-2 w-full">
                    <input
                        ref={nameInputRef}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Nome do item"
                        className="w-full text-base font-medium text-gray-900 placeholder-gray-400 border-none p-0 focus:ring-0 bg-transparent outline-none"
                        disabled={isLoading}
                    />
                    <input 
                         value={description}
                         onChange={(e) => setDescription(e.target.value)}
                         onKeyDown={handleKeyDown}
                         placeholder="Adicione uma descrição..."
                         className="w-full text-sm text-gray-600 placeholder-gray-300 border-none p-0 focus:ring-0 bg-transparent outline-none"
                         disabled={isLoading}
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                <div className="relative w-24">
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm text-gray-500">R$</span>
                    <input
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full text-right font-medium text-gray-900 border-b border-gray-300 focus:border-brand p-1 outline-none text-sm bg-transparent"
                        placeholder="0,00"
                        disabled={isLoading}
                    />
                </div>
                
                <div className="flex items-center gap-1">
                    {onCancel && (
                        <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    )}
                    <button onClick={handleSave} disabled={isLoading} className="h-8 px-4 bg-brand text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors disabled:opacity-70 flex items-center gap-2">
                        {isLoading ? "..." : <><FontAwesomeIcon icon={faCheck} /> Salvar</>}
                    </button>
                </div>
            </div>
        </div>
    );
}