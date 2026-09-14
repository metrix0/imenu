"use client";

import Button from "@/components/ui/Button";

type PanelShortcutPromptProps = {
    open: boolean;
    onAccept: () => void;
    onDismiss: () => void;
    className?: string;
};

export default function PanelShortcutPrompt({
    open,
    onAccept,
    onDismiss,
    className = "",
}: PanelShortcutPromptProps) {
    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-label="Acesso rápido ao painel"
            className={`absolute top-[calc(100%+8px)] z-[70] w-[280px] rounded-[10px] border border-[#e2e5e9] bg-white p-4 text-left shadow-[0_12px_30px_rgba(29,29,29,0.12)] ${className}`}
        >
            <p className="text-[13px] leading-5 font-semibold text-[#1d1d1d]">
                Ir direto para o painel?
            </p>
            <p className="mt-1 text-[13px] leading-5 text-[#51565e]">
                Você costuma entrar direto no painel. Quer pular esta página nas próximas visitas?
            </p>

            <div className="mt-3 flex gap-2">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onDismiss}
                    className="!min-h-9 flex-1 !rounded-lg !border !border-[#e2e5e9] !bg-white !px-3 !py-2 !text-xs !font-medium !text-[#1d1d1d] !shadow-none hover:!bg-[#f1f3f5] focus:!ring-[#d93d00]"
                >
                    Agora não
                </Button>
                <Button
                    type="button"
                    onClick={onAccept}
                    className="!min-h-9 flex-1 !rounded-lg !border !border-[#d93d00] !bg-[#d93d00] !px-3 !py-2 !text-xs !font-medium !text-white !shadow-none hover:!border-[#c43700] hover:!bg-[#c43700] focus:!ring-[#d93d00]"
                >
                    Ir direto
                </Button>
            </div>
        </div>
    );
}
