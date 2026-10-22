"use client";

import { formatPrice } from "@/lib/utils/formatPrice";

type Option = {
    id: string;
    name: string;
    price_cents: number;
    position?: number | null;
    is_available?: boolean;
};

function split(name: string) {
    const match = /^(Pequena|Média|Grande|BIG) \((\d+) cm\) — (.+)$/.exec(name);
    return match ? { size: match[1] + " (" + match[2] + " cm)", border: match[3].trim() } : null;
}

export function isPizzaSizeBorderGroup(name: string, options: Option[]) {
    return name === "Escolha o tamanho e a borda" && options.length >= 8
        && options.every(option => split(option.name) !== null);
}

export default function PizzaSizeAndBorderPicker<T extends Option>({
    options, selectedId, onSelect,
}: {
    options: T[];
    selectedId?: string;
    onSelect: (option: T) => void;
}) {
    const choices = [...options].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map(option => ({ option, ...split(option.name)! }));
    const sizes = [...new Set(choices.map(choice => choice.size))];
    const borders = [...new Set(choices.map(choice => choice.border))];
    const selected = choices.find(choice => choice.option.id === selectedId);
    const currentSize = selected?.size ?? sizes[0];
    const currentBorder = selected?.border ?? borders[0];
    const traditionalBorder = borders.find(border => border === "Borda Tradicional") ?? borders[0];
    const get = (size: string, border: string) =>
        choices.find(choice => choice.size === size && choice.border === border)?.option;
    const sizePrice = (size: string) => get(size, traditionalBorder)?.price_cents ?? 0;
    const price = (cents: number) => cents > 0 ? "+ " + formatPrice(cents) : null;
    const row = (active: boolean) =>
        "flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-gray-50 " + (active ? "bg-brand/5" : "");
    const circle = (active: boolean) =>
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border " + (active ? "border-brand bg-brand text-white" : "border-gray-300 bg-gray-100 text-gray-400");

    return (
        <section className="mt-4 overflow-hidden rounded-xl border border-gray-200">
            <div className="bg-gray-50 px-4 py-3">
                <p className="font-semibold text-gray-800">Escolha o tamanho</p>
                <p className="mt-0.5 text-xs text-gray-500">Escolha 1 · OBRIGATÓRIO</p>
            </div>
            <div className="divide-y divide-gray-100">
                {sizes.map(size => {
                    const option = get(size, currentBorder) ?? get(size, traditionalBorder);
                    const active = selected?.size === size;
                    if (!option) return null;
                    return (
                        <button key={size} type="button" className={row(active)}
                            aria-pressed={active} disabled={option.is_available === false}
                            onClick={() => onSelect(option)}>
                            <span className="font-medium text-gray-900">{size}</span>
                            <span className="flex items-center gap-3">
                                {price(sizePrice(size)) && <span className="text-xs text-gray-500">{price(sizePrice(size))}</span>}
                                <span className={circle(active)}>{active ? "✓" : ""}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-3">
                <p className="font-semibold text-gray-800">Escolha a borda</p>
                <p className="mt-0.5 text-xs text-gray-500">Escolha 1 · OBRIGATÓRIO</p>
            </div>
            <div className="divide-y divide-gray-100">
                {borders.map(border => {
                    const option = get(currentSize, border);
                    const active = selected?.border === border;
                    if (!option) return null;
                    const surcharge = option.price_cents - sizePrice(currentSize);
                    return (
                        <button key={border} type="button" className={row(active)}
                            aria-pressed={active} disabled={option.is_available === false}
                            onClick={() => onSelect(option)}>
                            <span className="font-medium text-gray-900">{border}</span>
                            <span className="flex items-center gap-3">
                                {price(surcharge) && <span className="text-xs text-gray-500">{price(surcharge)}</span>}
                                <span className={circle(active)}>{active ? "✓" : ""}</span>
                            </span>
                        </button>
                    );
                })}
            </div>
        </section>
    );
}
