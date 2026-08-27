"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { faTrash, faPlus, faGripLines, faGripVertical, faDownload, faSearch } from "@fortawesome/free-solid-svg-icons";
import ConfirmModal from "@/components/ui/ConfirmModal";

interface ItemDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    item: { id: string; name: string } | null; 
    restaurantId: string; // NOVA PROP NECESSÁRIA
    onOpenBulkComplements?: () => void;
}

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
    required: boolean; 
    position: number;
    subitems: Subitem[];
};

// NOVAS DEFINIÇÕES DE TIPO PARA A IMPORTAÇÃO AGRUPADA
type ImportableGroup = {
    id: string;
    name: string;
    original_data: any;
};

type ImportableItem = {
    id: string;
    name: string;
    groups: ImportableGroup[];
};

const formatPriceInput = (cents: number) => (Math.max(0, cents) / 100).toFixed(2).replace(".", ",");

const sanitizePriceInput = (value: string) => {
    const cleaned = value.replace(/[^\d,.]/g, "");
    const separatorIndex = Math.max(cleaned.lastIndexOf(","), cleaned.lastIndexOf("."));

    if (separatorIndex === -1) {
        return cleaned.replace(/\D/g, "").slice(0, 9);
    }

    const integerPart = cleaned.slice(0, separatorIndex).replace(/\D/g, "").slice(0, 9);
    const decimals = cleaned.slice(separatorIndex + 1).replace(/\D/g, "").slice(0, 2);
    return `${integerPart},${decimals}`;
};

const SubitemPriceInput = ({ priceCents, onChange }: { priceCents: number; onChange: (newCents: number) => void }) => {
    const [localValue, setLocalValue] = useState(formatPriceInput(priceCents));
    useEffect(() => { setLocalValue(formatPriceInput(priceCents)); }, [priceCents]);

    const handleBlur = () => {
        const floatVal = Number.parseFloat(localValue.replace(",", "."));
        const newCents = Number.isFinite(floatVal) && floatVal >= 0
            ? Math.round(floatVal * 100)
            : priceCents;
        onChange(newCents);
        setLocalValue(formatPriceInput(newCents));
    };

    return (
        <input 
            className="w-full pl-6 pr-1 py-1 text-sm 2xl:text-base text-right border rounded border-gray-200 focus:border-brand focus:outline-none"
            type="text"
            inputMode="decimal"
            value={localValue}
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setLocalValue(sanitizePriceInput(e.target.value))}
            onBlur={handleBlur}
            onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
            }}
        />
    );
};

