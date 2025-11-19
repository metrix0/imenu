"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

export default function CardapioPage() {
    const [url, setUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    // TODO: usa o restaurantId real do usuário logado
    const restaurantId = "SEU_RESTAURANT_ID_AQUI";

    async function handleImport() {
        setLoading(true);
        setMsg(null);
        try {
            const res = await fetch("/api/ifood/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ restaurantId, url }),
            });

            const data = await res.json();

            if (!res.ok) {
                setMsg(data.error || "Erro ao importar");
                return;
            }

            setMsg(`Importação concluída. Categorias importadas: ${data.imported}`);
        } catch (e) {
            setMsg("Erro inesperado ao chamar a API");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold mb-4">Cardápio</h1>

            <div className="max-w-xl space-y-3">
                <Input
                    label="URL do restaurante no iFood"
                    placeholder="https://www.ifood.com.br/delivery/..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />

                <Button variant="primary" onClick={handleImport} loading={loading}>
                    Importar do iFood
                </Button>

                {msg && <p className="text-sm text-gray-700 mt-2">{msg}</p>}
            </div>

            {/* Aqui embaixo você pode listar categorias/itens já importados */}
        </div>
    );
}
