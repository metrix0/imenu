"use client";

import { useState, useRef, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faTrash, faCheck, faTimes, faSpinner, faCog } from "@fortawesome/free-solid-svg-icons";
import { uploadMenuImage } from "@/lib/uploadMenuImage"; 
import { supabase } from "@/lib/supabaseClient";
import ToggleInput from "@/components/ui/ToggleInput"; 
import ConfirmModal from "@/components/ui/ConfirmModal";

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
    onOpenDetails?: () => void; 
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
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Estados locais
    const [name, setName] = useState(item.name);
    const [description, setDescription] = useState(item.description || "");
    
    // LÓGICA DE PREÇO ALTERADA (String para edição livre)
    // Inicializa com o valor formatado "X.XX"
    const [priceString, setPriceString] = useState((item.price_cents / 100).toFixed(2));
    
    const [imageUrl, setImageUrl] = useState(item.image_url); 
    const [imagePath, setImagePath] = useState(item.image_path);
    const [isAvailable, setIsAvailable] = useState(item.is_available);

    const nameInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isNew && nameInputRef.current) nameInputRef.current.focus();
    }, [isNew]);

    // --- AÇÕES ---

    // Função de Auto-Save (RealTime)
    const autoSave = async (overrideData?: Partial<MenuItemType>) => {
        if (isNew) return; 
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            // CONVERSÃO FINAL AQUI (String -> Centavos)
            // Substitui vírgula por ponto para garantir float correto
            const safePriceString = priceString.replace(",", ".");
            const finalPriceCents = Math.round(parseFloat(safePriceString || "0") * 100);

            // Formata visualmente de volta para X.XX (UX: Feedback de que salvou formatado)
            if (!isNaN(parseFloat(safePriceString))) {
                setPriceString(parseFloat(safePriceString).toFixed(2));
            }

            await onSave({
                ...item,
                name,
                description,
                price_cents: finalPriceCents,
                image_path: imagePath,
                image_url: imageUrl,
                is_available: isAvailable,
                ...overrideData
            });
        } catch (error) {
            console.error("Erro no auto-save:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const path = await uploadMenuImage(file);
            const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
            setImagePath(path);
            setImageUrl(data.publicUrl);

            if (!isNew) {
                await autoSave({ image_path: path, image_url: data.publicUrl });
            }
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar imagem.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleToggleAvailability = async (e: React.MouseEvent) => {
        e.stopPropagation(); 
        const newState = !isAvailable;
        setIsAvailable(newState); 
        
        if (!isNew) {
            try {
                await onSave({ ...item, is_available: newState });
            } catch (error) {
                setIsAvailable(!newState); 
            }
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsLoading(true);
        try {
            // Mesma conversão do autoSave
            const safePriceString = priceString.replace(",", ".");
            const finalPriceCents = Math.round(parseFloat(safePriceString || "0") * 100);

            await onSave({
                ...item,
                name,
                description,
                price_cents: finalPriceCents,
                image_path: imagePath,
                image_url: imageUrl,
                is_available: isAvailable
            });
            
            if (isNew) {
                setName("");
                setPriceString("0.00");
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.currentTarget.blur(); 
            if (isNew) handleSave();
        }
        if (e.key === "Escape") {
            if (isNew && onCancel) onCancel();
            else {
                setName(item.name);
                // Reverte para o valor original
                setPriceString((item.price_cents / 100).toFixed(2));
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
            <>
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
                        {/* Usa priceString aqui se estiver atualizado, ou converte item.price_cents */}
                        {(item.price_cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    
                    {!isNew && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); if(onOpenDetails) onOpenDetails(); }}
                            className="cursor-pointer text-sm font-medium text-gray-500 hover:text-brand bg-white border border-gray-200 hover:border-brand px-3 py-1.5 rounded-md transition-colors flex items-center gap-2 shadow-sm"
                        >
                            <FontAwesomeIcon icon={faCog} />
                            <span className="hidden sm:inline">Opções</span>
                        </button>
                    )}

                    <div 
                        onClick={handleToggleAvailability}
                        className={`w-10 h-6 rounded-full p-1 cursor-pointer transition-colors flex items-center ${isAvailable ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"}`}
                        title={isAvailable ? "Pausar item" : "Ativar item"}
                    >
                        <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                    </div>

                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsDeleteModalOpen(true);
                        }}
                        className="cursor-pointer w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 transition-all opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                    >
                        <FontAwesomeIcon icon={faTrash} />
                    </button>
                </div>
            </div>
            
            <ConfirmModal 
                open={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={() => {
                    if(onDelete) onDelete(item.id);
                    setIsDeleteModalOpen(false);
                }}
                title="Excluir Item"
                description={`Tem certeza que deseja excluir "${name}"? Essa ação não pode ser desfeita.`}
                confirmLabel="Excluir"
                variant="danger"
            />
            </>
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
                        onBlur={() => autoSave()} 
                        onKeyDown={handleKeyDown}
                        placeholder="Nome do item"
                        className="w-full text-base font-medium text-gray-900 placeholder-gray-400 border-none p-0 focus:ring-0 bg-transparent outline-none"
                        disabled={isLoading}
                    />
                    <input 
                         value={description}
                         onChange={(e) => setDescription(e.target.value)}
                         onBlur={() => autoSave()} 
                         onKeyDown={handleKeyDown}
                         placeholder="Adicione uma descrição..."
                         className="w-full text-sm text-gray-600 placeholder-gray-300 border-none p-0 focus:ring-0 bg-transparent outline-none"
                         disabled={isLoading}
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                <div className="relative w-24 flex items-center">
                    <span className="text-sm text-gray-500 mr-1">R$</span>
                    <input
                        type="number"
                        step="0.5" 
                        min="0"
                        // AQUI ESTÁ O SEGREDO DA EDIÇÃO BOA:
                        // O valor é uma string livre enquanto digita.
                        // Só vira número fixo quando salva/blur.
                        value={priceString}
                        onChange={(e) => setPriceString(e.target.value)}
                        onBlur={() => autoSave()} 
                        onKeyDown={handleKeyDown}
                        className="w-full text-right font-medium text-gray-900 border-b border-gray-300 focus:border-brand p-1 outline-none text-sm bg-transparent"
                        placeholder="0.00"
                        disabled={isLoading}
                    />
                </div>
                
                <div className="flex items-center gap-1">
                    {onCancel && (
                        <button onClick={onCancel} className="cursor-pointer w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    )}
                    <button 
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={handleSave} 
                        disabled={isLoading} 
                        className="cursor-pointer h-8 px-4 bg-brand text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors disabled:opacity-70 flex items-center gap-2"
                    >
                        {isLoading ? "..." : <><FontAwesomeIcon icon={faCheck} /> Salvar</>}
                    </button>
                </div>
            </div>
        </div>
    );
}