"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";

import ApplicationSetup from "./ApplicationSetup";

export default function ApplicationPanelContent() {
    return (
        <>
            <div className="mb-7">
                <h1 className="text-2xl font-bold text-gray-900">Aplicativo</h1>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                    Tenha o painel do iMenu sempre à mão com
                    <FontAwesomeIcon
                        icon={faBell}
                        className="mx-1.5 text-brand"
                        aria-hidden="true"
                    />
                    notificações ao vivo!
                </p>
            </div>

            <ApplicationSetup />
        </>
    );
}
