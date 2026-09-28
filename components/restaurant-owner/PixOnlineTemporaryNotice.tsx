"use client";

import { faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";

import { useAutoPopup } from "@/components/common/AutoPopupProvider";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export default function PixOnlineTemporaryNotice() {
    const popup = useAutoPopup({
        id: "pix-online-temporarily-disabled",
        priority: 1000,
        enabled: true,
        bypassSessionLimit: true,
    });

    return (
        <Modal
            height={330}
            open={popup.open}
            onClose={popup.dismiss}
            className="max-w-md"
        >
            <div className="p-6 text-center sm:p-7">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                    <FontAwesomeIcon
                        icon={faTriangleExclamation}
                        className="text-2xl"
                    />
                </div>

                <h2 className="mt-4 !pr-0 text-xl font-bold text-gray-900">
                    COMUNICADO IMPORTANTE
                </h2>

                <p className="mt-3 text-sm leading-6 text-gray-600">
                    Sabemos o quanto o Pix Online é importante para sua operação e entendemos o impacto desta interrupção. Pedimos desculpas pelo transtorno. O Pix Online está temporariamente desativado para todos os usuários. Estamos trabalhando para resolver a situação de imediato.
                </p>

                <Button
                    type="button"
                    className="mt-6 w-full"
                    onClick={popup.dismiss}
                >
                    Entendi
                </Button>
            </div>
        </Modal>
    );
}
