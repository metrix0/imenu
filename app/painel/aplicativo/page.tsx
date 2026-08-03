"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMobileScreenButton } from "@fortawesome/free-solid-svg-icons";

import ApplicationSetup from "@/components/pwa/ApplicationSetup";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export default function AplicativoPage() {
    const [isMobileViewport, setIsMobileViewport] = useState<boolean | null>(
        null
    );

    useEffect(() => {
        const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
        const updateViewport = () => setIsMobileViewport(mediaQuery.matches);

        updateViewport();
        mediaQuery.addEventListener("change", updateViewport);

        return () => {
            mediaQuery.removeEventListener("change", updateViewport);
        };
    }, []);

    if (isMobileViewport === null) {
        return (
            <div className="flex min-h-[50vh] items-center justify-center p-6">
                <Loader />
            </div>
        );
    }

    if (!isMobileViewport) {
        return (
            <div className="p-6 md:p-0">
                <Card className="mx-auto mt-12 max-w-xl text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
                        <FontAwesomeIcon
                            icon={faMobileScreenButton}
                            className="text-3xl"
                        />
                    </div>
                    <h1 className="mt-5 text-2xl font-bold text-gray-900 2xl:text-3xl">
                        Disponível apenas no celular
                    </h1>
                    <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-gray-600 2xl:text-base">
                        Abra o painel do iMenu pelo celular para adicionar o
                        aplicativo à tela inicial e ativar as notificações de
                        novos pedidos.
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-4 pb-24 sm:p-6">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                    Aplicativo
                </h1>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                    Adicione o iMenu à tela inicial e ative os avisos para receber
                    novos pedidos em tempo real, mesmo com o aplicativo fechado.
                </p>
            </div>

            <ApplicationSetup />
        </div>
    );
}
