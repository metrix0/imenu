"use client";

import { PageSaveHeader } from "@/components/ui/SaveStatus";
import { useEffect, useState } from "react";
import { useLoyaltyStore } from "@/lib/stores/restaurant-owner/loyaltyStore";
import DataTable from "@/components/ui/DataTable";
import PanelFeatureCallout from "@/components/ui/PanelFeatureCallout";
import Pagination from "@/components/ui/Pagination";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import { crmRequest } from "@/lib/api/crm";
import { formatPhone } from "@/lib/dev/dashboardFormat";
import Input from "@/components/ui/Input";
import Toast from "@/components/ui/Toast";
import SaveStatus from "@/components/ui/SaveStatus";
import Loader, { PageLoader } from "@/components/ui/Loader";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import Dropdown from "@/components/ui/Dropdown";
import ToggleOptionCard from "@/components/ui/ToggleOptionCard";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faStar, faMoneyBillWave, faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { supabase } from "@/lib/database/supabaseClient";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import type { LoyaltyProgram, LoyaltyRewardSelection } from "@/lib/types/types";

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
        }[];
    }[];
};

type LoyaltyCustomer = {
    id: string;
    customer_phone: string;
    name: string | null;
    current_count: number;
    last_order_at: string | null;
};

const CUSTOMERS_PAGE_SIZE = 10;

function LoyaltyCustomers({ restaurantId, goal }: { restaurantId: string; goal: number }) {
    const [rows, setRows] = useState<LoyaltyCustomer[]>([]);
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");
        void crmRequest(`/api/loyalty/customers?page=${page + 1}`, restaurantId, { signal: controller.signal })
            .then(data => {
                if (controller.signal.aborted) return;
                setRows(data.customers);
                setTotal(data.total);
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setRows([]);
                    setTotal(0);
                    setError("Não foi possível carregar os clientes do programa.");
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false);
            });
        return () => controller.abort();
    }, [restaurantId, page]);

    return (
        <section className="space-y-3">
            {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : (
                <>
                    <DataTable
                        rows={rows}
                        rowKey={row => row.id}
                        loading={loading}
                        emptyMessage="Os clientes aparecerão aqui quando acumularem selos."
                        columns={[
                            {
                                key: "customer", label: "Cliente",
                                render: row => (
                                    <div className="flex items-center gap-3">
                                        <InitialsAvatar name={row.name} colorKey={row.customer_phone} />
                                        <div className="min-w-0">
                                            <p className="font-medium text-gray-900">{row.name || "Sem nome"}</p>
                                            <p className="mt-1 whitespace-nowrap text-gray-500">{formatPhone(row.customer_phone)}</p>
                                        </div>
                                    </div>
                                ),
                            },
                            {
                                key: "current", label: "Selos", className: "whitespace-nowrap",
                                render: row => <span className="font-medium text-gray-900">{row.current_count}{goal > 0 ? ` / ${goal}` : ""}</span>,
                            },
                            {
                                key: "last", label: "Último pedido", className: "whitespace-nowrap",
                                render: row => row.last_order_at ? new Date(row.last_order_at).toLocaleDateString("pt-BR") : "—",
                            },
                        ]}
                    />
                    {(total > 0 || page > 0) && (
                        <Pagination page={page} pageCount={Math.ceil(total / CUSTOMERS_PAGE_SIZE)} onChange={setPage} disabled={loading} />
                    )}
                </>
            )}
        </section>
    );
}

