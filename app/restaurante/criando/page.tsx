// app/restaurante/criando/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CriandoPage() {
    const router = useRouter();

  
    useEffect(() => {
        const timer = setTimeout(() => {
            router.push('/setup/perfil');
        }, 2500); 

        return () => clearTimeout(timer); 
    }, [router]);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <div className="w-full max-w-lg space-y-4">
                {/* Loading icon */}
                <svg 
                    className="mx-auto h-12 w-12 animate-spin text-black" 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24"
                >
                    <circle 
                        className="opacity-25" 
                        cx="12" 
                        cy="12" 
                        r="10" 
                        stroke="currentColor" 
                        strokeWidth="4"
                    ></circle>
                    <path 
                        className="opacity-75" 
                        fill="currentColor" 
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                </svg>
                
                <h1 className="text-3xl font-bold text-gray-900">
                    Preparando seu ambiente
                </h1>
                <p className="text-lg text-gray-600">
                    Estamos quase lá. Você será redirecionado em instantes...
                </p>
            </div>
        </div>
    );
}

