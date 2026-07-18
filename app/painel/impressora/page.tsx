"use client";

import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faDownload,
    faPrint,
    faCircleCheck,
} from "@fortawesome/free-solid-svg-icons";

export default function ImpressoraPage() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-6xl mx-auto px-8 py-10">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
                            <FontAwesomeIcon icon={faPrint} className="text-xl" />
                        </div>

                        <div>
                            <h1 className="text-3xl font-extrabold text-brand leading-tight">
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
                        <div className="p-8 lg:p-10 flex flex-col justify-center">
                            <h2 className="text-2xl font-extrabold text-gray-900 mb-4">
                                Baixe o aplicativo de impressão
                            </h2>

                            <p className="text-gray-500 leading-relaxed mb-6">
                                Instale o programa no computador conectado à impressora do restaurante.
                                Depois, faça login, selecione a impressora e os pedidos começarão a ser
                                impressos automaticamente.
                            </p>

                            <div className="space-y-3 mb-8">
                                <div className="flex items-center gap-3 text-gray-700">
                                    <FontAwesomeIcon icon={faCircleCheck} className="text-brand" />
                                    <span>Funciona com impressoras Bluetooth, USB e rede/Wi-Fi.</span>
                                </div>

                                <div className="flex items-center gap-3 text-gray-700">
                                    <FontAwesomeIcon icon={faCircleCheck} className="text-brand" />
                                    <span>Configuração salva automaticamente.</span>
                                </div>

                                <div className="flex items-center gap-3 text-gray-700">
                                    <FontAwesomeIcon icon={faCircleCheck} className="text-brand" />
                                    <span>Impressão automática dos novos pedidos.</span>
                                </div>
                            </div>

                            <a
                                href="/downloads/iMenu%20Impressora%20Setup%201.0.5.exe"
                                download
                                className="inline-flex w-fit items-center gap-2 bg-brand text-white px-6 py-3 rounded-xl font-semibold hover:bg-brand/90 transition"
                            >
                                <FontAwesomeIcon icon={faDownload} />
                                Baixar iMenu Impressora
                            </a>

                            <p className="text-xs text-gray-400 mt-4">
                                Compatível com Windows.
                            </p>
                        </div>

                        {/* Right */}
                        <div className="bg-gray-50 border-l border-gray-a100 p-8 lg:p-10 flex items-center justify-center">
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
                <div className="mt-6 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
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