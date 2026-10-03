"use client";

import { useEffect, useState } from "react";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";

import { AUTO_POPUP_PRIORITY, useAutoPopup } from "@/components/common/AutoPopupProvider";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

const SHOWN_KEY = "imenu:pix-online-back-shown:v1";
const START_DATE = "2026-09-30";
const END_DATE = "2026-10-04";

function saoPauloDateKey(): string {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value || "";
    return `${value("year")}-${value("month")}-${value("day")}`;
}

export default function PixOnlineTemporaryNotice() {
    const [eligible, setEligible] = useState(false);

    useEffect(() => {
        const today = saoPauloDateKey();
        if (today < START_DATE || today > END_DATE) return;

        try {
            if (window.localStorage.getItem(SHOWN_KEY) === "true") return;
        } catch {
            // Show normally when storage is unavailable.
        }

        setEligible(true);
    }, []);

    const popup = useAutoPopup({
        id: "pix-online-back",
        priority: AUTO_POPUP_PRIORITY.onboarding - 1,
        enabled: eligible,
        bypassSessionLimit: true,
    });

    useEffect(() => {
        if (!popup.open) return;
        try {
            window.localStorage.setItem(SHOWN_KEY, "true");
        } catch {
            // Current display still works without persistence.
        }
    }, [popup.open]);

    const close = () => {
        popup.dismiss();
        setEligible(false);
    };

    return (
        <Modal
            height={450}
            open={popup.open}
            onClose={close}
            className="max-w-md"
        >
            <div className="p-6 text-center sm:p-7">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-700">
                    <FontAwesomeIcon
                        icon={faCircleCheck}
                        className="text-2xl"
                    />
                </div>

                <h2 className="mt-4 !pr-0 text-xl font-bold text-gray-900">
                    O Pix Online está de volta!
                </h2>

                <p className="mt-3 text-sm leading-6 text-gray-600">
                    Seus clientes já podem pagar normalmente pelo Pix Online, com confirmação automática do pagamento.
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                    Para mantermos nossa taxa baixa de 1%, temporariamente o nome exibido no Pix será João Vitor. Essa é uma medida temporária enquanto concluímos os ajustes do Pix Online.
                </p>

                <Button
                    type="button"
                    className="mt-6 w-full"
                    onClick={close}
                >
                    Entendi
                </Button>
            </div>
        </Modal>
    );
}
