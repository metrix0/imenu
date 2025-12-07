// components/restaurant-owner/configuracoes/CreationStepper.tsx
"use client";

import { usePathname } from "next/navigation";

const steps = [
    "/restaurante/criar/localizacao",
    "/restaurante/criar/tempo-e-taxa",
    "/restaurante/criar/disponibilidade",
    "/restaurante/criar/cardapio",
];

export default function CreationStepper() {
    const pathname = usePathname();
    const currentStepIndex = steps.findIndex((step) => pathname.includes(step));

    return (
        <div className="w-full bg-white pb-10">
            <nav className="flex items-center w-full gap-2" aria-label="Progress">
                {steps.map((step, index) => {
                    const isActive = index <= currentStepIndex;

                    return (
                        // O Container agora é o "trilho" cinza
                        // Adicionamos overflow-hidden e rounded-full aqui para cortar a barra interna
                        <div 
                            key={step} 
                            className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden first:ml-0 last:mr-0"
                        >
                            {/* A barra interna é sempre vermelha (brand), mas a largura muda */}
                            <div
                                className={`h-full bg-brand transition-all duration-700 ease-out ${
                                    isActive ? "w-full" : "w-0"
                                }`}
                            />
                        </div>
                    );
                })}
            </nav>
        </div>
    );
}