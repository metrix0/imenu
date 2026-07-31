"use client";

import Input from "@/components/ui/Input";

interface StoreNameProps {
    value: string;
    onChange: (val: string) => void;
    onBlur: () => void;
    className?: string;
}

export default function StoreName({
    value,
    onChange,
    onBlur,
    className = "",
}: StoreNameProps) {
    return (
        <div className="py-4">
            <Input
                label="Nome do Restaurante"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onBlur={onBlur}
                placeholder="Ex: Burger King"
                className={`text-lg font-medium ${className}`}
            />
        </div>
    );
}
