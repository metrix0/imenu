"use client";

interface StoreBioProps {
    value: string;
    onChange: (val: string) => void;
    onBlur: () => void;
}

export default function StoreBio({ value, onChange, onBlur }: StoreBioProps) {
    return (
        <div >
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição / Bio</label>
            <textarea 
                className="w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-brand focus:border-brand  min-h-[100px] resize-none"
                placeholder="Conte um pouco sobre sua loja..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
            />
            <p className="text-xs text-gray-400 mt-1 text-right">{value.length}/250</p>
        </div>
    );
}