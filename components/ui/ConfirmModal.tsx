"use client";

import { Children, isValidElement, useEffect, useState, type ReactNode } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faClock, faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";

interface ConfirmModalProps {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description?: ReactNode;
    descriptionAfter?: ReactNode;
    confirmLabel?: string;
    confirmationText?: string;
    cancelLabel?: string;
    isLoading?: boolean;
    extraAction?: { label: string; onClick: () => void; tone?: "success" };
    confirmTone?: "success" | "danger";
    inlineActions?: boolean;
    variant?: "danger" | "primary" | "neutral";
}

export default function ConfirmModal({
    open,
    onClose,
    onConfirm,
    title,
    description,
    descriptionAfter,
    confirmLabel = "Confirmar",
    confirmationText,
    cancelLabel = "Cancelar",
    isLoading = false,
    extraAction,
    confirmTone,
    inlineActions = false,
    variant = "danger"
}: ConfirmModalProps) {
    const [typedConfirmation, setTypedConfirmation] = useState("");
    const requiresConfirmation = confirmationText !== undefined;

    useEffect(() => {
        if (!open) setTypedConfirmation("");
    }, [open]);

    const descriptionLength = typeof description === "string" ? description.trim().length : 0;
    const actionTone = confirmTone ?? variant;
    const actionButtonClass = inlineActions
        ? "min-w-0 break-words px-2 text-center sm:px-[14px]"
        : "w-full sm:w-auto";
    const badgeStyle = {
        danger: "bg-red-100 text-red-600",
        primary: "bg-orange-100 text-brand",
        neutral: "bg-gray-100 text-gray-600",
    }[variant];
    const successButtonClass = "border-green-700 bg-green-700 hover:border-green-800 hover:bg-green-800 focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-green-700";
    const descriptionAfterParts = descriptionAfter
        ? isValidElement<{ children?: ReactNode }>(descriptionAfter)
            ? Children.toArray(descriptionAfter.props.children)
            : [descriptionAfter]
        : [];
    const baseHeight = extraAction ? (typeof description === "string" ? 380 : 430) : descriptionAfter
        ? 370
        : !description
          ? 260
          : descriptionLength > 120
            ? 350
            : descriptionLength > 70
              ? 330
              : 310;
    const height = baseHeight + (requiresConfirmation ? 104 : 0);
    const close = () => {
        if (!requiresConfirmation || !isLoading) onClose();
    };

    return (
        <Modal height={height} open={open} onClose={close} className={inlineActions ? "max-w-lg" : "max-w-md 2xl:max-w-lg"}>
            <div className="p-4 sm:p-6 2xl:p-7 text-center">
                <div className={`mx-auto mb-4 flex h-12 w-12 2xl:h-16 2xl:w-16 items-center justify-center rounded-full ${badgeStyle}`}>
                    <FontAwesomeIcon icon={variant === "neutral" ? faClock : faExclamationTriangle} className="text-xl 2xl:text-2xl" />
                </div>

                <h3 className="mb-2 text-lg font-bold text-gray-900 2xl:text-xl">{title}</h3>

                {description && (
                    <p className={`${descriptionAfterParts.length > 0 ? "mb-3" : "mb-6"} text-sm text-gray-500 2xl:text-lg`}>
                        {description}
                    </p>
                )}

                {descriptionAfterParts.length > 0 && (
                    <p className="mb-6 text-sm text-gray-500 2xl:text-lg">
                        {descriptionAfterParts.map((part, index) => (
                            <span key={index}>
                                {index > 0 ? " " : null}
                                {index === descriptionAfterParts.length - 1 ? (
                                    <strong className="font-bold">{part}</strong>
                                ) : (
                                    part
                                )}
                            </span>
                        ))}
                    </p>
                )}

                {requiresConfirmation && (
                    <div className="mb-5 text-left">
                        <Input
                            label={`Digite “${confirmationText}” para confirmar`}
                            value={typedConfirmation}
                            onChange={(event) => setTypedConfirmation(event.target.value)}
                            autoComplete="off"
                            autoCorrect="off"
                            spellCheck={false}
                            disabled={isLoading}
                        />
                    </div>
                )}

                <div className={inlineActions
                    ? "flex flex-nowrap justify-center gap-2 sm:gap-3"
                    : `flex flex-col sm:flex-row justify-center gap-3 ${extraAction ? "sm:flex-wrap" : ""}`}>
                    <Button 
                        variant="secondary" 
                        onClick={onClose} 
                        disabled={isLoading}
                        className={actionButtonClass}
                    >
                        {cancelLabel}
                    </Button>

                    <Button 
                        variant={actionTone === "success" || actionTone === "primary" ? "primary" : "secondary"}
                        onClick={onConfirm}
                        disabled={requiresConfirmation && typedConfirmation !== confirmationText}
                        loading={isLoading}
                        className={`${actionButtonClass} ${actionTone === "success" ? successButtonClass : actionTone === "danger" ? "bg-red-600 text-white hover:bg-red-700 border-transparent" : ""}`}
                    >
                        {confirmLabel}
                    </Button>
                    {extraAction && (
                        <Button
                            variant={extraAction.tone === "success" ? "primary" : "secondary"}
                            onClick={extraAction.onClick}
                            disabled={isLoading}
                            className={`${actionButtonClass} ${extraAction.tone === "success" ? successButtonClass : ""}`}
                        >
                            {extraAction.label}
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}

