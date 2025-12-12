// app/restaurante/criar/layout.tsx
"use client"; // 👈 Necessário para usar usePathname

import CreationStepper from "@/components/restaurant-owner/configuracoes/CreationStepper";
import Loader from "@/components/ui/Loader";
import { supabase } from "@/lib/database/supabaseClient";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation"; // 👈 Importar o hook
import { useEffect, useState } from "react";

export default function CreationLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    
    // Verifica se a rota atual contém "/info/otp"
    const isOtpPage = pathname?.includes("/info/otp");

    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkStatus = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            
            // 1. Se não tiver sessão, manda pro login
            if (!session) {
                router.replace("/restaurante/login");
                return;
            }

            // 2. Verifica o status do restaurante
            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("first_time")
                .eq("user_id", session.user.id)
                .maybeSingle();

            // 3. Se o restaurante já finalizou o cadastro (first_time === false),
            // ele não deve estar aqui. Manda pro painel.
            if (restaurant && restaurant.first_time === false) {
                router.replace("/painel");
                return;
            }

            // Se chegou aqui, é first_time = true (ou null), então pode continuar criando.
            setIsLoading(false);
        };

        checkStatus();
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader />
                <p className="ml-3 text-gray-500">Verificando acesso...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col">
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white text-black px-6 text-center overflow-hidden md:hidden">
                <p className="text-lg font-normal leading-relaxed">
                    O painel de administrador ainda não pode ser utilizado em celulares. <br /> <br />
                    Continue em um computador ou notebook.
                </p>
            </div>
            {/* Header stays visible */}
            <header className="w-full px-2 py-7 2xl:px-4 2xl:py-10 flex items-center justify-between top-0 bg-white z-10">
                <div className="relative h-6 w-32 2xl:w-60 2xl:h-8 ml-4">
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
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