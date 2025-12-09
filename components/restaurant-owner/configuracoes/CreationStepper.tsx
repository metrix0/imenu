"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

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
        <div className="bg-white pb-10 flex w-full relative justify-center">
            <nav className="flex items-center w-full gap-2 mx-4" aria-label="Progress">
                {steps.map((step, index) => {
                    const isActive = index <= currentStepIndex;

                    // Otimização de UX: Normalmente em wizards, permitimos clicar
                    // apenas para voltar (steps anteriores) ou no atual.
                    // Se quiser liberar tudo, basta remover a condicional 'isDisabled'.
                    const isDisabled = index > currentStepIndex; 

                    return (
                        <Link
                            key={step}
                            href={isDisabled ? "#" : step}
                            aria-disabled={isDisabled}
                            // Se estiver desabilitado, removemos o clique visualmente
                            className={`flex-1 h-2 bg-gray-200 rounded-full overflow-hidden first:ml-0 last:mr-0 transition-all ${
                                isDisabled 
                                    ? "cursor-default opacity-50" 
                                    : "cursor-pointer hover:brightness-95 hover:scale-[1.01]"
                            }`}
                            // Previne navegação se for passo futuro (opcional, remova onClick se quiser livre)
                            onClick={(e) => {
                                if (isDisabled) e.preventDefault();
                            }}
                        >
                            {/* A barra interna vermelha */}
                            <div
                                className={`h-full bg-brand transition-all duration-700 ease-out ${
                                    isActive ? "w-full" : "w-0"
                                }`}
                            />
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}