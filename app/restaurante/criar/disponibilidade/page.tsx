// app/restaurante/criar/disponibilidade/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import CreationStepper from "@/components/CreationStepper";
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import posthog from "posthog-js";


const DIAS_SEMANA = [
    { key: "1", label: "Segunda-feira" },
    { key: "2", label: "Terça-feira" },
    { key: "3", label: "Quarta-feira" },
    { key: "4", label: "Quinta-feira" },
    { key: "5", label: "Sexta-feira" },
    { key: "6", label: "Sábado" },
    { key: "0", label: "Domingo" },
];

type TimeSlot = {
    open: string;
    close: string;
};

type Availability = Record<string, TimeSlot[]>;

export default function DisponibilidadePage() {
    const router = useRouter();
    const { restaurantId } = useCreationStore();

    useEffect(() => {
        posthog.capture("admin_access_create_restaurant_availability_page", {
            page: "/restaurante/criar/disponibilidade",
            timestamp: new Date().toISOString(),
        });
    }, []);

    const [availability, setAvailability] = useState<Availability>({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const toggleDay = (dayKey: string) => {
        setAvailability(prev => {
            const newState = { ...prev };
            if (newState[dayKey]) {
                delete newState[dayKey];
            } else {
                newState[dayKey] = [{ open: "18:00", close: "23:00" }];
            }
            return newState;
        });
    };

    const addSlot = (dayKey: string) => {
        setAvailability(prev => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] || []), { open: "11:00", close: "15:00" }],
        }));
    };

    const removeSlot = (dayKey: string, slotIndex: number) => {
        setAvailability(prev => ({
            ...prev,
            [dayKey]: prev[dayKey].filter((_, i) => i !== slotIndex),
        }));
    };

    const handleTimeChange = (
        dayKey: string,
        slotIndex: number,
        type: 'open' | 'close',
        value: string
    ) => {
        setAvailability(prev => {
            const newState = { ...prev };
            newState[dayKey] = [...(newState[dayKey] || [])];
            newState[dayKey][slotIndex] = {
                ...newState[dayKey][slotIndex],
                [type]: value
            };
            return newState;
        });
    };

    const handleUseRecommended = () => {
        const recommended: Availability = {};
        const slots: TimeSlot[] = [
            { open: "11:00", close: "15:00" },
            { open: "18:00", close: "23:00" }
        ];

        for (let i = 0; i < 7; i++) {
            recommended[i.toString()] = [...slots];
        }
        setAvailability(recommended);
    };

    const handleSaveAndContinue = async () => {
        if (!restaurantId) {
            setError("Erro: ID do restaurante não encontrado. Volte ao início.");
            return;
        }

        setIsLoading(true);
        setError("");

        try {
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ availability_json: availability }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Falha ao salvar a disponibilidade.");
            }

            router.push("/restaurante/criar/cardapio");

        } catch (error) {
            setError((error as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="min-h-screen flex flex-col items-center justify-start p-6 bg-white">
            <div className="w-full max-w-3xl mt-12">

                <CreationStepper currentStep={3} />

                <div className="w-full max-w-2xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Horário de Funcionamento</h1>
                    <p className="text-gray-600 mb-6">
                        Defina os dias e horários que sua loja estará aberta.
                    </p>

                    <button
                        onClick={handleUseRecommended}
                        className="w-full py-3 px-4 mb-8 border border-gray-300 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50"
                    >
                        Usar recomendado
                    </button>

                    <div className="space-y-6">
                        {DIAS_SEMANA.map(({ key, label }) => {
                            const isDayOpen = (availability[key]?.length || 0) > 0;
                            return (
                                <div key={key} className="p-4 border border-gray-200 rounded-lg">
                                    <div className="flex items-center justify-between">
                                        <label htmlFor={`check-${key}`} className="flex items-center space-x-3 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                id={`check-${key}`}
                                                checked={isDayOpen}
                                                onChange={() => toggleDay(key)}
                                                className="h-5 w-5 rounded text-black focus:ring-black"
                                            />
                                            <span className="text-lg font-medium">{label}</span>
                                        </label>

                                        {isDayOpen && (
                                            <button
                                                onClick={() => addSlot(key)}
                                                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                            >
                                                + Adicionar horário
                                            </button>
                                        )}
                                    </div>

                                    {isDayOpen && (
                                        <div className="mt-4 space-y-3 pl-8">
                                            {availability[key].map((slot, index) => (
                                                <div key={index} className="flex items-center gap-2">
                                                    <input
                                                        type="time"
                                                        value={slot.open}
                                                        onChange={(e) => handleTimeChange(key, index, 'open', e.target.value)}
                                                        className="block w-full rounded-md border-gray-300 shadow-sm"
                                                    />
                                                    <span className="text-gray-500">às</span>
                                                    <input
                                                        type="time"
                                                        value={slot.close}
                                                        onChange={(e) => handleTimeChange(key, index, 'close', e.target.value)}
                                                        className="block w-full rounded-md border-gray-300 shadow-sm"
                                                    />
                                                    <button onClick={() => removeSlot(key, index)} className="text-red-500 hover:text-red-700 p-1">
                                                        <FontAwesomeIcon icon={icons.faTrash} className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {error && <p className="text-center text-sm text-red-600 mt-4">{error}</p>}

                    <button
                        type="button"
                        onClick={handleSaveAndContinue}
                        disabled={isLoading}
                        className="w-full mt-8 rounded-md bg-black px-4 py-3 text-base font-semibold text-white shadow-md hover:bg-gray-900 disabled:opacity-60"
                    >
                        {isLoading ? "Salvando..." : "Continuar"}
                    </button>
                </div>
            </div>
        </main>
    );
}