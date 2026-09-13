"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faDownload,
    faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";

type PrinterRelease = {
    version: string;
    updatedAt: string;
    downloadUrl: string;
};

const LEGACY_PRINTER_RELEASE: PrinterRelease = {
    version: "1.1.5 Legacy",
    updatedAt: "2026-09-11T21:49:25Z",
    downloadUrl: "/downloads/iMenu%20Impressora%20Legacy%20Setup%201.1.5.exe",
};

function isLegacyWindows() {
    return /Windows NT (6\.1|6\.2|6\.3)/.test(navigator.userAgent);
}

function formatUpdatedAt(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
    }).format(date);
}

export default function ImpressoraPage() {
    const [release, setRelease] = useState<PrinterRelease | null>(null);
    const [useLegacyRelease, setUseLegacyRelease] = useState(false);

    useEffect(() => {
        setUseLegacyRelease(isLegacyWindows());

        fetch("/downloads/imenu-printer.json", { cache: "no-store" })
            .then((response) => {
                if (!response.ok) {
                    throw new Error("Falha ao carregar versão da impressora");
                }

                return response.json();
            })
            .then((data: PrinterRelease) => {
                if (data.version && data.updatedAt && data.downloadUrl) {
                    setRelease(data);
                }
            })
            .catch(() => {});
    }, []);

    const selectedRelease = useLegacyRelease ? LEGACY_PRINTER_RELEASE : release;

    return (
        <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
            <div>
                {/* Header */}
                <div className="mb-8">
                    <div>
                        <div>
                            <h1 className="text-3xl font-medium text-gray-900">
                                iMenu Impressora
                            </h1>
                            <p className="text-gray-500 mt-1">
                                Imprima os pedidos automaticamente na cozinha.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                        {/* Left */}
                        <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-900 mb-4">
                                Baixe o aplicativo de impressão
                            </h2>

                            <p className="text-gray-500 leading-relaxed mb-6">
                                Instale o programa no computador conectado à impressora do restaurante.
                                Depois, faça login, selecione a impressora e os pedidos começarão a ser
                                impressos automaticamente.
                            </p>

                            <div className="space-y-3 mb-8">
                                <div className="flex items-start gap-3 text-gray-700">
                                    <FontAwesomeIcon icon={faCircleCheck} className="text-brand mt-1 shrink-0" />
                                    <span>Funciona com impressoras Bluetooth, USB e rede/Wi-Fi.</span>
                                </div>

                                <div className="flex items-start gap-3 text-gray-700">
                                    <FontAwesomeIcon icon={faCircleCheck} className="text-brand mt-1 shrink-0" />
                                    <span>Computador e Laptop.</span>
                                </div>

                                <div className="flex items-start gap-3 text-gray-700">
                                    <FontAwesomeIcon icon={faCircleCheck} className="text-brand mt-1 shrink-0" />
                                    <span>Impressão automática dos novos pedidos.</span>
                                </div>
                            </div>

                            <a
                                data-ui="button" data-variant="primary"
                                href={selectedRelease?.downloadUrl}
                                download
                                className={`inline-flex w-full sm:w-fit items-center justify-center gap-2 bg-brand text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand/90 transition ${
                                    selectedRelease ? "" : "pointer-events-none"
                                }`}
                            >
                                <FontAwesomeIcon icon={faDownload} />
                                Baixar iMenu Impressora
                            </a>

                            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                                <div className="flex flex-wrap gap-x-5 gap-y-1">
                                    <span>
                                        <span className="font-semibold text-gray-800">Versão:</span>{" "}
                                        {selectedRelease?.version || ""}
                                    </span>
                                    <span>
                                        <span className="font-semibold text-gray-800">Atualizado em:</span>{" "}
                                        {selectedRelease ? formatUpdatedAt(selectedRelease.updatedAt) : ""}
                                    </span>
                                </div>
                            </div>

                            <p className="text-xs text-gray-400 mt-4">
                                {useLegacyRelease
                                    ? "Compatível com Windows 7, 8 e 8.1."
                                    : "Compatível com Windows 10 e 11."}
                            </p>
                            {!useLegacyRelease && (
                                <a
                                    href={LEGACY_PRINTER_RELEASE.downloadUrl}
                                    download
                                    className="mt-2 w-fit text-xs font-medium text-brand hover:underline"
                                >
                                    Windows 7, 8 ou 8.1? Baixar versão compatível
                                </a>
                            )}
                        </div>

                        {/* Right */}
                        <div className="bg-gray-50 border-t lg:border-t-0 lg:border-l border-gray-100 p-5 sm:p-8 lg:p-10 flex items-center justify-center">
                            <div className="relative w-full max-w-md aspect-[4/3] rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                                <Image
                                    src="/images/printerpreview.png"
                                    alt="Prévia do sistema iMenu Impressora"
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Small instructions */}
                <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
                    <h3 className="font-bold text-gray-900 mb-3">
                        Como usar
                    </h3>

                    <ol className="list-decimal list-inside text-gray-600 space-y-2">
                        <li>Baixe e instale o aplicativo no computador do restaurante.</li>
                        <li>Abra o iMenu Impressora e entre com o login do restaurante.</li>
                        <li>Clique em detectar impressoras e escolha a impressora correta.</li>
                        <li>Faça um teste de impressão.</li>
                    </ol>
                </div>
            </div>
        </div>
    );
}
