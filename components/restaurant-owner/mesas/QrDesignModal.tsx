"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPlus } from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export type QrDesignTemplate =
    | "classic"
    | "dark"
    | "banner"
    | "logo"
    | "xadrez"
    | "gradient"
    | "minimal";

type TemplateOption = {
    id: QrDesignTemplate;
    name: string;
    description: string;
    colors: string[];
};

const TEMPLATES: TemplateOption[] = [
    {
        id: "classic",
        name: "Clássico",
        description: "Limpo, claro e com destaque para o QR Code.",
        colors: ["#F97316", "#111827", "#2563EB"],
    },
    {
        id: "dark",
        name: "Dark",
        description: "Fundo escuro sofisticado com detalhes em destaque.",
        colors: ["#F97316", "#22C55E", "#A855F7"],
    },
    {
        id: "banner",
        name: "Sua capa",
        description: "Usa a capa do restaurante como protagonista do design.",
        colors: ["#F97316", "#DC2626", "#0F766E"],
    },
    {
        id: "logo",
        name: "Sua logo",
        description: "Visual de marca com a logo em evidência.",
        colors: ["#F97316", "#111827", "#7C3AED"],
    },
    {
        id: "xadrez",
        name: "Xadrez",
        description: "Estampa quadriculada moderna para chamar atenção na mesa.",
        colors: ["#F97316", "#DC2626", "#16A34A"],
    },
    {
        id: "gradient",
        name: "Gradient",
        description: "Gradiente forte e contemporâneo com acabamento premium.",
        colors: ["#F97316", "#2563EB", "#DB2777"],
    },
    {
        id: "minimal",
        name: "Minimal",
        description: "Muito espaço em branco e pequenos detalhes de marca.",
        colors: ["#111827", "#F97316", "#0F766E"],
    },
];

function MiniQr() {
    return (
        <div className="grid h-20 w-20 grid-cols-5 gap-1 rounded-lg bg-white p-2 shadow-sm">
            {Array.from({ length: 25 }, (_, index) => (
                <span
                    key={index}
                    className={
                        index % 3 === 0 || index % 7 === 0
                            ? "rounded-[1px] bg-gray-900"
                            : "rounded-[1px] bg-gray-200"
                    }
                />
            ))}
        </div>
    );
}

function Preview({
    template,
    color,
    bannerUrl,
    logoUrl,
}: {
    template: QrDesignTemplate;
    color: string;
    bannerUrl: string;
    logoUrl: string;
}) {
    const style = { "--preview-accent": color } as CSSProperties;

    if (template === "dark") {
        return (
            <div className="relative flex h-48 overflow-hidden rounded-xl bg-[#0B0F19] p-4" style={style}>
                <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: color }} />
                <div className="flex w-full flex-col items-center justify-center gap-3">
                    <div className="text-center text-sm font-extrabold text-white">ABRIR CARDÁPIO</div>
                    <MiniQr />
                    <div className="rounded-full px-3 py-1 text-[9px] font-bold text-white" style={{ background: color }}>
                        imenuapp.com.br/mesa
                    </div>
                </div>
            </div>
        );
    }

    if (template === "banner") {
        return (
            <div className="relative h-48 overflow-hidden rounded-xl bg-white">
                <div
                    className="h-[38%] bg-cover bg-center"
                    style={{
                        backgroundColor: color,
                        backgroundImage: bannerUrl
                            ? `linear-gradient(rgba(0,0,0,.2),rgba(0,0,0,.2)), url(${bannerUrl})`
                            : undefined,
                    }}
                />
                <div className="absolute inset-x-0 top-8 text-center text-xs font-extrabold text-white">SUA MESA</div>
                <div className="flex -translate-y-5 flex-col items-center gap-2">
                    <MiniQr />
                    <div className="text-[10px] font-extrabold text-gray-900">Abrir cardápio</div>
                    <span className="h-1 w-12 rounded-full" style={{ background: color }} />
                </div>
            </div>
        );
    }

    if (template === "logo") {
        return (
            <div className="flex h-48 flex-col items-center justify-center gap-2 overflow-hidden rounded-xl bg-white p-4" style={{ borderTop: `8px solid ${color}` }}>
                {logoUrl ? (
                    <img src={logoUrl} alt="" className="h-8 max-w-28 object-contain" />
                ) : (
                    <div className="text-xs font-black" style={{ color }}>SUA LOGO</div>
                )}
                <MiniQr />
                <div className="text-[9px] font-bold text-gray-500">ESCANEIE E PEÇA</div>
            </div>
        );
    }

    if (template === "xadrez") {
        return (
            <div
                className="flex h-48 items-center justify-center rounded-xl p-4"
                style={{
                    backgroundColor: "#fff",
                    backgroundImage: `linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(-45deg, ${color} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${color} 75%), linear-gradient(-45deg, transparent 75%, ${color} 75%)`,
                    backgroundSize: "34px 34px",
                    backgroundPosition: "0 0, 0 17px, 17px -17px, -17px 0px",
                }}
            >
                <div className="flex w-full flex-col items-center gap-2 rounded-xl bg-white/95 p-3 shadow-lg">
                    <div className="text-[10px] font-black text-gray-900">PEÇA PELO QR CODE</div>
                    <MiniQr />
                </div>
            </div>
        );
    }

    if (template === "gradient") {
        return (
            <div
                className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl p-4"
                style={{ background: `linear-gradient(145deg, ${color}, #111827)` }}
            >
                <div className="text-xs font-extrabold text-white">Seu pedido começa aqui</div>
                <MiniQr />
                <div className="text-[9px] font-semibold text-white/80">Escaneie para abrir o cardápio</div>
            </div>
        );
    }

    if (template === "minimal") {
        return (
            <div className="relative flex h-48 flex-col items-center justify-center gap-3 overflow-hidden rounded-xl bg-white p-4">
                <span className="absolute left-0 top-0 h-full w-2" style={{ background: color }} />
                <div className="text-[10px] font-black tracking-[0.18em] text-gray-900">CARDÁPIO</div>
                <MiniQr />
                <div className="text-[9px] font-medium text-gray-400">aponte a câmera</div>
            </div>
        );
    }

    return (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl bg-white p-4" style={{ borderTop: `8px solid ${color}` }}>
            <div className="text-xs font-extrabold text-gray-900">Abrir cardápio</div>
            <MiniQr />
            <div className="rounded-full bg-gray-100 px-3 py-1 text-[9px] font-bold text-gray-600">imenuapp.com.br/mesa</div>
        </div>
    );
}

