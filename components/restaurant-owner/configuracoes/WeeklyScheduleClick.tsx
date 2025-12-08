// components/restaurant-owner/configuracoes/WeeklyScheduleClick.tsx
"use client";

import { useState, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash, faStar } from "@fortawesome/free-solid-svg-icons";
// import Popup from "@/components/ui/Popup"; // REMOVIDO
import Button from "@/components/ui/Button";

// --- Internal Modal Component ---
// Um modal simples e customizado apenas para este arquivo
const LocalModal = ({ 
    isOpen, 
    onClose, 
    children 
}: { 
    isOpen: boolean; 
    onClose: () => void; 
    children: React.ReactNode 
}) => {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[1px] transition-opacity"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 2xl:p-10 m-4 relative animate-fadeUp"
                onClick={(e) => e.stopPropagation()} // Impede que o clique dentro do modal feche ele
            >
                {children}
            </div>
        </div>
    );
};

// --- Types ---
export type TimeSlot = {
    open: string;  // "HH:mm"
    close: string; // "HH:mm"
};

export type Availability = Record<string, TimeSlot[]>;

const DAYS = [
    { key: "0", label: "Domingo" },
    { key: "1", label: "Segunda" },
    { key: "2", label: "Terça" },
    { key: "3", label: "Quarta" },
    { key: "4", label: "Quinta" },
    { key: "5", label: "Sexta" },
    { key: "6", label: "Sábado" },
];

// Grid Configuration
const PX_PER_HOUR = 28; 
const SNAP_MINUTES = 30; 
const TOTAL_HOURS = 24;
const TOTAL_HEIGHT = TOTAL_HOURS * PX_PER_HOUR;

// --- Helpers ---
const timeToMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
};

const minToTime = (m: number) => {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
};

const snapToGrid = (minutes: number) => {
    return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
};

const generateTimeOptions = () => {
    const options = [];
    for (let i = 0; i < 24 * 60; i += 15) { 
        options.push(minToTime(i));
    }
    return options;
};
const TIME_OPTIONS = generateTimeOptions();


interface WeeklyScheduleClickProps {
    value: Availability;
    onChange: (newVal: Availability) => void;
}

