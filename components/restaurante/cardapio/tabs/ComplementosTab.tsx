"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faUtensils, faLayerGroup, faTrash, faEdit } from "@fortawesome/free-solid-svg-icons";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ListLoader from "@/components/ui/ListLoader";
import { MenuItemType } from "../MenuItemRow";

// Tipos para exibição
type ComplementGroup = {
    id: string;
    name: string;
    min_select: number;
    max_select: number;
    item_id: string;
    item_name: string; // Para mostrar "Pertence a: X"
};

interface ComplementosTabProps {
    restaurantId: string;
    // Precisamos abrir o modal de detalhes do item para editar o grupo
    onOpenItemDetails: (item: MenuItemType) => void; 
}

export default function ComplementosTab({ restaurantId, onOpenItemDetails }: ComplementosTabProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [groups, setGroups] = useState<ComplementGroup[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    // Buscar todos os grupos do restaurante
    const fetchGroups = async () => {
        setIsLoading(true);
        try {
            // 1. Primeiro buscamos os IDs dos itens deste restaurante
            const { data: items } = await supabase
                .from("items")
                .select("id, name")
                .eq("restaurant_id", restaurantId);

            if (!items || items.length === 0) {
                setGroups([]);
                setIsLoading(false);
                return;
            }

            const itemIds = items.map(i => i.id);
            const itemMap = new Map(items.map(i => [i.id, i.name]));

            // 2. Buscamos as subcategorias desses itens
            const { data: subcats } = await supabase
                .from("item_subcategories")
                .select("*")
                .in("item_id", itemIds)
                .order("created_at", { ascending: false }); // Mais recentes primeiro

            const formattedGroups = (subcats || []).map((g: any) => ({
                id: g.id,
                name: g.name,
                min_select: g.min_select,
                max_select: g.max_select,
                item_id: g.item_id,
                item_name: itemMap.get(g.item_id) || "Item desconhecido"
            }));

            setGroups(formattedGroups);

        } catch (error) {
            console.error("Erro ao buscar complementos:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (restaurantId) fetchGroups();
    }, [restaurantId]);

    // Filtro local
    const filteredGroups = groups.filter(g => 
        g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        g.item_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Ação de Editar: Abre o modal do item pai
    const handleEditGroup = async (group: ComplementGroup) => {
        // Precisamos buscar os dados completos do item para abrir o modal
        const { data: item } = await supabase
            .from("items")
            .select("*")
            .eq("id", group.item_id)
            .single();
        
        if (item) {
            // Adapta para o tipo MenuItemType esperado pelo modal
            const menuItem: MenuItemType = {
                ...item,
                // Se o banco não tiver esses campos, usamos defaults
                image_url: null, 
                is_available: item.is_available ?? true
            };
            onOpenItemDetails(menuItem);
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm("Tem certeza? Isso apagará este grupo e todas as suas opções.")) return;
        
        const { error } = await supabase.from("item_subcategories").delete().eq("id", groupId);
        if (error) {
            alert("Erro ao excluir grupo.");
        } else {
            fetchGroups(); // Recarrega lista
        }
    };

    if (isLoading) {
        return (
            <div className="py-10">
                <ListLoader lines={5} />
            </div>
        );
    }

    // Estado Vazio (Nenhum grupo no total)
    if (groups.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="w-40 h-40 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                     <FontAwesomeIcon icon={faLayerGroup} className="text-5xl text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum grupo de complementos encontrado</h3>
                <p className="text-gray-500 text-sm mb-8 text-center max-w-md">
                    Para criar complementos (como "Escolha o Molho"), vá na aba <strong>Produtos</strong>, clique em "Opções" de um item e adicione lá.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
             {/* Toolbar */}
             <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full">
                    <Input 
                        placeholder="Buscar grupo ou produto..." 
                        icon={<FontAwesomeIcon icon={faSearch} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
             </div>

            {/* Lista de Grupos */}
            <div className="grid grid-cols-1 gap-3">
                {filteredGroups.map(group => (
                    <div key={group.id} className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between hover:border-brand/30 transition-colors shadow-sm">
                        <div className="mb-2 sm:mb-0">
                            <h4 className="text-lg font-bold text-gray-900">{group.name}</h4>
                            <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                <span className="bg-gray-100 px-2 py-0.5 rounded text-xs font-medium text-gray-600">
                                    {group.min_select > 0 ? "Obrigatório" : "Opcional"}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                    <FontAwesomeIcon icon={faUtensils} className="text-xs" />
                                    {group.item_name}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                            <Button 
                                variant="secondary" 
                                onClick={() => handleEditGroup(group)}
                                className="text-xs h-8 px-3"
                            >
                                <FontAwesomeIcon icon={faEdit} className="mr-2" />
                                Editar
                            </Button>
                            <button 
                                onClick={() => handleDeleteGroup(group.id)}
                                className="cursor-pointer w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
                                title="Excluir grupo"
                            >
                                <FontAwesomeIcon icon={faTrash} />
                            </button>
                        </div>
                    </div>
                ))}

                {filteredGroups.length === 0 && searchTerm && (
                    <p className="text-center text-gray-500 py-10">Nenhum grupo encontrado para "{searchTerm}"</p>
                )}
            </div>
        </div>
    );
}