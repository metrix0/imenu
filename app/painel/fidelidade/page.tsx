"use client";

import { PageSaveHeader } from "@/components/ui/SaveStatus";
import { useEffect, useState } from "react";
import { useLoyaltyStore } from "@/lib/stores/restaurant-owner/loyaltyStore";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import SaveStatus from "@/components/ui/SaveStatus";
import Loader from "@/components/ui/Loader";
import Card from "@/components/ui/Card";
import Dropdown from "@/components/ui/Dropdown";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faStar, faGift, faMoneyBillWave, faCheckSquare, faSquare, faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { supabase } from "@/lib/database/supabaseClient";
import { formatPrice } from "@/lib/utils/formatPrice";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import type { LoyaltyProgram } from "@/lib/types/types";

// Tipos auxiliares para a UI
type MenuItemOption = {
    id: string;
    name: string;
};

type ItemDetails = {
    groups: {
        id: string;
        name: string;
        subitems: {
            id: string;
            name: string;
            price_cents: number;
        }[];
    }[];
};

export default function FidelidadePage() {
    const restaurantId = useCreationStore((state) => state.restaurantId);
    
    const { 
        program, 
        fetchProgram, 
        saveProgram, 
        updateField,
        setProgram 
    } = useLoyaltyStore();

    const { status: saveStatus, error: saveError, schedule: scheduleSave, reset: resetSave } = useAutoSave<LoyaltyProgram>(restaurantId, async (snapshot) => {
        if (snapshot.active && !snapshot.reward_item_id)
            throw new Error("Selecione o item da recompensa para salvar a ativação do programa.");
        if (!Number.isInteger(snapshot.goal_count) || snapshot.goal_count < 1 || snapshot.goal_count > 100)
            throw new Error("Informe uma meta entre 1 e 100 pedidos.");
        if (!(await saveProgram(snapshot))) throw new Error("Não foi possível salvar o programa de fidelidade.");
    });
    
    // Estados UI
    const [minOrderDisplay, setMinOrderDisplay] = useState("");
    const [isInitialized, setIsInitialized] = useState(false);
    const [loadingProgram, setLoadingProgram] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);

    // Detalhes do item selecionado (para escolher subitens)
    const [selectedItemDetails, setSelectedItemDetails] = useState<ItemDetails | null>(null);
    const [loadingDetails, setLoadingDetails] = useState(false);

    useEffect(() => {
        let active = true;
        setLoadingProgram(true);
        setLoadError(false);
        setIsInitialized(false);
        setMinOrderDisplay("");
        if (restaurantId) {
            void fetchProgram(restaurantId).then((loaded) => {
                if (!active) return;
                setLoadingProgram(false);
                setLoadError(!loaded);
                resetSave(loaded ? "saved" : "error");
            });
            fetchMenuItems(restaurantId);
        }
        return () => { active = false; };
    }, [restaurantId, fetchProgram, resetSave]);

    // Carregar detalhes quando o item da recompensa mudar (ou ao carregar a página)
    useEffect(() => {
        if (program?.reward_item_id) {
            fetchItemDetails(program.reward_item_id);
        } else {
            setSelectedItemDetails(null);
        }
    }, [program?.reward_item_id]);

    const fetchMenuItems = async (id: string) => {
        setItemsLoading(true);
        const { data } = await supabase
            .from("items")
            .select("id, name")
            .eq("restaurant_id", id)
            .eq("is_available", true);
        
        if (data) setMenuItems(data);
        setItemsLoading(false);
    };

    // Busca grupos e subitens do item selecionado
    const fetchItemDetails = async (itemId: string) => {
        setLoadingDetails(true);
        // Busca Grupos
        const { data: groups } = await supabase
            .from("item_subcategories")
            .select("id, name, position")
            .eq("item_id", itemId)
            .order("position");

        if (groups && groups.length > 0) {
            // Busca Subitens desses grupos
            const groupIds = groups.map(g => g.id);
            const { data: subitems } = await supabase
                .from("subitems")
                .select("id, name, price_cents, item_subcategory_id")
                .in("item_subcategory_id", groupIds)
                .order("position");

            // Monta estrutura hierárquica
            const structured = groups.map(g => ({
                ...g,
                subitems: subitems?.filter(s => s.item_subcategory_id === g.id) || []
            }));
            
            setSelectedItemDetails({ groups: structured });
        } else {
            setSelectedItemDetails({ groups: [] });
        }
        setLoadingDetails(false);
    };

    // Sincronização inicial de valor monetário
    useEffect(() => {
        if (program && program.restaurant_id === restaurantId && !loadingProgram && !isInitialized) {
            const cents = program.min_order_value_cents || 0;
            const formatted = cents > 0 ? (cents / 100).toFixed(2).replace('.', ',') : "";
            setMinOrderDisplay(formatted);
            setIsInitialized(true);
        }
    }, [program, restaurantId, loadingProgram, isInitialized]);

    const handleChange = (field: any, value: any) => {
        if (!program) {
            setProgram({
                id: "", 
                restaurant_id: restaurantId || "",
                goal_count: 10,
                reward_description: "",
                active: false,
                min_order_value_cents: 0,
                reward_item_id: null,
                reward_subitem_ids: [],
                [field]: value 
            });
        } else {
            updateField(field, value);
        }
        const next = useLoyaltyStore.getState().program;
        if (next) scheduleSave(next);
    };

    const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        val = val.replace(/[^0-9,]/g, "");
        if ((val.match(/,/g) || []).length > 1) return;
        setMinOrderDisplay(val);
        const floatVal = parseFloat(val.replace(',', '.'));
        const cents = isNaN(floatVal) ? 0 : Math.round(floatVal * 100);
        handleChange("min_order_value_cents", cents);
    };

    // Ao selecionar item, limpa os subitens antigos
    const handleItemSelect = (itemId: string) => {
        handleChange("reward_item_id", itemId);
        handleChange("reward_subitem_ids", []); // Reseta seleção de complementos
        
        const newItem = menuItems.find(i => i.id === itemId);
        if (newItem) {
            handleChange("reward_description", `${newItem.name} + Complementos`);
        }
    };

    // Toggle de Subitem na lista de "Inclusos"
    const toggleSubitem = (subitemId: string) => {
        const currentIds = program?.reward_subitem_ids || [];
        let newIds;
        if (currentIds.includes(subitemId)) {
            newIds = currentIds.filter(id => id !== subitemId);
        } else {
            newIds = [...currentIds, subitemId];
        }
        handleChange("reward_subitem_ids", newIds);
    };

    if (loadingProgram) return (
        <div role="status" aria-label="Carregando programa de fidelidade" className="flex justify-center p-10">
            <Loader className="border-t-brand" />
        </div>
    );
    if (loadError) return <p role="alert" className="p-10 text-center text-red-600">Não foi possível carregar o programa de fidelidade.</p>;

    const safeProgram = program || { 
        active: false, 
        goal_count: 10, 
        reward_description: "", 
        min_order_value_cents: 0,
        reward_item_id: null,
        reward_subitem_ids: []
    };

    const dropdownOptions = menuItems.map(item => ({ value: item.id, label: item.name }));

    return (
        <div className="max-w-6xl mx-auto pb-20 px-4 sm:px-6 pt-8">
            <PageSaveHeader>
<div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Programa de Fidelidade</h1>
                    <p className="text-gray-500 mt-1 2xl:text-lg">Defina o item que será dado como recompensa e quais complementos já vêm inclusos.</p>
                </div>
                <SaveStatus status={saveStatus} className="self-start sm:self-auto" />
            </div>
</PageSaveHeader>
            {saveError ? <p role="alert" className="mb-4 text-sm text-red-600">{saveError}</p> : null}

            <Card className="space-y-6 p-6">
                <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                    <div>
                        <h3 className="font-semibold text-lg">Status do Programa</h3>
                        <p className="text-sm text-gray-500">Se desativado, a pontuação é pausada.</p>
                    </div>
                    <Switch
                        aria-label="Ativar programa de fidelidade"
                        checked={safeProgram.active} 
                        onClick={() => handleChange("active", !safeProgram.active)}
                    />
                </div>

                <fieldset disabled={!safeProgram.active} className="min-w-0 space-y-6 disabled:opacity-50">
                    {/* REGRAS */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Input
                            label="Meta de Pedidos (Selos)"
                            type="number"
                            min={1}
                            max={100}
                            placeholder="Ex: 10"
                            value={safeProgram.goal_count}
                            onChange={(e) => handleChange("goal_count", Number(e.target.value))}
                            icon={<FontAwesomeIcon icon={faStar} className="text-gray-400"/>}
                        />
                        <div>
                             <Input
                                label="Valor Mínimo do Pedido (R$)"
                                placeholder="0,00"
                                value={minOrderDisplay} 
                                onChange={handleMoneyChange}
                                icon={<FontAwesomeIcon icon={faMoneyBillWave} className="text-gray-400"/>}
                                iconPosition="left"
                            />
                            <p className="text-xs text-gray-400 mt-1 ml-1">Deixe 0 para pontuar qualquer valor.</p>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* SELEÇÃO DO COMBO */}
                    <div className="space-y-4">
                        <h3 className="font-medium text-gray-900">Definir Combo de Recompensa</h3>
                        
                        <div className="w-full">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Item Principal (Gratuito)</label>
                            {itemsLoading ? (
                                <div role="status" aria-label="Carregando itens" className="flex justify-center p-4">
                                    <Loader className="border-t-brand" />
                                </div>
                            ) : (
                                <Dropdown 
                                    aria-label="Item principal gratuito"
                                    disabled={!safeProgram.active}
                                    options={dropdownOptions}
                                    onChange={(e) => handleItemSelect(e.target.value)}
                                    value={safeProgram.reward_item_id || ""}
                                    className="w-full"
                                />
                            )}
                        </div>

                        {/* LISTA DE COMPLEMENTOS INCLUSOS */}
                        {safeProgram.reward_item_id && (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <h4 className="font-medium text-sm text-gray-700 mb-3">
                                    Selecione os complementos que virão <span className="text-green-600 font-bold">GRÁTIS</span> neste combo:
                                </h4>
                                
                                {loadingDetails ? (
                                    <div role="status" aria-label="Carregando complementos" className="flex justify-center p-4">
                                        <Loader className="border-t-brand" />
                                    </div>
                                ) : selectedItemDetails?.groups.length === 0 ? (
                                    <p className="text-sm text-gray-400 italic">Este item não possui complementos.</p>
                                ) : (
                                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                        {selectedItemDetails?.groups.map(group => (
                                            <div key={group.id}>
                                                <p className="text-xs font-bold text-gray-500 uppercase mb-2">{group.name}</p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {group.subitems.map(sub => {
                                                        const isSelected = safeProgram.reward_subitem_ids?.includes(sub.id);
                                                        return (
                                                            <button
                                                                type="button"
                                                                aria-pressed={!!isSelected}
                                                                key={sub.id}
                                                                onClick={() => toggleSubitem(sub.id)}
                                                                className={`cursor-pointer flex items-center p-2 rounded border transition-all ${
                                                                    isSelected 
                                                                        ? "bg-green-50 border-green-200 text-green-800" 
                                                                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                                                                }`}
                                                            >
                                                                <FontAwesomeIcon 
                                                                    icon={isSelected ? faCheckSquare : faSquare} 
                                                                    className={`mr-2 ${isSelected ? "text-green-600" : "text-gray-300"}`}
                                                                />
                                                                <span className="text-sm flex-1">{sub.name}</span>
                                                                <span className="text-xs text-gray-400">
                                                                    {sub.price_cents > 0 ? `+${formatPrice(sub.price_cents)}` : 'Grátis'}
                                                                </span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-200">
                                    * Qualquer outro complemento que o cliente escolher além destes será cobrado o valor normal.
                                </p>
                            </div>
                        )}

                        <div className="pt-2">
                            <Input
                                label="Nome de Exibição (Ex: Açaí Completo Grátis)"
                                value={safeProgram.reward_description || ""}
                                onChange={(e) => handleChange("reward_description", e.target.value)}
                                icon={<FontAwesomeIcon icon={faGift} className="text-gray-400"/>}
                            />
                        </div>
                    </div>
                </fieldset>

            </Card>
        </div>
    );
}
