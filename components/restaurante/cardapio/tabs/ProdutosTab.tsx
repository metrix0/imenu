"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch, faBoxOpen, faPlus } from "@fortawesome/free-solid-svg-icons";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown"; // Importando o componente Dropdown
import MenuItemRow, { MenuItemType } from "@/components/restaurante/cardapio/MenuItemRow";

interface ProdutosTabProps {
    items: MenuItemType[];
    onRefresh: () => void;
    onOpenItemDetails: (item: MenuItemType) => void;
    onAddNewProduct: () => void; 
}

export default function ProdutosTab({ items, onRefresh, onOpenItemDetails, onAddNewProduct }: ProdutosTabProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const [sortOrder, setSortOrder] = useState("name_asc");

    // Filtros e Ordenação (Mantido igual)
    const filteredItems = items.filter(i => 
        i.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedItems = [...filteredItems].sort((a, b) => {
        if (sortOrder === "name_asc") return a.name.localeCompare(b.name);
        if (sortOrder === "price_asc") return a.price_cents - b.price_cents;
        if (sortOrder === "price_desc") return b.price_cents - a.price_cents;
        return 0;
    });

    // Opções para o Dropdown
    const sortOptions = [
        { value: "name_asc", label: "Ordenar por Nome (A-Z)" },
        { value: "price_asc", label: "Ordenar por Preço (Menor)" },
        { value: "price_desc", label: "Ordenar por Preço (Maior)" },
    ];

    if (items.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-lg border border-gray-100 shadow-sm">
                <div className="w-40 h-40 bg-gray-50 rounded-full flex items-center justify-center mb-6">
                     <FontAwesomeIcon icon={faBoxOpen} className="text-5xl text-gray-300" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                <p className="text-gray-500 text-sm mb-8 text-center max-w-md">
                    Clique no botão abaixo para adicionar um novo produto
                </p>
                <Button variant="primary" onClick={onAddNewProduct} className="bg-brand text-white">
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    Adicionar produto
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full">
                    <Input 
                        placeholder="Buscar produto no cardápio" 
                        icon={<FontAwesomeIcon icon={faSearch} />}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex gap-4 w-full md:w-64">
                    {/* Dropdown substituindo o select nativo */}
                    <Dropdown 
                        options={sortOptions}
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                    />
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                {sortedItems.map(item => (
                    <MenuItemRow 
                        key={item.id}
                        item={item}
                        onSave={async () => { onRefresh() }} 
                        onDelete={() => {}} 
                        onOpenDetails={() => onOpenItemDetails(item)}
                    />
                ))}
                {sortedItems.length === 0 && searchTerm && (
                    <p className="text-center text-gray-500 py-10">Nenhum produto encontrado para "{searchTerm}"</p>
                )}
            </div>
             
             <div className="flex justify-end">
                <Button variant="secondary" onClick={onAddNewProduct}>
                    + Adicionar produto
                </Button>
             </div>
        </div>
    );
}