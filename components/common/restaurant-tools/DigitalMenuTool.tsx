"use client";

import { useEffect, useMemo, useState } from "react";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import {
    formatCurrency,
    NumberField,
    ToolPanel,
} from "@/components/common/restaurant-tools/ToolUi";

type MenuItem = {
    id: number;
    name: string;
    description: string;
    price: number;
};

type MenuCategory = {
    id: number;
    name: string;
    items: MenuItem[];
};

type MenuDraft = {
    restaurantName: string;
    whatsapp: string;
    categories: MenuCategory[];
};

const STORAGE_KEY = "imenu-free-menu-draft";

const INITIAL_CATEGORIES: MenuCategory[] = [
    {
        id: 1,
        name: "Lanches",
        items: [
            {
                id: 11,
                name: "Cheeseburger da casa",
                description: "Pão, hambúrguer artesanal, queijo e molho da casa.",
                price: 28,
            },
        ],
    },
];

function newId(): number {
    return Date.now() + Math.floor(Math.random() * 1000);
}

function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function normalizeWhatsapp(value: string): string {
    const digits = value.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
}

function isMenuCategories(value: unknown): value is MenuCategory[] {
    if (!Array.isArray(value) || !value.length) return false;

    return value.every((candidate) => {
        if (!candidate || typeof candidate !== "object") return false;
        const category = candidate as Partial<MenuCategory>;

        return (
            typeof category.id === "number" &&
            typeof category.name === "string" &&
            Array.isArray(category.items) &&
            category.items.every(
                (item) =>
                    typeof item.id === "number" &&
                    typeof item.name === "string" &&
                    typeof item.description === "string" &&
                    typeof item.price === "number"
            )
        );
    });
}

function menuText(draft: MenuDraft): string {
    const lines = [`*${draft.restaurantName || "Cardápio"}*`];
    for (const category of draft.categories) {
        lines.push("", `*${category.name || "Categoria"}*`);
        for (const item of category.items) {
            lines.push(`${item.name || "Produto"} — ${formatCurrency(item.price)}`);
            if (item.description.trim()) lines.push(item.description.trim());
        }
    }
    return lines.join("\n");
}

function standaloneHtml(draft: MenuDraft): string {
    const phone = normalizeWhatsapp(draft.whatsapp);
    const categories = draft.categories.map((category) => `
        <section>
            <h2>${escapeHtml(category.name || "Categoria")}</h2>
            ${category.items.map((item) => {
                const message = encodeURIComponent(`Olá! Quero pedir ${item.name || "este item"}.`);
                return `<article>
                    <div><h3>${escapeHtml(item.name || "Produto")}</h3><p>${escapeHtml(item.description)}</p></div>
                    <div class="price">${escapeHtml(formatCurrency(item.price))}</div>
                    ${phone ? `<a href="https://wa.me/${phone}?text=${message}">Pedir</a>` : ""}
                </article>`;
            }).join("")}
        </section>`).join("");

    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(draft.restaurantName || "Cardápio")}</title><style>body{margin:0;background:#f7f7f7;color:#1f2937;font-family:Arial,sans-serif}.wrap{max-width:760px;margin:auto;padding:32px 18px}header{background:#f14400;color:white;padding:30px;border-radius:20px;margin-bottom:20px}h1{margin:0;font-size:32px}section{background:white;border:1px solid #e5e7eb;border-radius:16px;padding:22px;margin:16px 0}h2{margin:0 0 12px}article{display:grid;grid-template-columns:1fr auto;gap:8px 18px;padding:16px 0;border-top:1px solid #eee}article:first-of-type{border-top:0}h3,p{margin:0}p{color:#6b7280;font-size:14px;margin-top:5px}.price{font-weight:700}a{grid-column:1/-1;width:max-content;background:#f14400;color:white;text-decoration:none;padding:9px 14px;border-radius:8px;font-weight:700;font-size:14px}</style></head><body><main class="wrap"><header><h1>${escapeHtml(draft.restaurantName || "Cardápio")}</h1></header>${categories}</main></body></html>`;
}

