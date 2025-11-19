// components/CreationStepper.tsx
"use client";

import { useRouter } from "next/navigation";

// flow steps
const steps = [
    { name: "Localização", path: "/restaurante/criar/localizacao" },
    { name: "Tempo e Taxa", path: "/restaurante/criar/tempo-e-taxa" },
    { name: "Disponibilidade", path: "/restaurante/criar/disponibilidade" },
    { name: "Cardápio", path: "/restaurante/criar/cardapio" },
];

interface CreationStepperProps {
    currentStep: number; // 1-indexed (1 for localization, 2 for time, and so on.)
}

export default function CreationStepper({ currentStep }: CreationStepperProps) {
    const router = useRouter();

    return (
        <div className="w-full mb-12">
            <nav className="flex items-center justify-center space-x-2" aria-label="Progress">
                {steps.map((step, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = stepNumber < currentStep;
                    const isCurrent = stepNumber === currentStep;

                    return (
                        <div key={step.name} className="flex-1">
                            <button
                                onClick={() => {
                                    // Navigates only foward
                                    if (isCompleted || isCurrent) {
                                        router.push(step.path);
                                    }
                                }}
                                className={`group flex flex-col items-center py-2 px-1 w-full ${isCompleted || isCurrent ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                                disabled={!isCompleted && !isCurrent}
                            >
                                <span className={`h-2 w-full rounded-full ${isCompleted || isCurrent ? 'bg-black' : 'bg-gray-200'}`} />
                                <span className={`mt-3 text-sm font-medium ${isCurrent ? 'text-black' : 'text-gray-500'}`}>
                                    {step.name}
                                </span>
                            </button>
                        </div>
                    );
                })}
            </nav>
        </div>
    );
}