export default function QrDesignModal({
    open,
    onClose,
    currentTemplate,
    currentColor,
    bannerUrl,
    logoUrl,
    saving,
    onSave,
}: {
    open: boolean;
    onClose: () => void;
    currentTemplate: QrDesignTemplate;
    currentColor: string;
    bannerUrl: string;
    logoUrl: string;
    saving: boolean;
    onSave: (template: QrDesignTemplate, color: string) => void;
}) {
    const [template, setTemplate] = useState<QrDesignTemplate>(currentTemplate);
    const [color, setColor] = useState(currentColor);

    useEffect(() => {
        if (!open) return;
        setTemplate(currentTemplate);
        setColor(currentColor);
    }, [currentColor, currentTemplate, open]);

    const selectedTemplate = useMemo(
        () => TEMPLATES.find((item) => item.id === template) || TEMPLATES[0],
        [template]
    );

    return (
        <Modal open={open} onClose={onClose} className="max-w-6xl">
            <div className="border-b border-gray-100 px-6 py-5 sm:px-7">
                <h2 className="text-xl font-bold text-gray-900">Configurar design</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Escolha como os QR Codes com design serão gerados para suas mesas.
                </p>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-6 py-6 sm:px-7">
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {TEMPLATES.map((item) => {
                        const selected = item.id === template;
                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                    setTemplate(item.id);
                                    setColor(item.colors[0]);
                                }}
                                className={`group cursor-pointer rounded-2xl border p-3 text-left transition ${
                                    selected
                                        ? "border-brand bg-brand/5 ring-2 ring-brand/15"
                                        : "border-gray-200 bg-gray-50 hover:border-gray-300"
                                }`}
                            >
                                <div className="relative">
                                    <Preview
                                        template={item.id}
                                        color={selected ? color : item.colors[0]}
                                        bannerUrl={bannerUrl}
                                        logoUrl={logoUrl}
                                    />
                                    {selected && (
                                        <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs text-white shadow">
                                            <FontAwesomeIcon icon={faCheck} />
                                        </span>
                                    )}
                                </div>
                                <div className="mt-3 font-bold text-gray-900">{item.name}</div>
                                <div className="mt-1 min-h-10 text-xs leading-relaxed text-gray-500">
                                    {item.description}
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                        <div>
                            <div className="font-bold text-gray-900">Cor do template · {selectedTemplate.name}</div>
                            <div className="mt-1 text-sm text-gray-500">
                                Use uma sugestão ou escolha qualquer cor para combinar com sua marca.
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {selectedTemplate.colors.map((suggested) => (
                                <button
                                    key={suggested}
                                    type="button"
                                    onClick={() => setColor(suggested)}
                                    aria-label={`Usar cor ${suggested}`}
                                    title={suggested}
                                    className={`h-10 w-10 cursor-pointer rounded-full border-4 shadow-sm transition hover:scale-105 ${
                                        color.toLowerCase() === suggested.toLowerCase()
                                            ? "border-gray-900"
                                            : "border-white"
                                    }`}
                                    style={{ backgroundColor: suggested }}
                                />
                            ))}
                            <label
                                className="relative flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-white text-gray-500 transition hover:border-brand hover:text-brand"
                                title="Escolher outra cor"
                            >
                                <FontAwesomeIcon icon={faPlus} />
                                <input
                                    type="color"
                                    value={color}
                                    onChange={(event) => setColor(event.target.value.toUpperCase())}
                                    className="absolute inset-0 cursor-pointer opacity-0"
                                    aria-label="Escolher outra cor"
                                />
                            </label>
                        </div>
                    </div>
                    <div className="mt-4 flex items-center gap-3 text-sm text-gray-600">
                        <span className="h-6 w-6 rounded-full border border-black/10" style={{ backgroundColor: color }} />
                        <span className="font-mono font-semibold uppercase">{color}</span>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-5 sm:px-7">
                <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
                    Cancelar
                </Button>
                <Button type="button" loading={saving} onClick={() => onSave(template, color)}>
                    Salvar design
                </Button>
            </div>
        </Modal>
    );
}
