"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { usePanelAppearance } from "./PanelAppearance";

export function LegacyModalClose({ children }: { children: ReactNode }) {
    return usePanelAppearance() ? null : children;
}

export default function ModalCloseButton({ onClose }: { onClose: () => void }) {
    return <button type="button" data-ui="modal-close" aria-label="Fechar modal" onClick={onClose}>
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>;
}
