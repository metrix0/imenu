"use client";

import { useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faDownload,
    faEye,
    faPalette,
    faQrcode,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import { Notice, ToolPanel } from "@/components/common/restaurant-tools/ToolUi";

function cleanColor(value: string): string {
    return value.replace("#", "");
}

function qrUrl(value: string, size: number, foreground: string, background: string, format: "png" | "svg") {
    const params = new URLSearchParams({
        size: `${size}x${size}`,
        data: value,
        color: cleanColor(foreground),
        bgcolor: cleanColor(background),
        margin: "20",
        ecc: "H",
        format,
    });
    return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

function ColorField({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <label className="flex flex-col gap-1 text-xs font-medium 2xl:text-base">
            {label}
            <span className="relative h-[50px]">
                <input
                    type="color"
                    value={value}
                    aria-label={label}
                    onChange={(event) => onChange(event.target.value)}
                    className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />
                <span className="flex h-full items-center gap-3 rounded-md border border-gray-300 bg-white px-3 peer-focus-visible:border-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/30">
                    <span
                        aria-hidden="true"
                        className="h-7 w-7 shrink-0 rounded-md border border-black/10 shadow-inner"
                        style={{ backgroundColor: value }}
                    />
                    <span className="min-w-0 flex-1 font-mono text-xs uppercase text-gray-700">
                        {value}
                    </span>
                    <FontAwesomeIcon icon={faPalette} className="h-4 w-4 text-gray-400" />
                </span>
            </span>
        </label>
    );
}

export default function QrCodeTool() {
    const [content, setContent] = useState("https://www.imenuapp.com.br");
    const [generatedContent, setGeneratedContent] = useState("https://www.imenuapp.com.br");
    const [size, setSize] = useState(600);
    const [foreground, setForeground] = useState("#111111");
    const [background, setBackground] = useState("#ffffff");
    const [message, setMessage] = useState("");

    const previewUrl = useMemo(
        () => qrUrl(generatedContent, size, foreground, background, "png"),
        [background, foreground, generatedContent, size]
    );

    const generate = () => {
        const normalized = content.trim();
        if (!normalized) {
            setMessage("Informe um link ou texto para gerar o QR Code.");
            return;
        }
        setGeneratedContent(normalized);
        setMessage("");
    };

    const download = async (format: "png" | "svg") => {
        try {
            setMessage("Preparando o arquivo…");
            const response = await fetch(
                qrUrl(generatedContent, size, foreground, background, format)
            );
            if (!response.ok) throw new Error("download");
            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = `qrcode-cardapio.${format}`;
            link.click();
            URL.revokeObjectURL(objectUrl);
            setMessage(`QR Code em ${format.toUpperCase()} baixado.`);
        } catch {
            setMessage("Não foi possível baixar agora. Tente novamente em alguns instantes.");
        }
    };

    return (
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <ToolPanel title="Configure seu QR Code" icon={faQrcode}>
                <div className="space-y-4">
                    <Input
                        label="Link do cardápio"
                        value={content}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder="https://seucardapio.com.br"
                    />
                    <div className="grid gap-4 sm:grid-cols-3">
                        <Dropdown
                            label="Tamanho"
                            value={size}
                            onChange={(event) => setSize(Number(event.target.value))}
                            options={[
                                { value: 300, label: "300 px" },
                                { value: 600, label: "600 px" },
                                { value: 1000, label: "1000 px" },
                            ]}
                        />
                        <ColorField label="Cor do código" value={foreground} onChange={setForeground} />
                        <ColorField label="Cor do fundo" value={background} onChange={setBackground} />
                    </div>
                    <Button type="button" onClick={generate} className="w-full sm:w-auto">
                        <FontAwesomeIcon icon={faQrcode} className="mr-2 h-4 w-4" />
                        Gerar QR Code
                    </Button>
                </div>
                <Notice>
                    Para leitura confiável, use uma cor escura sobre fundo claro. Gere novamente depois de alterar o texto ou link.
                </Notice>
            </ToolPanel>

            <ToolPanel title="Visualizar e baixar" icon={faEye}>
                <div className="flex flex-col items-center">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <img
                            src={previewUrl}
                            alt="QR Code gerado para o cardápio"
                            width={280}
                            height={280}
                            className="h-auto w-full max-w-[280px]"
                        />
                    </div>
                    <div className="mt-5 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
                        <Button type="button" variant="secondary" onClick={() => void download("png")}>
                            <FontAwesomeIcon icon={faDownload} className="mr-2 h-4 w-4" />
                            Baixar PNG
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => void download("svg")}>
                            <FontAwesomeIcon icon={faDownload} className="mr-2 h-4 w-4" />
                            Baixar SVG
                        </Button>
                    </div>
                    {message && <p role="status" className="mt-3 text-center text-sm text-gray-600">{message}</p>}
                </div>
            </ToolPanel>
        </div>
    );
}
