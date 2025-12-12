"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faImage, faTrash, faCheck, faTimes, faSpinner, faCog, faCopy } from "@fortawesome/free-solid-svg-icons";
import { uploadMenuImage } from "@/lib/uploadMenuImage"; 
import { supabase } from "@/lib/database/supabaseClient";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";

export type MenuItemType = {
    id: string;
    name: string;
    price_cents: number;
    description?: string | null;
    image_url?: string | null; 
    image_path?: string | null;
    is_available: boolean;
    category_id: string;
    position?: number; // Adicionado para tipagem correta
};

interface MenuItemRowProps {
    item: MenuItemType;
    isNew?: boolean; 
    onSave: (item: MenuItemType) => Promise<void>;
    onDelete?: (id: string) => void;
    onDuplicate?: (item: MenuItemType) => void;
    onCancel?: () => void;
    onOpenDetails?: () => void; 
    dragHandle?: ReactNode; // NOVA PROP PARA O ÍCONE DE ARRASTAR
}

export default function MenuItemRow({ 
    item, 
    isNew = false, 
    onSave, 
    onDelete,
    onDuplicate,
    onCancel,
    onOpenDetails,
    dragHandle
}: MenuItemRowProps) {
    const [isEditing, setIsEditing] = useState(isNew);
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    // Estados locais
    const [name, setName] = useState(item.name ?? "");
    const [description, setDescription] = useState(item.description ?? "");
    const [priceCents, setPriceCents] = useState(item.price_cents ?? 0);
    const [imageUrl, setImageUrl] = useState(item.image_url ?? null); 
    const [imagePath, setImagePath] = useState(item.image_path ?? null);
    const [isAvailable, setIsAvailable] = useState(item.is_available ?? false);

    const nameInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isNew && nameInputRef.current) nameInputRef.current.focus();
    }, [isNew]);

    // --- AÇÕES ---
    const autoSave = async (overrideData?: Partial<MenuItemType>) => {
        if (isNew) return; 
        if (!name.trim()) return;

        setIsLoading(true);
        try {
            await onSave({
                ...item,
                name,
                description,
                price_cents: priceCents,
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
                const res = await fetch(`/api/items/${String(item.id)}/toggle`, {
                    method: "PATCH",
                });

                const json = await res.json();

                if (!res.ok) throw new Error(json.error || "Failed to toggle");

                setIsAvailable(json.item.is_available);
            } catch (err) {
                console.error(err);
                setIsAvailable(!newState); // rollback
            }
        }
    };

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsLoading(true);
        try {
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
                setName("");
                setPriceCents(0);
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
                setPriceCents(item.price_cents);
                setIsEditing(false);
            }
        }
    };

    const renderImageArea = () => (
        <div 
            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            className="w-12 h-12 2xl:h-18 2xl:w-18 shrink-0 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 overflow-hidden border border-gray-200 cursor-pointer hover:bg-gray-200 transition-all relative group/img"
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
                className={`group flex items-center justify-between p-4 2xl:p-5 bg-white border-b border-gray-100 hover:bg-gray-50 transition-all cursor-pointer ${!isAvailable ? "opacity-60 bg-gray-50" : ""}`}
                onClick={() => setIsEditing(true)}
            >
                <div className="flex items-center gap-3 2xl:gap-4 overflow-hidden">
                    {/* Renderiza o cabo de arrastar se fornecido */}
                    {dragHandle && (
                        <div 
                            className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing p-1 -ml-2"
                            onClick={(e) => e.stopPropagation()} // Evita abrir edição ao clicar no drag handle
                        >
                            {dragHandle}
                        </div>
                    )}

                    {renderImageArea()}
                    
                    <div className="flex flex-col min-w-0 2xl:text-lg">
                        <span className="font-medium text-gray-900 truncate">{name}</span>
                        {description ? (
                            <span className="text-xs 2xl:text-base text-gray-500 truncate block max-w-[200px] sm:max-w-xs">{description}</span>
                        ) : (
                            <span className="text-xs 2xl:text-base text-gray-300 italic">Sem descrição...</span>
                        )}
                        {!isAvailable && <span className="text-[10px] font-bold text-red-500 uppercase mt-1">Pausado</span>}
                    </div>
                </div>

                <div className="flex items-center gap-4 2xl:gap-6 pl-4 2xl:text-lg">
                    <span className="font-medium text-gray-900 whitespace-nowrap">
                        {(priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                    
                    {!isNew && (
                        <>
                            {/* Botão Opções */}
                            <Button 
                                variant="secondary"
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if(onOpenDetails) onOpenDetails(); 
                                }}
                                className="px-3 py-1.5 h-auto text-sm font-medium text-gray-500  hover:border-brand gap-2"
                                title="Gerenciar complementos e opções"
                            >
                                <FontAwesomeIcon icon={faCog} />
                                <span className="hidden sm:inline">Opções</span>
                            </Button>

                            {/* Botão Duplicar (Novo) */}
                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation(); 
                                    if(onDuplicate) onDuplicate(item); 
                                }}
                                className="cursor-pointer w-8 h-8 2xl:text-2xl flex items-center justify-center text-gray-400 hover:text-brand hover:bg-gray-50 rounded-full transition-colors"
                                title="Duplicar item"
                            >
                                <FontAwesomeIcon icon={faCopy} />
                            </button>
                        </>
                    )}

                    <div 
                        onClick={handleToggleAvailability}
                        className={`w-10 2xl:w-15 h-6 2xl:h-8 rounded-full p-1 cursor-pointer transition-colors flex items-center ${isAvailable ? "bg-green-500 justify-end" : "bg-gray-300 justify-start"}`}
                        title={isAvailable ? "Pausar item" : "Ativar item"}
                    >
                        <div className="w-4 h-4 2xl:h-6 2xl:w-6 bg-white rounded-full shadow-md" />
                    </div>

                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsDeleteModalOpen(true);
                        }}
                        className="cursor-pointer w-8 h-8 2xl:text-2xl flex items-center justify-center text-gray-400 hover:text-red-600 transition-all"
                        title="Deletar item"
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
                description={`Tem certeza que deseja excluir "${name}"?`}
                confirmLabel="Excluir"
                variant="danger"
            />
            </>
        );
    }

    // --- MODO EDIÇÃO ---
    return (
        <div className="flex flex-col sm:flex-row sm:items-center p-4 bg-white border-b border-gray-100 shadow-md relative z-10 gap-4 animate-fadeUp">
            <div className="flex items-start gap-4 flex-1 w-full 2xl:items-center">
                {renderImageArea()}
                <div className="flex-1 space-y-2 2xl:space-y-0 w-full ">
                    <input
                        ref={nameInputRef}
                        value={name ?? ""}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={() => autoSave()}
                        onKeyDown={handleKeyDown}
                        placeholder="Nome do item"
                        className="w-full text-base 2xl:text-lg font-medium text-gray-900 placeholder-gray-400 border-none p-0 focus:ring-0 bg-transparent outline-none"
                        disabled={isLoading}
                    />
                    <input 
                         value={description ?? ""}
                         onChange={(e) => setDescription(e.target.value)}
                         onBlur={() => autoSave()}
                         onKeyDown={handleKeyDown}
                         placeholder="Adicione uma descrição..."
                         className="w-full text-sm 2xl:text-base text-gray-600 placeholder-gray-300 border-none p-0 focus:ring-0 bg-transparent outline-none"
                         disabled={isLoading}
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 2xl:gap-5 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50">
                <div className="relative w-24 2xl:w-26 flex items-center">
                    <span className="text-sm text-gray-500 2xl:mr-2 2xl:text-lg">R$</span>
                    <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={(priceCents / 100).toFixed(2)}
                        onChange={(e) => {
                            const val = Math.round(parseFloat(e.target.value) * 100);
                            if (!isNaN(val)) setPriceCents(val);
                        }}
                        onBlur={() => autoSave()}
                        onKeyDown={handleKeyDown}
                        className="w-full 2xl:text-lg text-right font-medium text-gray-900 border-b border-gray-300 focus:border-brand p-1 outline-none text-sm bg-transparent"
                        placeholder="0.00"
                        disabled={isLoading}
                    />
                </div>
                
                <div className="flex items-center gap-1">
                    {onCancel && (
                        <button onClick={onCancel} className="2xl:text-xl cursor-pointer w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors">
                            <FontAwesomeIcon icon={faTimes} />
                        </button>
                    )}
                    <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleSave}
                        className="cursor-pointer h-8 px-4 2xl:px-6 2xl:text-lg 2xl:h-10 bg-brand text-white text-sm font-medium rounded-md hover:bg-orange-600 transition-colors disabled:opacity-70 flex items-center gap-2"
                    >
                        {isLoading ? "..." : <><FontAwesomeIcon icon={faCheck} /> Salvar</>}
                    </button>
                </div>
            </div>
        </div>
    );
}