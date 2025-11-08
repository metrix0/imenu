// app/restaurante/[restaurantId]/add-menu/AddMenuClient.tsx
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AddMenuClient({
    restaurantId,
    restauranteId,
}: {
    restaurantId?: string;
    restauranteId?: string;
}) {
    const router = useRouter();

    // determina o id do restaurante de forma resiliente:
    // 1) prop restaurantId
    // 2) prop restauranteId (português)
    // 3) tentativa de extrair do pathname (fallback)
    const resolveRestaurantId = () => {
        if (restaurantId) return restaurantId;
        if (restauranteId) return restauranteId;
        if (typeof window !== "undefined") {
            const m = window.location.pathname.match(/\/restaurante\/([^\/]+)\/add-menu/);
            if (m) return m[1];
        }
        return null;
    };

    const resolvedRestaurantId = resolveRestaurantId();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e?: React.FormEvent) {
        e?.preventDefault();
        setError(null);

        if (!name.trim()) {
            setError("O nome do cardápio é obrigatório.");
            return;
        }

        if (!resolvedRestaurantId) {
            setError("ID do restaurante não encontrado na URL. Verifique se você acessou /restaurante/[restauranteId]/add-menu");
            return;
        }

        setSaving(true);
        try {
            const { data, error } = await supabase
                .from("menu")
                .insert([
                    {
                        restaurant_id: resolvedRestaurantId,
                        name: name.trim(),
                        description: description.trim() || null,
                        is_active: isActive,
                    },
                ])
                .select()
                .single();

            if (error) {
                console.error("Erro criando cardápio:", error);
                setError("Erro ao criar cardápio. Veja o console.");
                return;
            }

            // ✅ redireciona para a página do cardápio recém-criado
            // data.id contém o id do cardápio inserido
            router.push(`/menu/${data.id}`);
        } catch (err) {
            console.error("Erro inesperado:", err);
            setError(String(err));
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
            <div className="w-full max-w-lg bg-white p-6 rounded shadow">
                <h1 className="text-2xl font-semibold mb-4">Criar Novo Cardápio</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">Nome do Cardápio</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="mt-1 w-full border rounded px-3 py-2"
                            placeholder="Ex: Cardápio Principal"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium">Descrição (opcional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="mt-1 w-full border rounded px-3 py-2"
                            rows={3}
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={isActive}
                                onChange={(e) => setIsActive(e.target.checked)}
                            />
                            <span className="text-sm">Cardápio ativo</span>
                        </label>
                    </div>

                    {error && <div className="text-red-600 text-sm">{error}</div>}

                    <div className="flex gap-3">
                        <button
                            type="submit"
                            disabled={saving}
                            className="bg-indigo-600 text-white px-4 py-2 rounded"
                        >
                            {saving ? "Criando..." : "Criar Cardápio"}
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                router.push(`/restaurante/${resolvedRestaurantId ?? ""}/configuracoes`)
                            }
                            className="bg-gray-200 px-4 py-2 rounded"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