export default function DigitalMenuTool() {
    const [restaurantName, setRestaurantName] = useState("Meu Restaurante");
    const [whatsapp, setWhatsapp] = useState("");
    const [categories, setCategories] = useState<MenuCategory[]>(INITIAL_CATEGORIES);
    const [hydrated, setHydrated] = useState(false);
    const [message, setMessage] = useState("");

    useEffect(() => {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const draft = JSON.parse(stored) as Partial<MenuDraft>;
                if (typeof draft.restaurantName === "string") setRestaurantName(draft.restaurantName);
                if (typeof draft.whatsapp === "string") setWhatsapp(draft.whatsapp);
                if (isMenuCategories(draft.categories)) setCategories(draft.categories);
            }
        } catch {
            window.localStorage.removeItem(STORAGE_KEY);
        } finally {
            setHydrated(true);
        }
    }, []);

    useEffect(() => {
        if (!hydrated) return;
        window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ restaurantName, whatsapp, categories })
        );
    }, [categories, hydrated, restaurantName, whatsapp]);

    const draft = useMemo(
        () => ({ restaurantName, whatsapp, categories }),
        [categories, restaurantName, whatsapp]
    );
    const phone = normalizeWhatsapp(whatsapp);

    const updateCategory = (categoryId: number, name: string) => {
        setCategories((current) => current.map((category) => category.id === categoryId ? { ...category, name } : category));
    };

    const updateItem = (
        categoryId: number,
        itemId: number,
        field: keyof Omit<MenuItem, "id">,
        value: string | number
    ) => {
        setCategories((current) => current.map((category) => category.id !== categoryId ? category : {
            ...category,
            items: category.items.map((item) => item.id === itemId ? { ...item, [field]: value } : item),
        }));
    };

    const addCategory = () => {
        if (categories.length >= 10) return;
        setCategories((current) => [...current, { id: newId(), name: `Categoria ${current.length + 1}`, items: [] }]);
    };

    const addItem = (categoryId: number) => {
        setCategories((current) => current.map((category) => {
            if (category.id !== categoryId || category.items.length >= 20) return category;
            return {
                ...category,
                items: [...category.items, { id: newId(), name: "Novo produto", description: "", price: 0 }],
            };
        }));
    };

    const copyMenu = async () => {
        try {
            await navigator.clipboard.writeText(menuText(draft));
            setMessage("Cardápio copiado para a área de transferência.");
        } catch {
            setMessage("Não foi possível copiar neste navegador.");
        }
    };

    const downloadHtml = () => {
        const blob = new Blob([standaloneHtml(draft)], { type: "text/html;charset=utf-8" });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "cardapio-digital.html";
        link.click();
        URL.revokeObjectURL(objectUrl);
        setMessage("Arquivo HTML baixado.");
    };

    return (
        <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <ToolPanel title="Monte seu cardápio" description="O rascunho é salvo automaticamente neste navegador.">
                <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="Nome do restaurante" value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} />
                    <Input label="WhatsApp para pedidos" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} placeholder="(11) 99999-9999" inputMode="tel" />
                </div>

                <div className="mt-6 space-y-4">
                    {categories.map((category, categoryIndex) => (
                        <div key={category.id} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                                <div className="flex-1">
                                    <Input label={`Categoria ${categoryIndex + 1}`} value={category.name} onChange={(event) => updateCategory(category.id, event.target.value)} />
                                </div>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="text-red-600"
                                    disabled={categories.length === 1}
                                    onClick={() => setCategories((current) => current.filter((currentCategory) => currentCategory.id !== category.id))}
                                >
                                    Remover categoria
                                </Button>
                            </div>

                            <div className="mt-4 space-y-3">
                                {category.items.map((item, itemIndex) => (
                                    <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
                                        <div className="grid gap-3 sm:grid-cols-[1fr_0.45fr]">
                                            <Input label={`Produto ${itemIndex + 1}`} value={item.name} onChange={(event) => updateItem(category.id, item.id, "name", event.target.value)} />
                                            <NumberField label="Preço" value={item.price} onChange={(value) => updateItem(category.id, item.id, "price", value)} prefix="R$" />
                                        </div>
                                        <label className="mt-3 block text-xs font-medium 2xl:text-base">
                                            Descrição
                                            <textarea
                                                value={item.description}
                                                onChange={(event) => updateItem(category.id, item.id, "description", event.target.value)}
                                                rows={2}
                                                className="mt-1 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-3 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                                            />
                                        </label>
                                        <button
                                            type="button"
                                            className="mt-2 cursor-pointer text-xs font-medium text-red-600 hover:underline"
                                            onClick={() => setCategories((current) => current.map((currentCategory) => currentCategory.id !== category.id ? currentCategory : { ...currentCategory, items: currentCategory.items.filter((currentItem) => currentItem.id !== item.id) }))}
                                        >
                                            Remover produto
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <Button type="button" variant="secondary" className="mt-3" onClick={() => addItem(category.id)} disabled={category.items.length >= 20}>
                                Adicionar produto
                            </Button>
                        </div>
                    ))}
                </div>
                <Button type="button" variant="secondary" className="mt-4" onClick={addCategory} disabled={categories.length >= 10}>
                    Adicionar categoria
                </Button>
            </ToolPanel>

            <div className="xl:sticky xl:top-5 xl:self-start">
                <ToolPanel title="Prévia do cardápio">
                    <div id="generated-menu" className="overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                        <header className="bg-brand p-6 text-white">
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Cardápio</p>
                            <h2 className="mt-1 break-words text-2xl font-bold">{restaurantName || "Meu Restaurante"}</h2>
                        </header>
                        <div className="space-y-4 p-4">
                            {categories.map((category) => (
                                <section key={category.id} className="rounded-xl border border-gray-200 bg-white p-4">
                                    <h3 className="font-bold text-gray-950">{category.name || "Categoria"}</h3>
                                    <div className="mt-2 divide-y divide-gray-100">
                                        {category.items.length ? category.items.map((item) => (
                                            <article key={item.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
                                                <div className="min-w-0">
                                                    <h4 className="break-words font-semibold text-gray-900">{item.name || "Produto"}</h4>
                                                    {item.description && <p className="mt-1 break-words text-xs leading-5 text-gray-500">{item.description}</p>}
                                                </div>
                                                <p className="font-bold text-gray-950">{formatCurrency(item.price)}</p>
                                                {phone && (
                                                    <a
                                                        href={`https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Quero pedir ${item.name || "este item"}.`)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="col-span-2 w-fit rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white"
                                                    >
                                                        Pedir no WhatsApp
                                                    </a>
                                                )}
                                            </article>
                                        )) : <p className="py-3 text-sm text-gray-400">Adicione produtos nesta categoria.</p>}
                                    </div>
                                </section>
                            ))}
                        </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                        <Button type="button" variant="secondary" onClick={() => void copyMenu()}>Copiar texto</Button>
                        <Button type="button" variant="secondary" onClick={() => window.print()}>Salvar em PDF</Button>
                        <Button type="button" onClick={downloadHtml}>Baixar HTML</Button>
                    </div>
                    {message && <p role="status" className="mt-3 text-sm text-gray-600">{message}</p>}
                </ToolPanel>
            </div>

            <style jsx global>{`
                @media print {
                    body * { visibility: hidden !important; }
                    #generated-menu, #generated-menu * { visibility: visible !important; }
                    #generated-menu { position: absolute; inset: 0 auto auto 0; width: 100%; border: 0 !important; }
                }
            `}</style>
        </div>
    );
}
