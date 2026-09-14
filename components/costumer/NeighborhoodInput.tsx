"use client";

import { useId, useMemo, useState } from "react";

import Input from "@/components/ui/Input";
import {
    normalizeNeighborhoodName,
    type NeighborhoodDeliveryRule,
} from "@/lib/delivery/neighborhood";

type NeighborhoodInputProps = {
    value: string;
    rules: NeighborhoodDeliveryRule[];
    onChange: (value: string) => void;
    className?: string;
};

export default function NeighborhoodInput({
    value,
    rules,
    onChange,
    className = "",
}: NeighborhoodInputProps) {
    const [open, setOpen] = useState(false);
    const listId = useId();

    const options = useMemo(() => {
        const query = normalizeNeighborhoodName(value);
        const seen = new Set<string>();

        return rules.filter((rule) => {
            const key = normalizeNeighborhoodName(rule.neighborhood);
            if (!key || seen.has(key)) return false;

            const names = [rule.neighborhood, ...(rule.aliases || [])]
                .map(normalizeNeighborhoodName)
                .filter(Boolean);
            const matches = !query || names.some((name) => name.includes(query));

            if (matches) seen.add(key);
            return matches;
        });
    }, [rules, value]);

    const visible = open && options.length > 0;
    const normalizedValue = normalizeNeighborhoodName(value);

    return (
        <div
            className={`relative min-w-0 ${visible ? "z-[100]" : ""}`}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                    setOpen(false);
                }
            }}
        >
            <Input
                autoComplete="address-level3"
                label="Bairro"
                placeholder="Centro"
                value={value}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={visible}
                aria-controls={listId}
                onFocus={() => setOpen(true)}
                onKeyDown={(event) => {
                    if (event.key === "Escape") setOpen(false);
                }}
                onChange={(event) => {
                    onChange(event.target.value);
                    setOpen(true);
                }}
                className={className}
            />

            <div
                id={listId}
                role="listbox"
                aria-label="Bairros disponíveis"
                aria-hidden={!visible}
                inert={!visible}
                data-ui="dropdown-menu"
                className={`absolute left-0 right-0 top-full z-[110] mt-2 origin-top overflow-hidden rounded-xl border bg-white shadow-lg transition-all duration-200 ease-out ${
                    visible
                        ? "max-h-64 translate-y-0 scale-y-100 border-gray-200 opacity-100"
                        : "pointer-events-none max-h-0 -translate-y-1 scale-y-95 border-transparent opacity-0"
                }`}
            >
                <div className="max-h-64 overflow-y-auto p-1.5">
                    {options.map((rule) => {
                        const selected = [rule.neighborhood, ...(rule.aliases || [])]
                            .map(normalizeNeighborhoodName)
                            .filter(Boolean)
                            .includes(normalizedValue);

                        return (
                            <button
                                key={`${rule.neighborhood}-${rule.city || ""}-${rule.state || ""}`}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    onChange(rule.neighborhood);
                                    setOpen(false);
                                }}
                                className={`flex w-full cursor-pointer items-center rounded-lg px-3.5 py-2.5 text-left text-sm font-medium transition 2xl:text-base ${
                                    selected
                                        ? "bg-brand/5 text-brand"
                                        : "text-gray-700 hover:bg-gray-50"
                                }`}
                            >
                                <span className="truncate">{rule.neighborhood}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
