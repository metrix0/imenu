"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Popup from "@/components/ui/Popup"; // Certifique-se que este path existe
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";

interface ManageCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    restaurantId: string;
    categoryToEdit?: { id: string; name: string } | null; // Se null, é criação
}

export default function ManageCategoryModal({ 
    isOpen, 
    onClose, 
    onSuccess, 
    restaurantId, 
    categoryToEdit 
}: ManageCategoryModalProps) {
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Reseta o form ao abrir/fechar ou mudar modo
    useEffect(() => {
        if (isOpen) {
            setName(categoryToEdit?.name || "");
        }
    }, [isOpen, categoryToEdit]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setIsLoading(true);

        try {
            if (categoryToEdit) {
                // EDITAR
                const { error } = await supabase
                    .from("categories")
                    .update({ name })
                    .eq("id", categoryToEdit.id);
                if (error) throw error;
            } else {
                // CRIAR (Busca a última posição para colocar no fim)
                // Nota: Idealmente faríamos isso no backend, mas aqui funciona para MVP
                const { count } = await supabase
                    .from("categories")
                    .select("*", { count: 'exact', head: true })
                    .eq("restaurant_id", restaurantId);
                
                const { error } = await supabase
                    .from("categories")
                    .insert({
                        name,
                        restaurant_id: restaurantId,
                        position: (count || 0) + 1
                    });
                if (error) throw error;
            }

            onSuccess(); // Recarrega a página pai
            onClose();
        } catch (error) {
            console.error("Erro ao salvar categoria:", error);
            alert("Erro ao salvar categoria.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!categoryToEdit) return;
        if (!confirm("Tem certeza? Isso pode ocultar os itens desta categoria.")) return;

        setIsLoading(true);
        try {
            const { error } = await supabase
                .from("categories")
                .delete()
                .eq("id", categoryToEdit.id);
            
            if (error) throw error;
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Erro ao deletar:", error);
            alert("Não foi possível deletar (verifique se há itens vinculados).");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Popup open={isOpen} onClose={onClose}>
            <div className="p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4 text-gray-900">
                    {categoryToEdit ? "Editar Categoria" : "Nova Categoria"}
                </h2>
                
                <div className="space-y-6">
                    <Input
                        label="Nome da Categoria"
                        placeholder="Ex: Bebidas, Lanches..."
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoFocus
                    />

                    <div className="flex justify-end gap-2 pt-2">
                        {categoryToEdit && (
                            <Button 
                                variant="secondary" 
                                onClick={handleDelete}
                                disabled={isLoading}
                                className="text-red-600 hover:bg-red-50 border-red-200 mr-auto"
                            >
                                Excluir
                            </Button>
                        )}

                        <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                            Cancelar
                        </Button>
                        <Button variant="primary" onClick={handleSave} loading={isLoading}>
                            Salvar
                        </Button>
                    </div>
                </div>
            </div>
        </Popup>
    );
}