"use client";

import { useEffect, useMemo, useState } from "react";
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
};

const TEMPLATES: TemplateOption[] = [
    {
        id: "banner",
        name: "Sua capa",
        description: "Usa a capa do restaurante como protagonista do design.",
    },
    {
        id: "logo",
        name: "Sua logo",
        description: "Visual de marca com a logo em evidência.",
    },
    {
        id: "dark",
        name: "Dark",
        description: "Fundo escuro sofisticado com detalhes da sua marca.",
    },
    {
        id: "xadrez",
        name: "Xadrez",
        description: "Estampa quadriculada moderna para chamar atenção na mesa.",
    },
    {
        id: "gradient",
        name: "Gradient",
        description: "Gradiente contemporâneo usando as cores do restaurante.",
    },
    {
        id: "minimal",
        name: "Minimal",
        description: "Muito espaço em branco e pequenos detalhes de marca.",
    },
    {
        id: "classic",
        name: "Legado",
        description: "Modelo original usado atualmente no iMenu.",
    },
];

const FALLBACK_COLORS = ["#F97316", "#111827", "#2563EB"];
const PREVIEW_QR = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=0&data=${encodeURIComponent(
    "https://imenuapp.com.br/mesa/preview"
)}`;

function rgbToHex(r: number, g: number, b: number) {
    return `#${[r, g, b]
        .map((value) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0"))
        .join("")}`.toUpperCase();
}

async function extractPalette(url: string): Promise<string[]> {
    if (!url) return [];

    try {
        const response = await fetch(url);
        if (!response.ok) return [];
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        try {
            const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                const element = new Image();
                element.onload = () => resolve(element);
                element.onerror = reject;
                element.src = objectUrl;
            });

            const canvas = document.createElement("canvas");
            canvas.width = 72;
            canvas.height = 72;
            const context = canvas.getContext("2d", { willReadFrequently: true });
            if (!context) return [];

            context.drawImage(image, 0, 0, 72, 72);
            const pixels = context.getImageData(0, 0, 72, 72).data;
            const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();

            for (let index = 0; index < pixels.length; index += 16) {
                const alpha = pixels[index + 3];
                if (alpha < 180) continue;

                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                const max = Math.max(r, g, b);
                const min = Math.min(r, g, b);
                const brightness = (r + g + b) / 3;
                const saturation = max - min;

                if (brightness > 242 || brightness < 18 || saturation < 16) continue;

                const qr = Math.round(r / 32) * 32;
                const qg = Math.round(g / 32) * 32;
                const qb = Math.round(b / 32) * 32;
                const key = `${qr}-${qg}-${qb}`;
                const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
                bucket.count += 1;
                bucket.r += r;
                bucket.g += g;
                bucket.b += b;
                buckets.set(key, bucket);
            }

            const palette = [...buckets.values()]
                .sort((a, b) => b.count - a.count)
                .map((bucket) =>
                    rgbToHex(
                        Math.round(bucket.r / bucket.count),
                        Math.round(bucket.g / bucket.count),
                        Math.round(bucket.b / bucket.count)
                    )
                );

            const distinct: string[] = [];
            for (const hex of palette) {
                const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
                const tooClose = distinct.some((saved) => {
                    const [sr, sg, sb] = [1, 3, 5].map((offset) =>
                        parseInt(saved.slice(offset, offset + 2), 16)
                    );
                    return Math.abs(r - sr) + Math.abs(g - sg) + Math.abs(b - sb) < 90;
                });
                if (!tooClose) distinct.push(hex);
                if (distinct.length === 3) break;
            }

            return distinct;
        } finally {
            URL.revokeObjectURL(objectUrl);
        }
    } catch {
        return [];
    }
}

function RealQr({ className = "" }: { className?: string }) {
    return (
        <div className={`bg-white p-2 ${className}`}>
            <img src={PREVIEW_QR} alt="Prévia real do QR Code" className="h-24 w-24" />
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
    if (template === "banner") {
        return (
            <div className="relative h-60 overflow-hidden rounded-xl bg-[#FAF8F4] shadow-sm">
                <div
                    className="absolute inset-x-0 top-0 h-[44%] bg-cover bg-center"
                    style={{
                        backgroundColor: color,
                        backgroundImage: bannerUrl
                            ? `linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.48)), url(${bannerUrl})`
                            : undefined,
                    }}
                />
                <div
                    className="absolute inset-x-4 top-5 text-center text-[20px] font-bold leading-none text-white drop-shadow"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                    Mesa 1
                </div>
                <div className="absolute inset-x-0 top-[78px] flex flex-col items-center gap-2">
                    <RealQr className="rounded-[18px] shadow-xl ring-4 ring-white/80" />
                    <div
                        className="text-[12px] font-black tracking-tight text-gray-900"
                        style={{ fontFamily: '"Trebuchet MS", Arial, sans-serif' }}
                    >
                        Abrir cardápio
                    </div>
                </div>
            </div>
        );
    }

    if (template === "logo") {
        return (
            <div className="relative flex h-60 flex-col items-center overflow-hidden rounded-xl bg-white px-4 py-4 shadow-sm">
                <div
                    className="absolute inset-x-0 top-0 h-1.5"
                    style={{ background: color }}
                />
                <div
                    className="absolute -right-12 -top-14 h-28 w-28 rounded-full opacity-10"
                    style={{ background: color }}
                />
                {logoUrl && (
                    <img
                        src={logoUrl}
                        alt="Logo do restaurante"
                        className="mt-1 h-7 max-w-24 object-contain"
                    />
                )}
                <div
                    className="mt-2 text-[15px] font-black tracking-tight text-gray-900"
                    style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                >
                    Mesa 1
                </div>
                <RealQr className="mt-2 rounded-2xl shadow-md ring-2 ring-gray-100" />
                <div
                    className="mt-2 rounded-full px-4 py-1 text-[10px] font-bold text-white"
                    style={{
                        background: color,
                        fontFamily: '"Helvetica Neue", Arial, sans-serif',
                    }}
                >
                    Abrir cardápio
                </div>
            </div>
        );
    }

    if (template === "dark") {
        return (
            <div className="relative flex h-60 overflow-hidden rounded-xl bg-[#080A0F] p-4 shadow-sm">
                <div
                    className="absolute -right-12 -top-10 h-32 w-32 rounded-full opacity-20 blur-xl"
                    style={{ background: color }}
                />
                <div
                    className="absolute -bottom-16 -left-14 h-36 w-36 rounded-full opacity-10 blur-xl"
                    style={{ background: color }}
                />
                <div className="relative flex w-full flex-col items-center justify-center">
                    <div
                        className="text-[18px] font-black uppercase leading-none tracking-[-0.06em] text-white"
                        style={{ fontFamily: '"Arial Black", Impact, Arial, sans-serif' }}
                    >
                        Mesa 1
                    </div>
                    <div
                        className="mt-1 h-[3px] w-10 rounded-full"
                        style={{ background: color }}
                    />
                    <RealQr className="mt-3 rounded-[20px] shadow-2xl ring-2 ring-white/10" />
                    <div
                        className="mt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-white"
                        style={{ fontFamily: '"Trebuchet MS", Arial, sans-serif' }}
                    >
                        Abrir cardápio
                    </div>
                </div>
            </div>
        );
    }

    if (template === "xadrez") {
        return (
            <div
                className="flex h-60 items-center justify-center rounded-xl p-3 shadow-sm"
                style={{
                    backgroundColor: "#fff",
                    backgroundImage: `linear-gradient(45deg, ${color} 25%, transparent 25%), linear-gradient(-45deg, ${color} 25%, transparent 25%), linear-gradient(45deg, transparent 75%, ${color} 75%), linear-gradient(-45deg, transparent 75%, ${color} 75%)`,
                    backgroundSize: "28px 28px",
                    backgroundPosition: "0 0, 0 14px, 14px -14px, -14px 0px",
                }}
            >
                <div className="flex h-full w-full flex-col items-center justify-center rounded-[18px] bg-white/95 p-3 shadow-xl ring-1 ring-black/5">
                    <div
                        className="text-[14px] font-black uppercase tracking-[-0.04em] text-gray-950"
                        style={{ fontFamily: '"Courier New", Courier, monospace' }}
                    >
                        Mesa 1
                    </div>
                    <RealQr className="mt-2 rounded-lg shadow-sm ring-2 ring-black/10" />
                    <div
                        className="mt-2 border-b-[3px] pb-0.5 text-[11px] font-black text-gray-950"
                        style={{
                            borderColor: color,
                            fontFamily: '"Arial Black", Arial, sans-serif',
                        }}
                    >
                        Abrir cardápio
                    </div>
                </div>
            </div>
        );
    }

    if (template === "gradient") {
        return (
            <div
                className="relative flex h-60 flex-col items-center justify-center overflow-hidden rounded-xl p-4 shadow-sm"
                style={{ background: `linear-gradient(145deg, ${color}, #0F172A 82%)` }}
            >
                <div className="absolute -left-10 top-0 h-28 w-28 rounded-full bg-white/10 blur-xl" />
                <div className="absolute -bottom-12 right-0 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
                <div
                    className="relative mb-2 rounded-full border border-white/20 bg-white/10 px-4 py-1 text-[15px] font-bold italic text-white shadow-sm backdrop-blur"
                    style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                >
                    Mesa 1
                </div>
                <RealQr className="relative rounded-[22px] shadow-2xl ring-1 ring-white/30" />
                <div
                    className="relative mt-3 text-[11px] font-bold tracking-wide text-white"
                    style={{ fontFamily: 'Verdana, Geneva, sans-serif' }}
                >
                    Abrir cardápio
                </div>
            </div>
        );
    }

    if (template === "minimal") {
        return (
            <div className="relative h-60 overflow-hidden rounded-xl bg-[#FCFCFA] p-5 shadow-sm">
                <span
                    className="absolute left-0 top-0 h-full w-1.5"
                    style={{ background: color }}
                />
                <div className="flex h-full flex-col items-center justify-center">
                    <div
                        className="text-[19px] font-bold leading-none text-gray-950"
                        style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                    >
                        Mesa 1
                    </div>
                    <div
                        className="my-2 h-px w-12"
                        style={{ background: color }}
                    />
                    <div
                        className="mb-2 text-[9px] font-bold uppercase tracking-[0.18em] text-gray-500"
                        style={{ fontFamily: '"Helvetica Neue", Arial, sans-serif' }}
                    >
                        Abrir cardápio
                    </div>
                    <RealQr className="rounded-none shadow-none ring-1 ring-gray-200" />
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-60 overflow-hidden rounded-xl bg-white shadow-sm">
            <div
                className="h-[25%] bg-cover bg-center blur-[1px]"
                style={{
                    backgroundColor: color,
                    backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
                }}
            />
            <div className="flex -translate-y-4 flex-col items-center gap-2 px-3">
                <div className="rounded-full bg-white px-4 py-1 text-[11px] font-black text-gray-900 shadow">
                    Mesa 1
                </div>
                <div className="text-[11px] font-extrabold text-gray-900">Abrir cardápio</div>
                <RealQr />
                <div className="text-[8px] font-medium text-gray-500">Ou acesse pelo link</div>
                <div className="rounded-full bg-gray-100 px-3 py-1 text-[8px] font-bold text-gray-700">
                    imenuapp.com.br/mesa
                </div>
            </div>
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
    const [bannerColors, setBannerColors] = useState<string[]>([]);
    const [logoColors, setLogoColors] = useState<string[]>([]);

    useEffect(() => {
        if (!open) return;

        let active = true;
        void Promise.all([extractPalette(bannerUrl), extractPalette(logoUrl)]).then(
            ([bannerPalette, logoPalette]) => {
                if (!active) return;
                setBannerColors(bannerPalette);
                setLogoColors(logoPalette);

                if (currentColor.toUpperCase() === "#F97316") {
                    const preferred =
                        currentTemplate === "logo"
                            ? logoPalette[0] || bannerPalette[0]
                            : bannerPalette[0] || logoPalette[0];
                    if (preferred) setColor(preferred);
                }
            }
        );

        return () => {
            active = false;
        };
    }, [bannerUrl, currentColor, currentTemplate, logoUrl, open]);

    useEffect(() => {
        if (!open) return;
        setTemplate(currentTemplate || "banner");
        setColor(currentColor);
    }, [currentColor, currentTemplate, open]);

    const selectedTemplate = useMemo(
        () => TEMPLATES.find((item) => item.id === template) || TEMPLATES[0],
        [template]
    );

    const suggestedColors = useMemo(() => {
        const source =
            template === "logo"
                ? [...logoColors, ...bannerColors]
                : template === "banner"
                  ? [...bannerColors, ...logoColors]
                  : [...bannerColors, ...logoColors];

        return [...new Set([...source, ...FALLBACK_COLORS])].slice(0, 3);
    }, [bannerColors, logoColors, template]);

    const templateColor = (id: QrDesignTemplate) => {
        if (id === template) return color;
        if (id === "logo") return logoColors[0] || bannerColors[0] || FALLBACK_COLORS[0];
        return bannerColors[0] || logoColors[0] || FALLBACK_COLORS[0];
    };

    return (
        <Modal open={open} onClose={onClose} className="max-w-6xl">
            <div className="border-b border-gray-100 px-6 py-5 sm:px-7">
                <h2 className="text-xl font-bold text-gray-900">Configurar design</h2>
                <p className="mt-1 text-sm text-gray-500">
                    As cores sugeridas são extraídas da capa e da logo do seu restaurante.
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
                                    const next =
                                        item.id === "logo"
                                            ? logoColors[0] || bannerColors[0]
                                            : bannerColors[0] || logoColors[0];
                                    setColor(next || FALLBACK_COLORS[0]);
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
                                        color={templateColor(item.id)}
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
                                Sugestões geradas a partir da identidade visual do restaurante.
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {suggestedColors.map((suggested) => (
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
