"use client";

import { useEffect, useState } from "react";
import type { Category, PizzaSettings } from "@/lib/types/types";
import { DEFAULT_PIZZA_SETTINGS, MAX_PIZZA_FLAVORS } from "@/lib/pizza/pricing";
import { supabase } from "@/lib/database/supabaseClient";
import Card from "@/components/ui/Card";
import Switch from "@/components/ui/Switch";
import SaveStatus from "@/components/ui/SaveStatus";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import ChoiceCardGroup from "@/components/ui/ChoiceCardGroup";

export default function PizzaSettingsSection({ restaurantId }: { restaurantId: string }) {
    const [settings, setSettings] = useState<PizzaSettings>(DEFAULT_PIZZA_SETTINGS);
    const [categories, setCategories] = useState<Category[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
    const [error, setError] = useState("");

    const request = async (body?: PizzaSettings) => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Sessão expirada. Entre novamente.");
        const response = await fetch(`/api/restaurants/${restaurantId}/pizza`, {
            method: body ? "PATCH" : "GET",
            headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
            ...(body ? { body: JSON.stringify(body) } : {}),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        return data;
    };
    const load = async () => {
        try {
            setError("");
            const data = await request();
            setSettings(data.settings); setCategories(data.categories); setLoaded(true);
        } catch (e) { setError(e instanceof Error ? e.message : "Erro ao carregar o Modo Pizza."); }
    };
    useEffect(() => { void load(); }, [restaurantId]);
    const save = async (next: PizzaSettings) => {
        if (status === "saving") return;
        setStatus("saving"); setError("");
        try {
            const data = await request(next);
            setSettings(data.settings); setStatus("saved");
        } catch (e) { setStatus("error"); setError(e instanceof Error ? e.message : "Erro ao salvar."); }
    };

    return <Card className="border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between gap-4">
            <div>
                <h2 id="pizza-settings-title" className="text-xl font-medium text-gray-900">Modo Pizza</h2>
                <p className="mt-2 text-sm text-gray-500">Permita combinar sabores das categorias escolhidas em uma única pizza.</p>
            </div>
            <Switch aria-labelledby="pizza-settings-title" checked={settings.enabled} disabled={!loaded || status === "saving"} className="cursor-pointer disabled:cursor-not-allowed" onClick={() => void save({ ...settings, enabled: !settings.enabled })} />
        </div>
        {!loaded && !error && <p role="status" className="mt-3 text-sm text-gray-500">Carregando...</p>}
        {error && <div className="mt-3"><p role="alert" className="text-sm text-red-700">{error}</p>{!loaded && <Button variant="secondary" onClick={() => void load()}>Tentar novamente</Button>}</div>}
        {loaded && settings.enabled && <fieldset className="mt-6 space-y-5">
            <div>
                <p className="mb-2 font-medium">Preço da pizza</p>
                <ChoiceCardGroup
                    value={settings.pricing_rule}
                    disabled={status === "saving"}
                    onChange={(rule) => void save({ ...settings, pricing_rule: rule })}
                    className="sm:grid-cols-2"
                    options={[
                        { value: "highest", label: "Sabor mais caro", description: "Cobra o maior preço entre os sabores escolhidos." },
                        { value: "average", label: "Média dos sabores", description: "Soma os preços e divide pela quantidade de sabores." },
                    ]}
                />
            </div>
            <Dropdown
                custom
                label="Máximo de sabores por pizza"
                aria-label="Máximo de sabores por pizza"
                value={settings.max_flavors}
                disabled={status === "saving"}
                onChange={e => void save({ ...settings, max_flavors: Number(e.target.value) })}
                options={Array.from({ length: MAX_PIZZA_FLAVORS - 1 }, (_, i) => i + 2).map(n => ({
                    value: n,
                    label: `${n} sabores${n === 2 ? " (padrão)" : ""}`,
                }))}
                className="cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 p-4">
                <div>
                    <p id="pizza-same-category-title" className="font-medium">Combinar apenas pizzas da mesma categoria</p>
                    <p className="mt-1 text-sm text-gray-500">Apenas pizzas da mesma categoria podem ser combinadas. Na lista de itens, só aparecerão pizzas da mesma categoria.</p>
                </div>
                <Switch aria-labelledby="pizza-same-category-title" checked={settings.same_category_only} disabled={status === "saving"} className="shrink-0 cursor-pointer disabled:cursor-not-allowed" onClick={() => void save({ ...settings, same_category_only: !settings.same_category_only })} />
            </div>
            <div>
                <p className="font-medium">Categorias que podem combinar sabores</p>
                <p className="mt-1 text-sm text-gray-500">Os produtos destas categorias podem ser combinados entre si, inclusive entre categorias diferentes.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {categories.map(category => <label key={category.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 p-3">
                        <input type="checkbox" disabled={status === "saving"} className="h-4 w-4 cursor-pointer accent-brand disabled:cursor-not-allowed" checked={settings.category_ids.includes(category.id)} onChange={e => void save({ ...settings, category_ids: e.target.checked ? [...settings.category_ids, category.id] : settings.category_ids.filter(id => id !== category.id) })} />
                        <span>{category.name}</span>
                    </label>)}
                </div>
                {!categories.length && <p className="mt-2 text-sm text-gray-500">Cadastre as categorias no cardápio para começar.</p>}
                {!settings.category_ids.length && categories.length > 0 && <p className="mt-2 text-sm text-gray-500">Selecione ao menos uma categoria para liberar a combinação de sabores.</p>}
            </div>
            <p className="text-sm text-gray-500">Os complementos são escolhidos no primeiro sabor. Use os mesmos nomes de grupos e opções nos outros sabores (por exemplo, Tamanho → Grande); cada sabor usa os próprios preços.</p>
        </fieldset>}
        <SaveStatus status={status} className="mt-3" />
    </Card>;
}