export default function WeeklyScheduleClick({ value, onChange }: WeeklyScheduleClickProps) {
    // Referência não é mais estritamente necessária para o clique no dia, 
    // mas mantemos caso precise de scroll manipulation no futuro.
    const containerRef = useRef<HTMLDivElement>(null);

    // --- State for Popups ---
    const [editModal, setEditModal] = useState<{
        isOpen: boolean;
        dayKey: string;
        slotIndex: number | null; 
        startTime: string;
        endTime: string;
    }>({ isOpen: false, dayKey: "0", slotIndex: null, startTime: "00:00", endTime: "01:00" });

    const [deleteConfirmModal, setDeleteConfirmModal] = useState({
        isOpen: false,
    });

    // --- Handlers ---

    const handleEmptyClick = (e: React.MouseEvent, dayKey: string) => {
        const target = e.currentTarget as HTMLDivElement;
        const rect = target.getBoundingClientRect();
        const offsetY = e.clientY - rect.top;
        
        const rawMinutes = (offsetY / PX_PER_HOUR) * 60;
        
        const startMin = snapToGrid(rawMinutes);
        const endMin = Math.min(startMin + 60, 24 * 60 - 1);

        setEditModal({
            isOpen: true,
            dayKey,
            slotIndex: null, 
            startTime: minToTime(startMin),
            endTime: minToTime(endMin)
        });
    };

    const handleBlockClick = (e: React.MouseEvent, dayKey: string, index: number, slot: TimeSlot) => {
        e.stopPropagation(); 
        setEditModal({
            isOpen: true,
            dayKey,
            slotIndex: index,
            startTime: slot.open,
            endTime: slot.close
        });
    };

    const handleSaveSlot = () => {
        const { dayKey, slotIndex, startTime, endTime } = editModal;
        
        if (timeToMin(startTime) >= timeToMin(endTime)) {
            alert("O horário de término deve ser depois do início.");
            return;
        }

        const currentSlots = value[dayKey] || [];
        let newSlots = [...currentSlots];

        if (slotIndex === null) {
            newSlots.push({ open: startTime, close: endTime });
        } else {
            newSlots[slotIndex] = { open: startTime, close: endTime };
        }

        onChange({ ...value, [dayKey]: newSlots });
        setEditModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleDeleteRequest = () => {
        setDeleteConfirmModal({ isOpen: true });
    };

    const handleConfirmDelete = () => {
        const { dayKey, slotIndex } = editModal;
        
        if (slotIndex !== null) {
            const currentSlots = value[dayKey] || [];
            const newSlots = currentSlots.filter((_, i) => i !== slotIndex);
            onChange({ ...value, [dayKey]: newSlots });
        }

        setDeleteConfirmModal({ isOpen: false });
        setEditModal(prev => ({ ...prev, isOpen: false }));
    };


    // --- Rendering ---
    const gridHours = Array.from({ length: 12 }, (_, i) => i * 2); // 0, 2, 4...

    const renderSlot = (slot: TimeSlot, index: number, dayKey: string) => {
        const startMin = timeToMin(slot.open);
        const endMin = timeToMin(slot.close);
        const top = (startMin / 60) * PX_PER_HOUR;
        const height = ((endMin - startMin) / 60) * PX_PER_HOUR;
        
        const isTooSmall = height < 25;
        const isLargeBlock = (endMin - startMin) >= 180;

        return (
            <div
                key={index}
                onClick={(e) => handleBlockClick(e, dayKey, index, slot)}
                className="absolute left-1 right-1 rounded-md flex flex-col justify-center items-center shadow-sm border select-none overflow-hidden p-1 bg-gray-800 border-gray-900 text-white z-10 cursor-pointer hover:bg-gray-700 transition-colors group"
                style={{ top: `${top}px`, height: `${height}px`, minHeight: '20px' }}
            >
                {isLargeBlock && (
                    <div className="flex items-center gap-1 mb-1 opacity-90">
                        <FontAwesomeIcon icon={faStar} className="w-3 h-3 text-yellow-400 text-xs 2xl:text-sm" />
                        <span className="text-[10px] font-medium uppercase tracking-wide 2xl:text-sm">Melhor horário</span>
                    </div>
                )}
                {!isTooSmall && (
                    <span className="font-bold text-[10px] 2xl:text-sm leading-tight text-center">
                        {slot.open} - {slot.close}
                    </span>
                )}
            </div>
        );
    };

    const getDayLabel = (key: string) => DAYS.find(d => d.key === key)?.label || "Dia";

    return (
        <div className="flex flex-col select-none relative">
            
            {/* --- Header Row (Dias + Status) --- */}
            <div className="flex pb-4">
                {/* Espaço vazio acima da coluna de horas */}
                <div className="w-14 flex-shrink-0"></div>

                {/* Colunas dos Dias */}
                {DAYS.map(day => {
                    const daySlots = value[day.key] || [];
                    const isClosed = daySlots.length === 0;

                    return (
                        <div key={day.key} className="flex-1 text-center flex flex-col gap-1">
                            <span className="text-lg font-bold text-gray-900">{day.label}</span>
                            <span className={`text-sm font-medium ${isClosed ? 'text-gray-400' : 'text-brand'}`}>
                                {isClosed ? 'Fechada' : 'Aberta'}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* --- Body Row (Horas + Grid) --- */}
            <div className="flex relative">
                
                {/* Coluna de Horários (Eixo Y) - Fora da Matriz */}
                <div className="w-14 flex-shrink-0 relative border-r border-transparent">
                    {gridHours.map((h) => (
                        <div 
                            key={h} 
                            className="absolute w-full text-[11px] font-medium text-gray-400 text-right pr-3 -mt-2 2xl:text-base 2xl:pr-5"
                            style={{ top: `${h * PX_PER_HOUR}px` }}
                        >
                            {String(h).padStart(2, "0")}h
                        </div>
                    ))}
                </div>

                {/* Área da Matriz (Grid) */}
                <div className="flex-1 flex border border-gray-200 rounded-lg bg-white overflow-hidden relative" style={{ height: `${TOTAL_HEIGHT}px` }}>
                    
                    {/* Linhas de Fundo (Grid Lines) */}
                    <div className="absolute inset-0 pointer-events-none z-0">
                        {gridHours.map((h) => (
                            <div 
                                key={h} 
                                className="border-b border-gray-100 w-full absolute"
                                style={{ top: `${h * PX_PER_HOUR}px` }}
                            />
                        ))}
                    </div>

                    {/* Colunas dos Dias (Áreas de Clique) */}
                    {DAYS.map(day => (
                        <div 
                            key={day.key} 
                            className="flex-1 relative border-r border-gray-100 last:border-0 z-10 hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={(e) => handleEmptyClick(e, day.key)}
                        >
                            {(value[day.key] || []).map((slot, idx) => 
                                renderSlot(slot, idx, day.key)
                            )}
                        </div>
                    ))}
                </div>
            </div>


            {/* --- CUSTOM MODAL 1: EDIT / ADD TIME --- */}
            <LocalModal 
                isOpen={editModal.isOpen} 
                onClose={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
            >
                <div className="text-left">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-gray-900">
                            {getDayLabel(editModal.dayKey)}
                        </h3>
                        {/* Close X button optionally can go here */}
                    </div>

                    <div className="flex items-end gap-4 mb-8">
                        <div className="flex-1">
                            <label className="block text-sm 2xl:text-lg font-medium text-gray-500 mb-1">Das</label>
                            <div className="relative">
                                <select
                                    value={editModal.startTime}
                                    onChange={(e) => setEditModal(p => ({ ...p, startTime: e.target.value }))}
                                    className="w-full appearance-none border border-gray-300 rounded-lg py-3 pl-3 pr-8 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-shadow"
                                >
                                    {TIME_OPTIONS.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        
                        <div className="flex-1">
                            <label className="block text-sm font-medium 2xl:text-lg  text-gray-500 mb-1">Até</label>
                            <div className="relative">
                                <select
                                    value={editModal.endTime}
                                    onChange={(e) => setEditModal(p => ({ ...p, endTime: e.target.value }))}
                                    className="w-full appearance-none border border-gray-300 rounded-lg py-3 pl-3 pr-8 text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-shadow"
                                >
                                    {TIME_OPTIONS.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {editModal.slotIndex !== null && (
                            <button 
                                onClick={handleDeleteRequest}
                                className="mb-3 p-2 text-brand hover:text-red-700 hover:bg-red-50 rounded-full transition-colors"
                                title="Excluir horário"
                            >
                                <FontAwesomeIcon icon={faTrash} className="w-5 h-5 2xl:text-lg cursor-pointer" />
                            </button>
                        )}
                    </div>

                    <div className="flex gap-3 2xl:gap-5 justify-end">
                        <Button variant={"secondary"}
                            onClick={() => setEditModal(prev => ({ ...prev, isOpen: false }))}
                            className=""
                        >
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveSlot} >
                            {editModal.slotIndex === null ? "Adicionar" : "Salvar"}
                        </Button>
                    </div>
                </div>
            </LocalModal>

            {/* --- CUSTOM MODAL 2: CONFIRM DELETE --- */}
            <LocalModal
                isOpen={deleteConfirmModal.isOpen}
                onClose={() => setDeleteConfirmModal({ isOpen: false })}
            >
                <div className="text-left my-5">
                     <h3 className="text-xl font-bold text-gray-900 mb-2">
                        Excluir horário?
                    </h3>
                    <p className="text-gray-600 mb-8 text-base">
                        Tem certeza que deseja excluir o horário <strong>{editModal.startTime} - {editModal.endTime}</strong> de {getDayLabel(editModal.dayKey)}?
                    </p>

                    <div className="flex gap-3 justify-end">
                         <button
                            onClick={() => setDeleteConfirmModal({ isOpen: false })}
                            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-md transition-colors"
                        >
                            Manter
                        </button>
                        <Button 
                            variant="primary" 
                            className="bg-brand hover:bg-red-700"
                            onClick={handleConfirmDelete}
                        >
                            Excluir
                        </Button>
                    </div>
                </div>
            </LocalModal>

        </div>
    );
}