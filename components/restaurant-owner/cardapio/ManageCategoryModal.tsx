"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { validateCategorySchedule, type CategorySchedule } from "@/lib/menu/categorySchedule";
import type { Category } from "@/lib/types/types";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import AvailabilityScheduleEditor, { useAvailabilityScheduleEditor } from "./AvailabilityScheduleEditor";

interface ManageCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    restaurantId: string;
    categoryToEdit?: { id: string; name: string; availability_schedule?: CategorySchedule } | null;
}

export default function ManageCategoryModal({
    isOpen,
    onClose,
    onSuccess,
    restaurantId,
    categoryToEdit,
}: ManageCategoryModalProps) {
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const scheduleEditor = useAvailabilityScheduleEditor(categoryToEdit?.availability_schedule);
    const { reset } = scheduleEditor;

    useEffect(() => {
        if (!isOpen) return;
        setName(categoryToEdit?.name || "");
        reset(categoryToEdit?.availability_schedule);
    }, [isOpen, categoryToEdit, reset]);

    const handleSave = async () => {
        if (!name.trim()) return;
        const schedule = scheduleEditor.schedule;
        const errorMessage = validateCategorySchedule(schedule);
        if (errorMessage) {
            scheduleEditor.showError(errorMessage);
            return;
        }

        setIsLoading(true);
        try {
            if (categoryToEdit) {
                const { error } = await supabase
                    .from("categories")
                    .update({ name: name.trim(), availability_schedule: schedule })
                    .eq("id", categoryToEdit.id);
                if (error) throw error;
            } else {
                const { count, error: countError } = await supabase
                    .from("categories")
                    .select("*", { count: "exact", head: true })
                    .eq("restaurant_id", restaurantId);
                if (countError) throw countError;
                const { error } = await supabase
                    .from("categories")
                    .insert({
                        name: name.trim(),
                        restaurant_id: restaurantId,
                        position: (count || 0) + 1,
                        availability_schedule: schedule,
                    });
                if (error) throw error;
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error("Erro ao salvar categoria:", error);
            alert(`Erro ao salvar categoria: ${error.message || "Erro desconhecido"}`);
        } finally {
            setIsLoading(false);
        }
    };

    const executeDelete = async () => {
        if (!categoryToEdit) return;
        setIsLoading(true);
        try {
            const { error } = await supabase.from("categories").delete().eq("id", categoryToEdit.id);
            if (error) throw error;
            onSuccess();
            setIsDeleteModalOpen(false);
            onClose();
        } catch (error) {
            console.error("Erro ao deletar:", error);
            alert("Não foi possível deletar (verifique se há itens vinculados).");
            setIsDeleteModalOpen(false);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Modal height={680} open={isOpen} onClose={onClose}>
                <div className="w-full space-y-5 p-6">
                    <h2 className="text-xl font-semibold text-gray-900">
                        {categoryToEdit ? "Editar categoria" : "Adicionar categoria"}
                    </h2>

                    <Input
                        label="Nome da categoria"
                        placeholder="Ex: Bebidas, Lanches..."
                        value={name}
                        onChange={event => setName(event.target.value)}
                        autoFocus
                    />

                    <AvailabilityScheduleEditor editor={scheduleEditor} subject="da categoria" />

                    <div className="flex flex-wrap justify-end gap-2 pt-2">
                        {categoryToEdit && (
                            <Button variant="secondary" onClick={() => setIsDeleteModalOpen(true)} disabled={isLoading} className="mr-auto text-red-600">
                                Excluir
                            </Button>
                        )}
                        <Button variant="secondary" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                        <Button onClick={handleSave} loading={isLoading} disabled={isLoading || !name.trim()}>Salvar</Button>
                    </div>
                </div>
            </Modal>
            <ConfirmModal
                open={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={executeDelete}
                title="Excluir categoria"
                description={`Tem certeza que deseja excluir "${categoryToEdit?.name}"? Isso pode ocultar os itens que pertencem a ela.`}
                confirmLabel="Excluir categoria"
                isLoading={isLoading}
                variant="danger"
            />
        </>
    );
}
