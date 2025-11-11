// app/restaurante/criar/localizacao/page.tsx
"use client";

/**
 * ======================================================
 * 
 * THIS PAGE IS INCOMPLETE. IT ONLY EXISTS TO HELP THE CREATION OF 'restaurante/criar/tempo-e-taxa'
 * THIS PAGE WILL BE WORKED ON IN THE FUTURE
 * 
 * ===============================================================
 */

import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore"; // 1. Import the store

export default function LocalizacaoPage() {
    const router = useRouter();
    const { setRestaurantId } = useCreationStore(); // 2. Get the 'set' function.

    // ... (your states for 'zip code', 'address', etc.)

    const handleSaveAndContinue = async () => {
        // ... (Logic for retrieving data from the form.)
        
        try {
            // TODO: (this API /api/restaurants/create needs to be created)
            const response = await fetch("/api/restaurants/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cep: "...", address: "..." }),
            });

            if (!response.ok) {
                throw new Error("Falha ao criar restaurante");
            }

            const newRestaurant = await response.json();
            const newId = newRestaurant.id; // Ex: "bf65b4dd-..."

            // 4. Salve o ID no localStorage (via Zustand)
            setRestaurantId(newId);

            // 5. Navegue para a próxima etapa
            router.push("/restaurante/criar/tempo-e-taxa");

        } catch (error) {
            console.error(error);
            alert("Erro ao salvar localização.");
        }
    };

    return (
        <div>
            {/* ... seu formulário de localização ... */}
            <button onClick={handleSaveAndContinue}>Salvar e Continuar</button>
        </div>
    );
}