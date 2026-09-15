"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { usePanelAppearance } from "./PanelAppearance";

export function LegacyModalClose({ children }: { children: ReactNode }) {
    return usePanelAppearance() ? null : children;
}

export default function ModalCloseButton({ onClose }: { onClose: () => void }) {
    return <button type="button" data-ui="modal-close" aria-label="Fechar modal" onClick={onClose} className="absolute right-4 top-4 z-40 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-white text-[#626973] transition-colors hover:bg-[#f1f3f5] hover:text-[#1d1d1d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d93d00] focus-visible:ring-offset-2 max-md:right-3 max-md:top-3 max-md:h-10 max-md:w-10">
        <X size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>;
}
