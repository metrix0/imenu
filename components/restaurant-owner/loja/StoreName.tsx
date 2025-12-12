"use client";

import Input from "@/components/ui/Input";

interface StoreNameProps {
    value: string;
    onChange: (val: string) => void;
    onBlur: () => void;
}

export default function StoreName({ value, onChange, onBlur }: StoreNameProps) {
    return (
        <div className="py-4">
             <Input 
                label="Nome do Restaurante"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder="Ex: Burger King"
                className="text-lg font-medium"
            />
        </div>
    );
}