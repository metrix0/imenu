"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSearch } from "@fortawesome/free-solid-svg-icons";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown"; // Importando o componente

interface OrdersFilterProps {
    searchId: string;
    setSearchId: (val: string) => void;
    searchDate: string;
    setSearchDate: (val: string) => void;
    selectedStatus: string;
    setSelectedStatus: (val: string) => void;
    onSearch: () => void;
}

export default function OrdersFilter({
    searchId,
    setSearchId,
    searchDate,
    setSearchDate,
    selectedStatus,
    setSelectedStatus,
    onSearch
}: OrdersFilterProps) {

    // Opções para o Dropdown
    const statusOptions = [
        { value: "todas", label: "Todas as situações" },
        { value: "pending_online_payment", label: "À Pagar" },
        { value: "pending_physical_payment", label: "Pendente (Pgt. Entrega)" },
        { value: "paid", label: "Pendente (Pago)" },
        { value: "preparing", label: "Preparando" },
        { value: "delivering", label: "Em Rota" },
        { value: "done", label: "Concluído" },
        { value: "canceled", label: "Cancelado" },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            {/* Campo Número */}
            <div className="md:col-span-4">
                <Input 
                    label="Número do pedido" 
                    placeholder="Digite o número..." 
                    icon={<FontAwesomeIcon icon={faSearch} />}
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                />
            </div>

            {/* Dropdown Situação (Refatorado) */}
            <div className="md:col-span-3">
                <Dropdown
                    label="Situação"
                    options={statusOptions}
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                />
            </div>

            {/* Campo Data */}
            <div className="md:col-span-3">
                <Input 
                    label="Período" 
                    type="date" 
                    value={searchDate}
                    onChange={(e) => setSearchDate(e.target.value)}
                />
            </div>

            {/* Botão Buscar */}
            <div className="md:col-span-2">
                <Button
                    variant="secondary" 
                    onClick={onSearch} 
                    className="w-full h-[3rem] top-1/2 flex items-center justify-center "
                >
                    <FontAwesomeIcon icon={faSearch} />
                </Button>
            </div>
        </div>
    );
}