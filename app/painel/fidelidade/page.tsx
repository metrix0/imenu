"use client";

import { PageSaveHeader } from "@/components/ui/SaveStatus";
import { useEffect, useState } from "react";
import { useLoyaltyStore } from "@/lib/stores/restaurant-owner/loyaltyStore";
import Input from "@/components/ui/Input";
import SaveStatus from "@/components/ui/SaveStatus";
import Loader from "@/components/ui/Loader";
import Card from "@/components/ui/Card";
import Dropdown from "@/components/ui/Dropdown";
import ToggleOptionCard from "@/components/ui/ToggleOptionCard";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faStar, faGift, faMoneyBillWave } from "@fortawesome/free-solid-svg-icons";
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

    const dropdownOptions = [
        { value: "", label: menuItems.length ? "Selecione um item" : "Nenhum item disponível", disabled: true },
        ...menuItems.map(item => ({ value: item.id, label: item.name })),
    ];

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 pb-20 pt-8 sm:px-6">
            <PageSaveHeader>
                <h1 className="text-3xl font-bold text-gray-900">Programa de Fidelidade</h1>
                <p className="mt-1 text-gray-500 2xl:text-lg">Defina como seus clientes ganham selos e qual recompensa podem resgatar.</p>
                <SaveStatus status={saveStatus} />
            </PageSaveHeader>

            {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}

            <ToggleOptionCard
                label="Status do programa"
                variant="section"
                className="flex-nowrap!"
                ariaLabel="Ativar programa de fidelidade"
                checked={safeProgram.active}
                onChange={(active) => handleChange("active", active)}
                description={safeProgram.active
                    ? "Pedidos elegíveis geram selos."
                    : "A contagem de selos está pausada."}
            />

            <fieldset disabled={!safeProgram.active} className="grid min-w-0 items-start gap-4 disabled:opacity-75 lg:grid-cols-3">
                <Card className="min-w-0 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Regras de pontuação</h2>
                        <p className="mt-1 text-sm text-gray-500">Defina quais pedidos valem um selo e quantos selos liberam a recompensa.</p>
                    </div>
                    <Input
                        label="Meta de selos"
                        type="number"
                        min={1}
                        max={100}
                        value={safeProgram.goal_count}
                        onChange={(e) => handleChange("goal_count", Number(e.target.value))}
                        icon={<FontAwesomeIcon icon={faStar} className="text-gray-400" />}
                    />
                    <div>
                        <Input
                            label="Valor mínimo do pedido (R$)"
                            placeholder="0,00"
                            value={minOrderDisplay}
                            onChange={handleMoneyChange}
                            aria-describedby="loyalty-minimum-help"
                            icon={<FontAwesomeIcon icon={faMoneyBillWave} className="text-gray-400" />}
                        />
                        <p id="loyalty-minimum-help" className="mt-1 text-xs text-gray-500">
                            Com valor mínimo de R$ 0, qualquer pedido pontua.
                        </p>
                    </div>
                </Card>

                <Card className="min-w-0 space-y-4 lg:col-span-2">
                    <h2 className="text-lg font-semibold text-gray-900">Recompensa</h2>
                    {itemsLoading ? (
                        <div role="status" aria-label="Carregando itens" className="flex justify-center p-4">
                            <Loader className="border-t-brand" />
                        </div>
                    ) : (
                        <Dropdown
                            label="Item principal gratuito"
                            disabled={!safeProgram.active}
                            options={dropdownOptions}
                            onChange={(e) => handleItemSelect(e.target.value)}
                            value={safeProgram.reward_item_id || ""}
                            className="w-full"
                        />
                    )}
                    <Input
                        label="Nome de exibição da recompensa"
                        placeholder="Ex.: Açaí completo grátis"
                        value={safeProgram.reward_description || ""}
                        onChange={(e) => handleChange("reward_description", e.target.value)}
                        icon={<FontAwesomeIcon icon={faGift} className="text-gray-400" />}
                    />

                    {safeProgram.reward_item_id && (
                        <div className="space-y-3 border-t border-gray-200 pt-4">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900">Complementos inclusos</h3>
                                <p className="mt-1 text-sm text-gray-500">
                                    Selecione os complementos gratuitos. Os demais serão cobrados pelo valor normal.
                                </p>
                            </div>
                            {loadingDetails ? (
                                <div role="status" aria-label="Carregando complementos" className="flex justify-center p-4">
                                    <Loader className="border-t-brand" />
                                </div>
                            ) : selectedItemDetails?.groups.length === 0 ? (
                                <p className="text-sm text-gray-500">Este item não possui complementos.</p>
                            ) : (
                                <div className="space-y-3">
                                    {selectedItemDetails?.groups.map(group => (
                                        <fieldset key={group.id} className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                            <legend className="px-1 text-sm font-medium text-gray-700">{group.name}</legend>
                                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                                {group.subitems.map(sub => (
                                                    <label
                                                        key={sub.id}
                                                        className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50 has-checked:border-brand has-checked:bg-[#fff1ea] has-disabled:cursor-not-allowed"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={safeProgram.reward_subitem_ids?.includes(sub.id) ?? false}
                                                            onChange={() => toggleSubitem(sub.id)}
                                                            className="size-5 shrink-0 cursor-pointer accent-brand disabled:cursor-not-allowed"
                                                        />
                                                        <span className="min-w-0 flex-1 wrap-break-word">{sub.name}</span>
                                                        <span className="shrink-0 text-xs text-gray-600">
                                                            {sub.price_cents > 0 ? `+${formatPrice(sub.price_cents)}` : "Grátis"}
                                                        </span>
                                                    </label>
                                                ))}
                                            </div>
                                        </fieldset>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </fieldset>
        </div>
    );
}
