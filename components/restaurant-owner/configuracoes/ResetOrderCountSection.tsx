"use client";

import { useState } from "react";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Toast from "@/components/ui/Toast";
import { supabase } from "@/lib/database/supabaseClient";

type Props = {
    restaurantId: string;
};

export default function ResetOrderCountSection({ restaurantId }: Props) {
    const [modalOpen, setModalOpen] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error";
    } | null>(null);

    const resetOrderCount = async () => {
        if (isResetting) return;

        setIsResetting(true);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                throw new Error("Sessão inválida ou expirada.");
            }

            const response = await fetch(
                `/api/restaurants/${restaurantId}/reset-order-count`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                },
            );
            const data = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(
                    data?.error || "Erro ao reiniciar a numeração dos pedidos.",
                );
            }

            setModalOpen(false);
            setToast({
                message: "Numeração reiniciada. O próximo pedido será #1.",
                type: "success",
            });
        } catch (error) {
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Erro ao reiniciar a numeração dos pedidos.",
                type: "error",
            });
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <>
            <ConfirmModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onConfirm={resetOrderCount}
                title="Reiniciar numeração dos pedidos?"
                description="Os pedidos existentes não serão apagados. O próximo pedido será #1."
                confirmLabel="Reiniciar numeração"
                isLoading={isResetting}
                variant="danger"
            />

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <Card className="border border-gray-200 shadow-sm">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div>
                        <h2 className="mb-2 text-xl font-medium text-gray-900">
                            Reiniciar numeração dos pedidos
                        </h2>
                        <p className="text-sm text-gray-500">
                            Reinicie a numeração exibida nos pedidos. O próximo pedido será #1.
                        </p>
                    </div>
                    <Button
                        variant="secondary"
                        className="w-full bg-white md:w-auto"
                        onClick={() => setModalOpen(true)}
                    >
                        Reiniciar numeração
                    </Button>
                </div>
            </Card>
        </>
    );
}
