"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

interface ConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    variant?: "danger" | "primary"; // Para mudar a cor do botão se for algo destrutivo
}

export default function ConfirmModal({
    open,
    onClose,
    onConfirm,
    title,
    description,
    confirmLabel = "Confirmar",
    cancelLabel = "Cancelar",
    isLoading = false,
    variant = "danger"
}: ConfirmModalProps) {
    
    return (
        <Modal open={open} onClose={onClose} className="max-w-md">
            <div className="p-6 text-center">
                <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${variant === 'danger' ? 'bg-red-100' : 'bg-blue-100'}`}>
                    <FontAwesomeIcon 
                        icon={faExclamationTriangle} 
                        className={`text-xl ${variant === 'danger' ? 'text-red-600' : 'text-brand'}`} 
                    />
                </div>
                
                <h3 className="mb-2 text-lg font-bold text-gray-900">{title}</h3>
                
                {description && (
                    <p className="mb-6 text-sm text-gray-500">{description}</p>
                )}

                <div className="flex justify-center gap-3">
                    <Button 
                        variant="secondary" 
                        onClick={onClose} 
                        disabled={isLoading}
                        className="w-full sm:w-auto"
                    >
                        {cancelLabel}
                    </Button>
                    
                    <Button 
                        // Assumindo que seu componente Button aceita estilos customizados ou variants
                        // Se seu Button não tiver variant="danger", usamos className
                        variant={variant === 'danger' ? "secondary" : "primary"} 
                        onClick={onConfirm}
                        loading={isLoading}
                        className={`w-full sm:w-auto ${variant === 'danger' ? 'bg-red-600 text-white hover:bg-red-700 border-transparent' : ''}`}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}