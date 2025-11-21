"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Popup from "@/components/ui/Popup";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import { faTrash, faPlus, faGripLines } from "@fortawesome/free-solid-svg-icons";

interface ItemDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: { id: string; name: string } | null; // Passamos apenas o básico do item
}

// Tipos locais para a UI
type Subitem = {
    id: string;
    name: string;
    price_cents: number;
    is_available: boolean;
    position: number;
};

type Subcategory = {
    id: string;
    name: string;
    min_select: number;
    max_select: number;
    required: boolean; // derivado de min_select > 0
    position: number;
    subitems: Subitem[];
};

export default function ItemDetailsModal({ isOpen, onClose, item }: ItemDetailsModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [groups, setGroups] = useState<Subcategory[]>([]);
    
    // Estado para criar novo grupo
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    // Carregar dados quando o modal abrir
    useEffect(() => {
        if (isOpen && item) {
            loadComplements();
        } else {
            setGroups([]);
        }
    }, [isOpen, item]);

    const loadComplements = async () => {
        if (!item) return;
        setIsLoading(true);
        try {
            // Buscar Grupos (item_subcategories)
            const { data: rawGroups, error: grpErr } = await supabase
                .from("item_subcategories")
                .select("*")
                .eq("item_id", item.id)
                .order("position", { ascending: true });

            if (grpErr) throw grpErr;

            // Para cada grupo, buscar subitens (Isso poderia ser um join, mas separado é mais seguro pro type agora)
            const groupsWithItems = await Promise.all(
                (rawGroups || []).map(async (g) => {
                    const { data: subs } = await supabase
                        .from("subitems")
                        .select("*")
                        .eq("item_subcategory_id", g.id)
                        .order("position", { ascending: true });
                    
                    return {
                        ...g,
                        required: g.min_select > 0,
                        subitems: subs || []
                    };
                })
            );

            setGroups(groupsWithItems);
        } catch (err) {
            console.error("Erro ao carregar complementos:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // --- AÇÕES DE GRUPO (CATEGORIA DE COMPLEMENTO) ---

    const handleAddGroup = async () => {
        if (!newGroupName.trim() || !item) return;
        try {
            const { error } = await supabase.from("item_subcategories").insert({
                item_id: item.id,
                name: newGroupName,
                min_select: 0,
                max_select: 1, // Padrão: escolha 1
                position: groups.length
            });
            if (error) throw error;
            setNewGroupName("");
            setIsAddingGroup(false);
            loadComplements();
        } catch (err) {
            alert("Erro ao criar grupo.");
        }
    };

    const handleDeleteGroup = async (groupId: string) => {
        if (!confirm("Isso apagará todas as opções dentro deste grupo.")) return;
        // O cascade do banco deve apagar os subitems, mas vamos garantir no front
        await supabase.from("item_subcategories").delete().eq("id", groupId);
        loadComplements();
    };

    const handleUpdateGroup = async (groupId: string, updates: Partial<Subcategory>) => {
        // Atualização otimista
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
        
        // Se mudou 'required', ajustamos o min_select
        let dbUpdates: any = { ...updates };
        if (updates.required !== undefined) {
            dbUpdates.min_select = updates.required ? 1 : 0;
            delete dbUpdates.required;
            delete dbUpdates.subitems; // não mandar subitems pro update do grupo
        }

        await supabase.from("item_subcategories").update(dbUpdates).eq("id", groupId);
    };

    // --- AÇÕES DE SUBITEM (OPÇÃO) ---

    const handleAddSubitem = async (groupId: string) => {
        // Cria um subitem placeholder
        const { error } = await supabase.from("subitems").insert({
            item_subcategory_id: groupId,
            name: "Nova Opção",
            price_cents: 0,
            is_available: true,
            position: 999
        });
        if (error) alert("Erro ao criar opção");
        else loadComplements();
    };

    const handleUpdateSubitem = async (subitemId: string, updates: Partial<Subitem>) => {
        // Update otimista local
        setGroups(prev => prev.map(g => ({
            ...g,
            subitems: g.subitems.map(s => s.id === subitemId ? { ...s, ...updates } : s)
        })));

        // Debounce seria ideal aqui, mas para MVP vai direto
        await supabase.from("subitems").update(updates).eq("id", subitemId);
    };

    const handleDeleteSubitem = async (subitemId: string) => {
        await supabase.from("subitems").delete().eq("id", subitemId);
        loadComplements();
    };

    return (
        <Popup open={isOpen} onClose={onClose}>
            <div className="w-full max-w-2xl bg-white rounded-lg flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Complementos e Opções</h2>
                        <p className="text-gray-500 text-sm">Para: <span className="font-medium text-brand">{item?.name}</span></p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <FontAwesomeIcon icon={icons.faTimes} className="text-xl" />
                    </button>
                </div>

                {/* Body Scrollable */}
                <div className="p-6 overflow-y-auto flex-1 space-y-8">
                    {isLoading && groups.length === 0 ? (
                        <div className="text-center py-10 text-gray-400">Carregando...</div>
                    ) : (
                        groups.map((group) => (
                            <div key={group.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4 animate-fadeUp">
                                {/* Configuração do Grupo */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
                                    <div className="flex-1">
                                        <input 
                                            className="bg-transparent font-bold text-gray-800 text-lg w-full focus:outline-none focus:border-b focus:border-brand"
                                            value={group.name}
                                            onChange={(e) => handleUpdateGroup(group.id, { name: e.target.value })}
                                        />
                                        <div className="flex gap-4 mt-2 text-sm text-gray-600">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    checked={group.required}
                                                    onChange={(e) => handleUpdateGroup(group.id, { required: e.target.checked })}
                                                    className="rounded text-brand focus:ring-brand"
                                                />
                                                Obrigatório
                                            </label>
                                            <div className="flex items-center gap-2">
                                                <span>Escolher até:</span>
                                                <input 
                                                    type="number" 
                                                    className="w-12 p-1 text-center rounded border border-gray-300 text-sm"
                                                    value={group.max_select}
                                                    onChange={(e) => handleUpdateGroup(group.id, { max_select: parseInt(e.target.value) || 1 })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleDeleteGroup(group.id)}
                                        className="text-red-400 hover:text-red-600 text-sm px-2"
                                    >
                                        <FontAwesomeIcon icon={faTrash} />
                                    </button>
                                </div>

                                {/* Lista de Subitens */}
                                <div className="space-y-2">
                                    {group.subitems.map(sub => (
                                        <div key={sub.id} className="flex items-center gap-3 bg-white p-2 rounded border border-gray-100 shadow-sm">
                                            <FontAwesomeIcon icon={faGripLines} className="text-gray-300 text-xs cursor-move" />
                                            
                                            <input 
                                                className="flex-1 text-sm text-gray-700 focus:outline-none"
                                                value={sub.name}
                                                onChange={(e) => handleUpdateSubitem(sub.id, { name: e.target.value })}
                                            />

                                            <div className="flex items-center gap-1 relative w-24">
                                                <span className="text-xs text-gray-400 absolute left-2">R$</span>
                                                <input 
                                                    className="w-full pl-6 pr-1 py-1 text-sm text-right border rounded border-gray-200 focus:border-brand focus:outline-none"
                                                    value={(sub.price_cents / 100).toFixed(2)}
                                                    onChange={(e) => {
                                                        const val = Math.round(parseFloat(e.target.value) * 100);
                                                        if (!isNaN(val)) handleUpdateSubitem(sub.id, { price_cents: val });
                                                    }}
                                                    type="number" step="0.01"
                                                />
                                            </div>

                                            <button 
                                                onClick={() => handleDeleteSubitem(sub.id)}
                                                className="text-gray-300 hover:text-red-500 w-6"
                                            >
                                                <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    <button 
                                        onClick={() => handleAddSubitem(group.id)}
                                        className="w-full py-2 text-xs font-medium text-brand hover:bg-brand/5 rounded border border-dashed border-brand/20 transition-colors"
                                    >
                                        + Adicionar Opção
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    {/* Adicionar Novo Grupo */}
                    {isAddingGroup ? (
                        <div className="bg-white border border-brand rounded-xl p-4 animate-fadeUp">
                            <label className="text-sm font-medium text-gray-700 block mb-2">Nome do Grupo (ex: Borda, Tamanho)</label>
                            <div className="flex gap-2">
                                <Input 
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    placeholder="Digite o nome..."
                                    autoFocus
                                />
                                <Button onClick={handleAddGroup}>Criar</Button>
                                <Button variant="secondary" onClick={() => setIsAddingGroup(false)}>Cancelar</Button>
                            </div>
                        </div>
                    ) : (
                        <button 
                            onClick={() => setIsAddingGroup(true)}
                            className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-brand hover:text-brand transition-all flex flex-col items-center gap-2"
                        >
                            <FontAwesomeIcon icon={faPlus} />
                            <span>Criar Grupo de Complementos</span>
                        </button>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 flex justify-end shrink-0">
                    <Button onClick={onClose}>Concluir</Button>
                </div>
            </div>
        </Popup>
    );
}