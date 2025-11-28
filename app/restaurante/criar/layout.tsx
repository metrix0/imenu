// app/restaurante/criar/layout.tsx
"use client"; // 👈 Necessário para usar usePathname

import CreationStepper from "@/components/restaurante/configuracoes/CreationStepper";
import Image from "next/image";
import { usePathname } from "next/navigation"; // 👈 Importar o hook

export default function CreationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    
    // Verifica se a rota atual contém "/info/otp"
    const isOtpPage = pathname?.includes("/info/otp");

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header stays visible */}
            <header className="w-full border-b border-gray-200 px-2 py-7 flex items-center justify-between top-0 bg-white z-10">
                <div className="relative h-6 w-32 ml-4">
                    <Image
                        src="/logo-full.png"
                        alt="iMenu Logo"
                        fill
                        className="object-contain object-left"
                    />
                </div>
            </header>
            
            {/* Só renderiza o Stepper se NÃO for a página de OTP.
               Isso mantém o layout limpo para o usuário focar no código.
            */}
            {!isOtpPage && <CreationStepper />}
            
            <div className="flex-1">
                {children}
            </div>
        </div>
    );
}