export default function FidelidadePage() {
    const restaurantId = useCreationStore((state) => state.restaurantId);
    
    const { 
        program, 
        fetchProgram, 
        saveProgram, 
        setProgram 
    } = useLoyaltyStore();

    const { status: saveStatus, error: saveError, schedule: scheduleSave, reset: resetSave } = useAutoSave<LoyaltyProgram>(restaurantId, async (snapshot) => {
        if (!Number.isInteger(snapshot.goal_count) || snapshot.goal_count < 0 || snapshot.goal_count > 100)
            throw new Error("Informe uma meta entre 0 e 100 pedidos.");
        if (!(await saveProgram(snapshot))) throw new Error("Não foi possível salvar o programa de fidelidade.");
    });
    
    // Estados UI
    const [minOrderDisplay, setMinOrderDisplay] = useState("");
    const [isInitialized, setIsInitialized] = useState(false);
    const [loadingProgram, setLoadingProgram] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [menuItems, setMenuItems] = useState<MenuItemOption[]>([]);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [addingReward, setAddingReward] = useState(false);

    const [itemDetails, setItemDetails] = useState<Record<string, ItemDetails>>({});
    const itemIds = [program?.reward_item_id, ...(program?.additional_rewards ?? []).map(reward => reward.item_id)]
        .filter(Boolean).join(",");

    useEffect(() => {
        let active = true;
        setLoadingProgram(true);
        setLoadError(false);
        setIsInitialized(false);
        setAddingReward(false);
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

    useEffect(() => {
        if (!itemIds) {
            setItemDetails({});
            return;
        }
        let active = true;
        void Promise.all(itemIds.split(",").map(async id => [id, await fetchItemDetails(id)] as const))
            .then(details => { if (active) setItemDetails(Object.fromEntries(details)); });
        return () => { active = false; };
    }, [itemIds]);

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
                .select("id, name, item_subcategory_id")
                .in("item_subcategory_id", groupIds)
                .order("position");

            // Monta estrutura hierárquica
            const structured = groups.map(g => ({
                ...g,
                subitems: subitems?.filter(s => s.item_subcategory_id === g.id) || []
            }));
            
            return { groups: structured.filter(group => group.subitems.length > 0) };
        }
        return { groups: [] };
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

    const updateProgram = (patch: Partial<LoyaltyProgram>) => {
        const current = useLoyaltyStore.getState().program ?? {
            id: "",
            restaurant_id: restaurantId || "",
            goal_count: 10,
            active: false,
            min_order_value_cents: 0,
            reward_item_id: null,
            reward_subitem_ids: [],
        };
        const next = { ...current, ...patch };
        setProgram(next);
        scheduleSave(next);
    };

    const handleMoneyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;
        val = val.replace(/[^0-9,]/g, "");
        if ((val.match(/,/g) || []).length > 1) return;
        setMinOrderDisplay(val);
        const floatVal = parseFloat(val.replace(',', '.'));
        const cents = isNaN(floatVal) ? 0 : Math.round(floatVal * 100);
        updateProgram({ min_order_value_cents: cents });
    };

    const rewards: LoyaltyRewardSelection[] = [
        ...(program?.reward_item_id ? [{ item_id: program.reward_item_id, subitem_ids: program.reward_subitem_ids ?? [] }] : []),
        ...(program?.additional_rewards ?? []),
    ];

    const saveRewards = ([first, ...additional]: LoyaltyRewardSelection[]) => {
        updateProgram({
            reward_item_id: first?.item_id ?? null,
            reward_subitem_ids: first?.subitem_ids ?? [],
            additional_rewards: additional,
        });
    };

    const replaceReward = (index: number, reward: LoyaltyRewardSelection) => {
        const next = [...rewards];
        next[index] = reward;
        saveRewards(next);
    };

    if (loadingProgram) return (
        <PageLoader label="Carregando programa de fidelidade" />
    );
    if (loadError) return <p role="alert" className="p-10 text-center text-red-600">Não foi possível carregar o programa de fidelidade.</p>;

    const safeProgram = program || { 
        active: false, 
        goal_count: 10, 
        min_order_value_cents: 0,
        reward_item_id: null,
        reward_subitem_ids: []
    };

    const configured = Boolean(safeProgram.reward_item_id) &&
        Number.isInteger(safeProgram.goal_count) && safeProgram.goal_count >= 1 && safeProgram.goal_count <= 100;

    const rewardOptions = (current?: string) => [
        { value: "", label: menuItems.length ? "Selecione um item" : "Nenhum item disponível", disabled: true },
        ...menuItems.filter(item => item.id === current || !rewards.some(reward => reward.item_id === item.id))
            .map(item => ({ value: item.id, label: item.name })),
    ];

    return (
        <div className="mx-auto max-w-6xl space-y-6 px-4 pb-20 pt-8 sm:px-6">
            <PageSaveHeader>
                <h1 className="text-3xl font-bold text-gray-900">Programa de Fidelidade</h1>
                <p className="mt-1 text-gray-500 2xl:text-lg">Defina como seus clientes ganham selos e qual recompensa podem resgatar.</p>
                <SaveStatus status={saveStatus} />
            </PageSaveHeader>

            {saveError && <Toast key={saveError} type="error" message={saveError} />}

            <ToggleOptionCard
                label="Status do programa"
                variant="section"
                className="flex-nowrap!"
                ariaLabel="Ativar programa de fidelidade"
                checked={safeProgram.active}
                switchBadge={safeProgram.active && (
                    <Badge variant={configured ? "success" : "warning"}>
                        {configured ? "Ativo" : "Não configurado"}
                    </Badge>
                )}
                onChange={(active) => updateProgram({ active })}
                description={safeProgram.active
                    ? "A cada pedido concluído que atingir o valor mínimo, o cliente ganha 1 selo."
                    : "A contagem de selos está pausada."}
            />

            <fieldset disabled={!safeProgram.active} className="grid min-w-0 items-start gap-4 disabled:opacity-75 lg:grid-cols-3">
                <Card className="min-w-0 space-y-4">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Regras de pontuação</h2>

                    </div>
                    <Input
                        label="Meta de pedidos (selos)"
                        type="number"
                        min={0}
                        max={100}
                        value={safeProgram.goal_count}
                        onChange={(e) => updateProgram({ goal_count: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))) })}
                        icon={<FontAwesomeIcon icon={faStar} className="text-gray-400" />}
                    />
                    <div>
                        <Input
                            label="Valor mínimo do pedido"
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
                            <Loader />
                        </div>
                    ) : (
                        <>
                            {(rewards.length ? rewards : [{ item_id: "", subitem_ids: [] }]).map((reward, index) => {
                                const details = itemDetails[reward.item_id];
                                const options = rewardOptions(reward.item_id);
                                if (reward.item_id && !options.some(option => option.value === reward.item_id)) {
                                    options.push({ value: reward.item_id, label: "Item indisponível", disabled: true });
                                }
                                return (
                                    <div key={reward.item_id || "initial"} className="space-y-3">
                                        <div className="flex items-end gap-2">
                                            <div className="min-w-0 flex-1">
                                                <Dropdown
                                                    label={index === 0 ? "Item de recompensa" : `Item de recompensa ${index + 1}`}
                                                    disabled={!safeProgram.active}
                                                    options={options}
                                                    value={reward.item_id}
                                                    onChange={event => replaceReward(index, { item_id: event.target.value, subitem_ids: [] })}
                                                />
                                            </div>
                                            {rewards.length > 1 && (
                                                <button
                                                    type="button"
                                                    aria-label={`Remover ${menuItems.find(item => item.id === reward.item_id)?.name ?? "item de recompensa"}`}
                                                    onClick={() => saveRewards(rewards.filter((_, position) => position !== index))}
                                                    className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                >
                                                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                                                </button>
                                            )}
                                        </div>
                                        {details && details.groups.length > 0 && (
                                            <div className="space-y-3">
                                                <h3 className="text-sm font-semibold text-gray-900">Complementos inclusos</h3>
                                                {details.groups.map(group => (
                                                    <fieldset key={group.id} className="min-w-0 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                                        <legend className={details.groups.length === 1 || /^complementos ad[i]?cionais$/i.test(group.name.trim()) ? "sr-only" : "px-1 text-sm font-medium text-gray-700"}>
                                                            {group.name}
                                                        </legend>
                                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                                            {group.subitems.map(sub => (
                                                                <label
                                                                    key={sub.id}
                                                                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-50 has-checked:border-brand has-checked:bg-[#fff1ea] has-disabled:cursor-not-allowed"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={reward.subitem_ids.includes(sub.id)}
                                                                        onChange={event => replaceReward(index, {
                                                                            ...reward,
                                                                            subitem_ids: event.target.checked
                                                                                ? [...reward.subitem_ids, sub.id]
                                                                                : reward.subitem_ids.filter(id => id !== sub.id),
                                                                        })}
                                                                        className="size-4 shrink-0 cursor-pointer accent-brand disabled:cursor-not-allowed"
                                                                    />
                                                                    <span className="min-w-0 flex-1 wrap-break-word">{sub.name}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </fieldset>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {rewards.length > 0 && rewardOptions().length > 1 && (
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        aria-expanded={addingReward}
                                        onClick={() => setAddingReward(open => !open)}
                                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-brand/30 py-3 text-sm font-medium text-brand transition-colors hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="text-xs" />
                                        Adicionar item de recompensa
                                    </button>
                                    {addingReward && (
                                        <Dropdown
                                            label="Selecione o item de recompensa"
                                            disabled={!safeProgram.active}
                                            options={rewardOptions()}
                                            value=""
                                            onChange={event => {
                                                saveRewards([...rewards, { item_id: event.target.value, subitem_ids: [] }]);
                                                setAddingReward(false);
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </Card>
            </fieldset>
            {restaurantId && <LoyaltyCustomers key={restaurantId} restaurantId={restaurantId} goal={safeProgram.goal_count} />}
            <PanelFeatureCallout feature="crm" />
        </div>
    );
}
