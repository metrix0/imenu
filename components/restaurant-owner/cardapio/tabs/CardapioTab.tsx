"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {faSearch, faLayerGroup, faPlus, faGripVertical, faWandMagicSparkles} from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown"; // Importando o componente
import CategorySection from "@/components/restaurant-owner/cardapio/CategorySection";
import { MenuItemType } from "@/components/restaurant-owner/cardapio/MenuItemRow";

type Category = { id: string; name: string; position: number };

interface CardapioTabProps {
    categories: Category[];
    items: MenuItemType[];
    restaurantId: string;
    onRefresh: () => void;
    onEditCategory: (cat: Category) => void;
    onOpenItemDetails: (item: MenuItemType) => void;
    onNewCategory: () => void;
    onAIScanMenu?: React.Dispatch<React.SetStateAction<boolean>> | (() => void);
}

export default function CardapioTab({
    categories,
    items,
    restaurantId,
    onRefresh,
    onEditCategory,
    onOpenItemDetails,
    onNewCategory,
    onAIScanMenu
}: CardapioTabProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategoryId, setSelectedCategoryId] = useState(""); 
    
    const [localCategories, setLocalCategories] = useState<Category[]>(categories);
    const [draggedCatId, setDraggedCatId] = useState<string | null>(null);

    useEffect(() => {
        setLocalCategories(categories);
    }, [categories]);

    const handleDragStart = (e: React.DragEvent, catId: string) => {
        setDraggedCatId(catId);
        e.dataTransfer.effectAllowed = "move";
        const target = e.currentTarget as HTMLElement;
        setTimeout(() => target.style.opacity = "0.4", 0);
    };
    const handleDragEnd = (e: React.DragEvent) => {
        const target = e.currentTarget as HTMLElement;
        target.style.opacity = "1";
        setDraggedCatId(null);
    };
    const handleDragOver = (e: React.DragEvent, targetCatId: string) => {
        e.preventDefault();
        if (!draggedCatId || draggedCatId === targetCatId) return;
        const currentList = [...localCategories];
        const draggedIndex = currentList.findIndex(c => c.id === draggedCatId);
        const targetIndex = currentList.findIndex(c => c.id === targetCatId);
        if (draggedIndex === -1 || targetIndex === -1) return;
        const [removed] = currentList.splice(draggedIndex, 1);
        currentList.splice(targetIndex, 0, removed);
        const updatedList = currentList.map((cat, index) => ({ ...cat, position: index }));
        setLocalCategories(updatedList);
    };
    const saveOrder = async (finalList: Category[]) => {
        try {
            const updates = finalList.map(cat => 
                supabase.from("categories").update({ position: cat.position }).eq("id", cat.id)
            );
            await Promise.all(updates);
        } catch (error) { console.error(error); }
    };
    const handleFinalDragEnd = (e: React.DragEvent) => {
        handleDragEnd(e);
        saveOrder(localCategories);
    };

    const isFiltering = searchTerm.length > 0 || selectedCategoryId !== "";
    
    const displayCategories = localCategories.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSelect = selectedCategoryId ? c.id === selectedCategoryId : true;
        return matchesSearch && matchesSelect;
    });

    // --- ESTADO VAZIO ---
    if (categories.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="w-40 h-40 bg-red-50 rounded-full flex items-center justify-center mb-6">
                    <FontAwesomeIcon icon={faLayerGroup} className="text-5xl text-brand/50" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Você ainda não possui nenhuma categoria criada</h3>
                <p className="text-gray-500 text-sm mb-8 text-center max-w-md">
                    Adicione uma categoria agora mesmo clicando no botão "Adicionar categoria"
                </p>
                <div className={"flex gap-4"}>
                <Button variant="secondary" onClick={onNewCategory} className="text-brand border-brand/20 hover:bg-brand/5">
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    Adicionar categoria
                </Button>
                <Button
                    onClick={() => onAIScanMenu?.(true)}
                    variant={"secondary"}
                >
                    <FontAwesomeIcon icon={faWandMagicSparkles} className="text-sm mr-2" /> Scanear Cardápio com IA
                </Button>
                </div>
            </div>
        );
    }

    // Prepara as opções para o Dropdown
    const categoryOptions = [
        { value: "", label: "Todas as categorias" },
        ...categories.map(c => ({ value: c.id, label: c.name }))
    ];

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <Input 
                        placeholder="Buscar uma categoria" 
                        icon={<FontAwesomeIcon icon={faSearch} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full md:w-64">
                    {/* Substituído pelo Dropdown Component */}
                    <Dropdown 
                        options={categoryOptions}
                        value={selectedCategoryId}
                        onChange={(e) => setSelectedCategoryId(e.target.value)}
                    />
                </div>
                <Button variant="secondary" onClick={onNewCategory} className="whitespace-nowrap">
                    Adicionar categoria
                </Button>
            </div>

            {/* Lista de Categorias */}
            <div className="space-y-4">
                {displayCategories.map(category => (
                    <div 
                        key={category.id}
                        draggable={!isFiltering}
                        onDragStart={(e) => handleDragStart(e, category.id)}
                        onDragOver={(e) => handleDragOver(e, category.id)}
                        onDragEnd={handleFinalDragEnd}
                        className="transition-transform"
                    >
                        <CategorySection 
                            category={category}
                            items={items.filter(i => i.category_id === category.id)}
                            restaurantId={restaurantId}
                            onRefresh={onRefresh} 
                            onEditCategory={() => onEditCategory(category)}
                            onOpenItemDetails={onOpenItemDetails}
                            dragHandle={!isFiltering ? <FontAwesomeIcon icon={faGripVertical} /> : null}
                        />
                    </div>
                ))}
                
                {displayCategories.length === 0 && (
                    <p className="text-center text-gray-500 py-10">Nenhuma categoria encontrada.</p>
                )}
            </div>
        </div>
    );
}