export default function ItemDetailsModal({ isOpen, onClose, item, restaurantId, onOpenBulkComplements }: ItemDetailsModalProps) {

    // NOVO ESTADO: Controla qual item TEM PERMISSÃO para ser arrastado
    const [allowDragId, setAllowDragId] = useState<string | null>(null);

    // NOVO ESTADO: Controla qual GRUPO tem permissão para ser arrastado
    const [allowGroupDragId, setAllowGroupDragId] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [groups, setGroups] = useState<Subcategory[]>([]);
    
    // Estados de Criação
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [newGroupName, setNewGroupName] = useState("");

    // Estados de Importação
    const [isImporting, setIsImporting] = useState(false);
    const [importList, setImportList] = useState<ImportableItem[]>([]);
    const [importSearch, setImportSearch] = useState("");
    const [importLoading, setImportLoading] = useState(false);

    // Drag States
    const [draggedSubitem, setDraggedSubitem] = useState<{ groupId: string, subitemId: string } | null>(null);
    const [draggedGroup, setDraggedGroup] = useState<string | null>(null);

    // 2. ESTADO PARA CONTROLAR A EXCLUSÃO
    const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && item) {
            loadComplements();
            setIsAddingGroup(false);
            setIsImporting(false);
        } else {
            setGroups([]);
        }
    }, [isOpen, item]);

    const loadComplements = async () => {
        if (!item) return;
        setIsLoading(true);
        try {
            const { data: rawGroups, error: grpErr } = await supabase.from("item_subcategories").select("*").eq("item_id", item.id).order("position", { ascending: true });
            if (grpErr) throw grpErr;

            const groupRows = rawGroups || [];
            const groupIds = groupRows.map((group) => group.id);
            const { data: rawSubitems, error: subitemsError } = groupIds.length
                ? await supabase
                    .from("subitems")
                    .select("*")
                    .in("item_subcategory_id", groupIds)
                    .order("position", { ascending: true })
                : { data: [], error: null };

            if (subitemsError) throw subitemsError;

            const subitemsByGroup = new Map<string, Subitem[]>();
            for (const subitem of rawSubitems || []) {
                const current = subitemsByGroup.get(subitem.item_subcategory_id) || [];
                current.push(subitem);
                subitemsByGroup.set(subitem.item_subcategory_id, current);
            }

            const groupsWithItems = groupRows.map((group) => ({
                ...group,
                required: group.min_select > 0,
                subitems: subitemsByGroup.get(group.id) || [],
            }));
            setGroups(groupsWithItems);
        } catch (err) { console.error(err); } finally { setIsLoading(false); }
    };

    // --- IMPORT LOGIC ---
    const loadImportables = async () => {
        if (!restaurantId || !item) return;
        setImportLoading(true);
        try {
            // 1. Busca todos os itens do restaurante (exceto o atual)
            const { data: items } = await supabase.from("items").select("id, name").eq("restaurant_id", restaurantId).neq("id", item.id);
            if (!items?.length) { setImportList([]); return; }

            const itemIds = items.map(i => i.id);
            //const itemsMap = new Map(items.map(i => [i.id, i.name]));

            // 2. Busca grupos desses itens
            const { data: groups } = await supabase.from("item_subcategories").select("*").in("item_id", itemIds).order("position");

            // 3. Agrupa os dados: Item -> Grupos
            const groupedData: ImportableItem[] = items.map(currentItem => {
                const itemGroups = (groups || [])
                    .filter(g => g.item_id === currentItem.id)
                    .map(g => ({
                        id: g.id,
                        name: g.name,
                        original_data: g
                    }));
            
            return {
                    id: currentItem.id,
                    name: currentItem.name,
                    groups: itemGroups
                };
            }).filter(i => i.groups.length > 0); // Remove itens sem complementos

            setImportList(groupedData);
        } catch (err) { console.error(err); } finally { setImportLoading(false); }
    };

    // --- FUNÇÃO AUXILIAR DE IMPORTAÇÃO (REUTILIZÁVEL) ---
    // Retorna uma Promise para podermos usar no "Importar Todos"
    const importGroupInternal = async (groupToImport: ImportableGroup, currentGroupsLength: number) => {
        if (!item) return;

        // 1. Copia o Grupo
        const { data: newGroup, error: grpErr } = await supabase.from("item_subcategories").insert({
            item_id: item.id,
            name: groupToImport.name,
            min_select: groupToImport.original_data.min_select,
            max_select: groupToImport.original_data.max_select,
            position: currentGroupsLength // Usa a posição calculada dinamicamente
        }).select().single();
        
        if (grpErr || !newGroup) throw grpErr;

        // 2. Busca Subitems Originais
        const { data: originalSubs } = await supabase.from("subitems").select("*").eq("item_subcategory_id", groupToImport.id);

        // 3. Copia Subitems
        if (originalSubs && originalSubs.length > 0) {
            const subsToInsert = originalSubs.map(s => ({
                item_subcategory_id: newGroup.id,
                name: s.name,
                description: s.description,
                price_cents: s.price_cents,
                is_available: s.is_available,
                position: s.position
            }));
            await supabase.from("subitems").insert(subsToInsert);
        }
    };

    const handleImportSingle = async (groupToImport: ImportableGroup) => {
        setImportLoading(true);
        try {
            await importGroupInternal(groupToImport, groups.length);
            setIsImporting(false);
            loadComplements();
        } catch (err) {
            alert("Erro ao importar grupo.");
            console.error(err);
        } finally {
            setImportLoading(false);
        }
    };

    // Handler para importar TODOS os grupos de um item
    const handleImportAllFromItem = async (importableItem: ImportableItem) => {
        if (!confirm(`Deseja importar todos os ${importableItem.groups.length} grupos de "${importableItem.name}"?`)) return;
        
        setImportLoading(true);
        try {
            // Executa em sequência ou paralelo. 
            // Paralelo é mais rápido, mas precisamos calcular as posições corretamente.
            // Vamos fazer um loop simples para garantir a ordem das posições.
            
            let currentPos = groups.length;
            
            for (const group of importableItem.groups) {
                await importGroupInternal(group, currentPos);
                currentPos++;
            }

            setIsImporting(false);
            loadComplements();
        } catch (err) {
            alert("Erro ao importar alguns grupos.");
            console.error(err);
        } finally {
            setImportLoading(false);
        }
    };

    const handleImportSelection = async (groupToImport: ImportableGroup) => {
        if (!item) return;
        setImportLoading(true);
        try {
            // 1. Copia o Grupo
            const { data: newGroup, error: grpErr } = await supabase.from("item_subcategories").insert({
                item_id: item.id,
                name: groupToImport.name,
                min_select: groupToImport.original_data.min_select,
                max_select: groupToImport.original_data.max_select,
                position: groups.length
            }).select().single();
            
            if (grpErr || !newGroup) throw grpErr;

            // 2. Busca Subitems Originais
            const { data: originalSubs } = await supabase.from("subitems").select("*").eq("item_subcategory_id", groupToImport.id);

            // 3. Copia Subitems
            if (originalSubs && originalSubs.length > 0) {
                const subsToInsert = originalSubs.map(s => ({
                    item_subcategory_id: newGroup.id,
                    name: s.name,
                    description: s.description,
                    price_cents: s.price_cents,
                    is_available: s.is_available,
                    position: s.position
                }));
                await supabase.from("subitems").insert(subsToInsert);
            }

            setIsImporting(false);
            loadComplements();
        } catch (err) {
            alert("Erro ao importar grupo.");
            console.error(err);
        } finally {
            setImportLoading(false);
        }
    };

    // --- DRAG HANDLERS (Mantidos e Simplificados) ---
    const handleSubitemDragStart = (e: React.DragEvent, groupId: string, subitemId: string) => {
        e.stopPropagation(); 
        setDraggedSubitem({ groupId, subitemId });
        (e.target as HTMLElement).style.opacity = "0.5";
    };
    const handleSubitemDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).style.opacity = "1";

        const group = draggedSubitem
            ? groups.find((currentGroup) => currentGroup.id === draggedSubitem.groupId)
            : null;

        if (group) {
            const updates = group.subitems.map((subitem) =>
                supabase
                    .from("subitems")
                    .update({ position: subitem.position })
                    .eq("id", subitem.id)
            );
            void Promise.all(updates);
        }

        setDraggedSubitem(null);
    };
    const handleSubitemDragOver = (e: React.DragEvent, targetGroupId: string, targetSubitemId: string) => {
        e.preventDefault(); e.stopPropagation();
        if (!draggedSubitem || draggedSubitem.groupId !== targetGroupId || draggedSubitem.subitemId === targetSubitemId) return;
        const gIdx = groups.findIndex(g => g.id === targetGroupId);
        if (gIdx === -1) return;
        const subs = [...groups[gIdx].subitems];
        const from = subs.findIndex(s => s.id === draggedSubitem.subitemId);
        const to = subs.findIndex(s => s.id === targetSubitemId);
        if (from === -1 || to === -1) return;
        const [moved] = subs.splice(from, 1);
        subs.splice(to, 0, moved);
        const updated = subs.map((s, i) => ({ ...s, position: i }));
        const newGroups = [...groups];
        newGroups[gIdx].subitems = updated;
        setGroups(newGroups);
    };

    const handleGroupDragStart = (e: React.DragEvent, groupId: string) => {
        setDraggedGroup(groupId);
        setTimeout(() => (e.target as HTMLElement).style.opacity = "0.4", 0);
    };
    const handleGroupDragEnd = (e: React.DragEvent) => {
        (e.target as HTMLElement).style.opacity = "1";
        setDraggedGroup(null);
        const updates = groups.map((g, i) => supabase.from("item_subcategories").update({ position: i }).eq("id", g.id));
        Promise.all(updates);
    };
    const handleGroupDragOver = (e: React.DragEvent, targetGroupId: string) => {
        e.preventDefault();
        if (!draggedGroup || draggedGroup === targetGroupId) return;
        const current = [...groups];
        const from = current.findIndex(g => g.id === draggedGroup);
        const to = current.findIndex(g => g.id === targetGroupId);
        if (from === -1 || to === -1) return;
        const [moved] = current.splice(from, 1);
        current.splice(to, 0, moved);
        setGroups(current);
    };

    // --- CRUD ACTIONS ---
    const handleAddGroup = async () => {
        if (!newGroupName.trim() || !item) return;
        try {
            await supabase.from("item_subcategories").insert({ item_id: item.id, name: newGroupName, min_select: 0, max_select: 1, position: groups.length });
            setNewGroupName(""); setIsAddingGroup(false); loadComplements();
        } catch (err) { alert("Erro ao criar grupo."); }
    };

    // 3. HANDLER ATUALIZADO: APENAS ABRE O MODAL
    const handleDeleteGroupClick = (groupId: string) => {
        setGroupToDelete(groupId);
    }

    const confirmDeleteGroup = async () => {
        if (!groupToDelete) return;
        
        await supabase.from("item_subcategories").delete().eq("id", groupToDelete);
        setGroupToDelete(null); // Fecha o modal
        loadComplements();      // Recarrega
    };


    const updateGroupLocally = (groupId: string, updates: Partial<Subcategory>) => {
        setGroups(prev => prev.map(g => g.id === groupId ? { ...g, ...updates } : g));
    };

    const handleUpdateGroup = async (groupId: string, updates: Partial<Subcategory>) => {
        updateGroupLocally(groupId, updates);
        let dbUpdates: any = { ...updates };
        if (updates.required !== undefined) {
            dbUpdates.min_select = updates.required ? 1 : 0;
            delete dbUpdates.required;
        }
        delete dbUpdates.subitems;
        await supabase.from("item_subcategories").update(dbUpdates).eq("id", groupId);
    };
    const handleAddSubitem = async (groupId: string) => {
        // 1. Encontramos o grupo atual para ver os itens existentes
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        // 2. Calculamos a próxima posição segura
        // Se houver itens, pega o maior 'position' e soma 1. Se não, começa do 0.
        // Math.max garante que mesmo se houver gaps (0, 1, 5), o próximo será 6.
        const nextPosition = group.subitems.length > 0 
            ? Math.max(...group.subitems.map(s => s.position)) + 1 
            : 0;
        await supabase.from("subitems").insert({ item_subcategory_id: groupId, name: "Nova Opção", price_cents: 0, is_available: true, position: nextPosition });
        loadComplements();
    };
    const updateSubitemLocally = (subitemId: string, updates: Partial<Subitem>) => {
        setGroups(prev => prev.map(g => ({ ...g, subitems: g.subitems.map(s => s.id === subitemId ? { ...s, ...updates } : s) })));
    };

    const handleUpdateSubitem = async (subitemId: string, updates: Partial<Subitem>) => {
        updateSubitemLocally(subitemId, updates);
        await supabase.from("subitems").update(updates).eq("id", subitemId);
    };
    const handleDeleteSubitem = async (subitemId: string) => {
        await supabase.from("subitems").delete().eq("id", subitemId);
        loadComplements();
    };

    // --- LÓGICA DE FILTRO ATUALIZADA ---
    const filteredImports = importList.map(item => {
        const searchLower = importSearch.toLowerCase();
        
        // Verifica se o Item dá match
        const itemMatch = item.name.toLowerCase().includes(searchLower);
        
        // Verifica quais grupos dão match
        const matchingGroups = item.groups.filter(g => g.name.toLowerCase().includes(searchLower));

        // Se o Item der match, mostra ele e TODOS os grupos.
        // Se só grupos derem match, mostra o item e SÓ os grupos que deram match.
        if (itemMatch) return item;
        if (matchingGroups.length > 0) return { ...item, groups: matchingGroups };
        
        return null;
    }).filter(Boolean) as ImportableItem[];

    return (
        <>
        <Modal open={isOpen} onClose={onClose}>
            <div className="w-full max-w-2xl bg-white rounded-lg flex flex-col max-h-[85vh]">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl 2xl:text-2xl font-bold text-gray-900">Complementos</h2>
                        <p className="text-gray-500 text-sm 2xl:text-base 2xl:mt-1">Item: <span className="font-medium text-brand">{item?.name}</span></p>
                        {onOpenBulkComplements && (
                            <button
                                type="button"
                                onClick={onOpenBulkComplements}
                                className="mt-1 cursor-pointer text-sm font-medium text-brand underline 2xl:text-base"
                            >
                                Modificar complementos em massa (e desativar/ativar)
                            </button>
                        )}
                    </div>
                    <button onClick={onClose} className="cursor-pointer text-gray-400 hover:text-gray-600">
                        <FontAwesomeIcon icon={icons.faTimes} className="text-xl" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6 2xl:text-base">
                    {/* LISTA DE GRUPOS ATUAIS */}
                    {groups.map((group) => (
                        <div 
                            key={group.id} 
                            className="bg-gray-50 rounded-xl border border-gray-200 p-4 transition-all"
                            draggable={allowGroupDragId === group.id}
                            onDragStart={(e) => handleGroupDragStart(e, group.id)}
                            onDragOver={(e) => handleGroupDragOver(e, group.id)}
                            onDragEnd={handleGroupDragEnd}
                        >
                            {/* Header do Grupo */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
                                <div className="flex-1 flex items-center gap-3">
                                    <div className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-1"
                                        onMouseEnter={() => setAllowGroupDragId(group.id)}
                                        onMouseLeave={() => setAllowGroupDragId(null)}
                                        onTouchStart={() => setAllowGroupDragId(group.id)}>
                                        <FontAwesomeIcon icon={faGripVertical} className="text-sm" />
                                    </div>
                                    <div className="flex-1">
                                        <input 
                                            className="bg-transparent font-bold text-gray-800 text-lg 2xl:text-xl w-full focus:outline-none focus:border-b focus:border-brand"
                                            value={group.name}
                                            onChange={(e) => updateGroupLocally(group.id, { name: e.target.value })}
                                            onBlur={(e) => handleUpdateGroup(group.id, { name: e.currentTarget.value })}
                                            onMouseDown={e => e.stopPropagation()} 
                                        />
                                        <div className="flex gap-4 mt-2 text-sm 2xl:text-base text-gray-600">
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input 
                                                    type="checkbox" 
                                                    checked={group.required}
                                                    onChange={(e) => handleUpdateGroup(group.id, { required: e.target.checked })}
                                                    className="rounded text-brand focus:ring-brand"
                                                />
                                                Obrigatório
                                            </label>
                                            <div className="flex items-center gap-2 2xl:text-base">
                                                <span>Até:</span>
                                                <input 
                                                    type="number" 
                                                    className="w-12 p-1 text-center rounded border border-gray-300 text-sm 2xl:text-base"
                                                    value={group.max_select}
                                                    onChange={(e) => updateGroupLocally(group.id, { max_select: parseInt(e.target.value) || 1 })}
                                                    onBlur={(e) => handleUpdateGroup(group.id, { max_select: parseInt(e.currentTarget.value) || 1 })}
                                                    onMouseDown={e => e.stopPropagation()}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => handleDeleteGroupClick(group.id)} className="cursor-pointer text-gray-400 hover:text-red-600 px-2">
                                    <FontAwesomeIcon icon={faTrash} />
                                </button>
                            </div>

                            {/* Subitens */}
                            <div className="space-y-2">
                                {group.subitems.map(sub => (
                                    <div 
                                        key={sub.id} 
                                        className={`flex items-center gap-3 bg-white p-2 rounded border border-gray-100 shadow-sm ${draggedSubitem?.subitemId === sub.id ? 'opacity-50' : ''}`}
                                        draggable={allowDragId === sub.id}
                                        onDragStart={(e) => handleSubitemDragStart(e, group.id, sub.id)}
                                        onDragEnd={handleSubitemDragEnd}
                                        onDragOver={(e) => handleSubitemDragOver(e, group.id, sub.id)}
                                    >
                                        <div className="cursor-grab text-gray-300 p-1 2xl:p-2" onMouseEnter={() => setAllowDragId(sub.id)}
                                        onMouseLeave={() => setAllowDragId(null)}
                                        // Suporte mobile simples (opcional, mas recomendado)
                                        onTouchStart={() => setAllowDragId(sub.id)}><FontAwesomeIcon icon={faGripVertical} className="text-xs 2xl:text-base" /></div>
                                        <input 
                                            className="flex-1 text-sm 2xl:text-base text-gray-700 focus:outline-none bg-transparent"
                                            value={sub.name}
                                            onChange={(e) => updateSubitemLocally(sub.id, { name: e.target.value })}
                                            onBlur={(e) => handleUpdateSubitem(sub.id, { name: e.currentTarget.value })}
                                            onMouseDown={e => e.stopPropagation()}
                                        />
                                        <div className="flex items-center gap-1 relative">
                                            <span className="text-xs text-gray-400 2xl:text-base">R$</span>
                                            <SubitemPriceInput 
                                                priceCents={sub.price_cents}
                                                onChange={(newCents) => handleUpdateSubitem(sub.id, { price_cents: newCents })}
                                            />
                                        </div>
                                        <button onClick={() => handleDeleteSubitem(sub.id)} className="cursor-pointer text-gray-400 hover:text-red-500 w-6">
                                            <FontAwesomeIcon icon={faTrash} className="text-xs 2xl:text-lg" />
                                        </button>
                                    </div>
                                ))}
                                <button onClick={() => handleAddSubitem(group.id)} className="cursor-pointer w-full py-2 text-xs font-medium text-brand hover:bg-brand/5 rounded border border-dashed border-brand/20 transition-colors">
                                    + Adicionar Opção
                                </button>
                            </div>
                        </div>
                    ))}

                    {/* MODO IMPORTAÇÃO */}
                    {isImporting ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-4 animate-fadeUp">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-800">Importar Complementos</h3>
                                <button onClick={() => setIsImporting(false)} className="cursor-pointer text-sm text-gray-500 hover:underline">Cancelar</button>
                            </div>
                            
                            <div className="relative mb-4">
                                <Input 
                                    placeholder="Buscar Item ou Categoria..." 
                                    value={importSearch}
                                    onChange={(e) => setImportSearch(e.target.value)}
                                    icon={<FontAwesomeIcon icon={faSearch} />}
                                />
                            </div>

                            <div className="max-h-60 overflow-y-auto space-y-4 pr-1">
                                {importLoading ? <div className="text-center py-4 text-gray-400">Carregando...</div> : 
                                filteredImports.length === 0 ? <div className="text-center py-4 text-gray-400">Nenhum item encontrado.</div> :
                                filteredImports.map(importItem => (
                                    <div key={importItem.id} className="border border-gray-200 rounded-lg overflow-hidden">
                                        
                                        {/* HEADER DO ITEM (PAI) */}
                                        <div className="bg-gray-50 p-3 flex justify-between items-center border-b border-gray-100">
                                            <div className="font-bold text-gray-800 flex items-center gap-2">
                                                <span className="text-brand">●</span> 
                                                {importItem.name}
                                            </div>
                                            <button 
                                                onClick={() => handleImportAllFromItem(importItem)}
                                                className="cursor-pointer text-xs bg-white border border-brand text-brand hover:bg-brand hover:text-white px-3 py-1 rounded-full transition-colors font-medium shadow-sm"
                                            >
                                                Adicionar Todos ({importItem.groups.length})
                                            </button>
                                        </div>

                                        {/* LISTA DE GRUPOS (FILHOS) */}
                                        <div className="divide-y divide-gray-100">
                                            {importItem.groups.map(grp => (
                                                <div 
                                                    key={grp.id} 
                                                    className="p-3 pl-6 hover:bg-gray-50 flex justify-between items-center group cursor-pointer"
                                                    onClick={() => handleImportSingle(grp)}
                                                >
                                                    <span className="text-gray-600 font-medium group-hover:text-gray-900">{grp.name}</span>
                                                    <div className="w-6 h-6 rounded-full bg-gray-100 group-hover:bg-green-500 group-hover:text-white flex items-center justify-center text-gray-300 transition-colors">
                                                        <FontAwesomeIcon icon={faPlus} className="text-xs" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : isAddingGroup ? (
                        /* MODO CRIAR NOVO */
                        <div className="bg-white border border-brand rounded-xl p-4 animate-fadeUp">
                            <label className="text-sm font-medium text-gray-700 block mb-2">Nome do Grupo</label>
                            <div className="flex gap-2">
                                <div className="flex-1">
                                    <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Ex: Tamanho" autoFocus className="w-full" />
                                </div>
                                <button onClick={handleAddGroup} className="cursor-pointer bg-brand text-white px-4 rounded-md font-medium text-sm shrink-0 ">Criar</button>
                                <button onClick={() => setIsAddingGroup(false)} className="cursor-pointer text-gray-500 px-4 text-sm hover:underline shrink-0 ">Cancelar</button>

                            </div>
                        </div>
                    ) : (
                        /* BOTÕES DE AÇÃO PRINCIPAIS */
                        <div className="flex gap-3">
                            <button onClick={() => setIsAddingGroup(true)} className="cursor-pointer flex-1 py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-brand hover:text-brand transition-all flex flex-col items-center gap-2">
                                <FontAwesomeIcon icon={faPlus} />
                                <span>Criar Novo Grupo</span>
                            </button>
                            <button 
                                onClick={() => { setIsImporting(true); loadImportables(); }} 
                                className="cursor-pointer flex-1 py-4 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-medium hover:border-blue-500 hover:text-blue-500 transition-all flex flex-col items-center gap-2"
                            >
                                <FontAwesomeIcon icon={faDownload} />
                                <span>Importar de Outro Item</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-100 flex justify-end shrink-0">
                    <button onClick={onClose} className="cursor-pointer bg-brand text-white px-6 py-2 rounded-md font-medium hover:bg-orange-600 transition-colors">Concluir</button>
                </div>
            </div>
        </Modal>
        {/* 6. RENDERIZAR O CONFIRM MODAL (FORA DO MODAL PRINCIPAL PARA EVITAR Z-INDEX ISSUES) */}
        <ConfirmModal 
            open={!!groupToDelete}
            onClose={() => setGroupToDelete(null)}
            onConfirm={confirmDeleteGroup}
            title="Apagar Grupo"
            description="Tem certeza que deseja apagar este grupo? Todas as opções dentro dele serão removidas."
            confirmLabel="Apagar"
            variant="danger"
        />
        </>
    );
}