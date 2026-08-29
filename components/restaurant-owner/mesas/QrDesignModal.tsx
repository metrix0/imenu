"use client";

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck, faPlus } from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { renderQrDesignCanvas } from "@/lib/qr-table/downloadQrDesign";

export type QrDesignTemplate =
    | "classic"
    | "dark"
    | "banner"
    | "logo"
    | "xadrez"
    | "gradient"
    | "minimal"
    | "white"
    | "poster";

type TemplateOption = {
    id: QrDesignTemplate;
    name: string;
    description: string;
};

const TEMPLATES: TemplateOption[] = [
    {
        id: "classic",
        name: "Padrão",
        description: "Modelo padrão do iMenu.",
    },
    {
        id: "banner",
        name: "Sua capa",
        description: "Capa em destaque com composição limpa e leitura forte.",
    },
    {
        id: "poster",
        name: "Poster",
        description: "Foto em tela cheia, texto branco forte e QR em destaque.",
    },
    {
        id: "white",
        name: "Texto branco",
        description: "Cor sólida, texto branco e QR Code. Só o essencial.",
    },
    {
        id: "logo",
        name: "Sua logo",
        description: "Visual claro e moderno com a logo do restaurante.",
    },
    {
        id: "dark",
        name: "Dark",
        description: "Placa preta de alto contraste, inspirada em sinalização de mesa.",
    },
    {
        id: "xadrez",
        name: "Xadrez",
        description: "Marcante e divertido, agora com tipografia limpa e legível.",
    },
    {
        id: "gradient",
        name: "Gradient",
        description: "Cor intensa com texto branco e composição moderna.",
    },
    {
        id: "minimal",
        name: "Minimal",
        description: "Branco, direto e elegante, com bastante respiro.",
    },
];

const NO_COLOR_TEMPLATES = new Set<QrDesignTemplate>([
    "classic",
    "banner",
    "poster",
    "dark",
    "minimal",
]);
const FALLBACK_COLORS = ["#F97316", "#111827", "#2563EB"];
const PREVIEW_QR_VALUE = "https://imenuapp.com.br/mesa/preview";

function rgbToHex(r: number, g: number, b: number) {
    return `#${[r, g, b]
        .map((value) =>
            Math.max(0, Math.min(255, value))
                .toString(16)
                .padStart(2, "0")
        )
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
            const context = canvas.getContext("2d", {
                willReadFrequently: true,
            });
            if (!context) return [];

            context.drawImage(image, 0, 0, 72, 72);
            const pixels = context.getImageData(0, 0, 72, 72).data;
            const buckets = new Map<
                string,
                { count: number; r: number; g: number; b: number }
            >();

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

                if (brightness > 242 || brightness < 18 || saturation < 16) {
                    continue;
                }

                const qr = Math.round(r / 32) * 32;
                const qg = Math.round(g / 32) * 32;
                const qb = Math.round(b / 32) * 32;
                const key = `${qr}-${qg}-${qb}`;
                const bucket = buckets.get(key) || {
                    count: 0,
                    r: 0,
                    g: 0,
                    b: 0,
                };
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
                const [r, g, b] = [1, 3, 5].map((offset) =>
                    parseInt(hex.slice(offset, offset + 2), 16)
                );
                const tooClose = distinct.some((saved) => {
                    const [sr, sg, sb] = [1, 3, 5].map((offset) =>
                        parseInt(saved.slice(offset, offset + 2), 16)
                    );
                    return (
                        Math.abs(r - sr) +
                            Math.abs(g - sg) +
                            Math.abs(b - sb) <
                        90
                    );
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
    const [template, setTemplate] =
        useState<QrDesignTemplate>(currentTemplate);
    const [color, setColor] = useState(currentColor);
    const [bannerColors, setBannerColors] = useState<string[]>([]);
    const [logoColors, setLogoColors] = useState<string[]>([]);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);

    useEffect(() => {
        if (!open) return;

        let active = true;
        void Promise.all([
            extractPalette(bannerUrl),
            extractPalette(logoUrl),
        ]).then(([bannerPalette, logoPalette]) => {
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
        });

        return () => {
            active = false;
        };
    }, [bannerUrl, currentColor, currentTemplate, logoUrl, open]);

    useEffect(() => {
        if (!open) return;
        setTemplate(currentTemplate || "classic");
        setColor(currentColor);
    }, [currentColor, currentTemplate, open]);

    useEffect(() => {
        if (!open) return;

        let active = true;
        setPreviewLoading(true);

        void renderQrDesignCanvas({
            qrValue: PREVIEW_QR_VALUE,
            displayUrl: PREVIEW_QR_VALUE,
            title: "Mesa 1",
            bannerUrl,
            logoUrl,
            template,
            accentColor: color,
        })
            .then((canvas) => {
                if (!active) return;
                setPreviewUrl(canvas.toDataURL("image/png"));
            })
            .catch(() => {
                if (!active) return;
                setPreviewUrl(null);
            })
            .finally(() => {
                if (active) setPreviewLoading(false);
            });

        return () => {
            active = false;
        };
    }, [bannerUrl, color, logoUrl, open, template]);

    const selectedTemplate = useMemo(
        () => TEMPLATES.find((item) => item.id === template) || TEMPLATES[0],
        [template]
    );
    const usesColor = !NO_COLOR_TEMPLATES.has(template);

    const suggestedColors = useMemo(() => {
        const source =
            template === "logo"
                ? [...logoColors, ...bannerColors]
                : [...bannerColors, ...logoColors];

        return [...new Set([...source, ...FALLBACK_COLORS])].slice(0, 3);
    }, [bannerColors, logoColors, template]);

    const chooseTemplate = (nextTemplate: QrDesignTemplate) => {
        setTemplate(nextTemplate);
        if (NO_COLOR_TEMPLATES.has(nextTemplate)) return;

        const nextColor =
            nextTemplate === "logo"
                ? logoColors[0] || bannerColors[0]
                : bannerColors[0] || logoColors[0];
        setColor(nextColor || FALLBACK_COLORS[0]);
    };

    return (
        <Modal open={open} onClose={onClose} className="max-w-7xl">
            <div className="border-b border-gray-100 px-5 py-4 sm:px-7 sm:py-5">
                <h2 className="text-xl font-bold text-gray-900">
                    Configurar design
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Escolha o modelo e veja exatamente como o arquivo final
                    será baixado.
                </p>
            </div>

            <div className="max-h-[76vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
                    <div className="order-2 space-y-6 lg:order-1">
                        <div>
                            <div className="mb-3 text-sm font-bold text-gray-900">
                                Template
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {TEMPLATES.map((item) => {
                                    const selected = item.id === template;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() =>
                                                chooseTemplate(item.id)
                                            }
                                            className={`relative cursor-pointer rounded-2xl border p-4 text-left transition ${
                                                selected
                                                    ? "border-brand bg-brand/5 ring-2 ring-brand/15"
                                                    : "border-gray-200 bg-white hover:border-gray-300"
                                            }`}
                                        >
                                            {selected && (
                                                <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                                                    <FontAwesomeIcon
                                                        icon={faCheck}
                                                    />
                                                </span>
                                            )}
                                            <div className="pr-8 font-bold text-gray-900">
                                                {item.name}
                                            </div>
                                            <div className="mt-1 text-xs leading-relaxed text-gray-500">
                                                {item.description}
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div
                            className={`rounded-2xl border border-gray-200 p-5 ${
                                usesColor
                                    ? "bg-gray-50"
                                    : "bg-white opacity-60"
                            }`}
                        >
                            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                                <div>
                                    <div
                                        className={`font-bold ${
                                            usesColor
                                                ? "text-gray-900"
                                                : "text-gray-500"
                                        }`}
                                    >
                                        Cor do template ·{" "}
                                        {selectedTemplate.name}
                                    </div>
                                    <div className="mt-1 text-sm text-gray-500">
                                        {usesColor
                                            ? "Sugestões extraídas da capa e da logo do restaurante."
                                            : "Esse template não usa cor."}
                                    </div>
                                </div>
                                {usesColor && (
                                    <div className="flex items-center gap-3">
                                        {suggestedColors.map((suggested) => (
                                            <button
                                                key={suggested}
                                                type="button"
                                                onClick={() =>
                                                    setColor(suggested)
                                                }
                                                aria-label={`Usar cor ${suggested}`}
                                                title={suggested}
                                                className={`h-10 w-10 cursor-pointer rounded-full border-4 shadow-sm transition hover:scale-105 ${
                                                    color.toLowerCase() ===
                                                    suggested.toLowerCase()
                                                        ? "border-gray-900"
                                                        : "border-white"
                                                }`}
                                                style={{
                                                    backgroundColor: suggested,
                                                }}
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
                                                onChange={(event) =>
                                                    setColor(
                                                        event.target.value.toUpperCase()
                                                    )
                                                }
                                                className="absolute inset-0 cursor-pointer opacity-0"
                                                aria-label="Escolher outra cor"
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>
                            {usesColor && (
                                <div className="mt-4 flex items-center gap-3 text-sm text-gray-600">
                                    <span
                                        className="h-6 w-6 rounded-full border border-black/10"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="font-mono font-semibold uppercase">
                                        {color}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="order-1 lg:order-2 lg:sticky lg:top-0">
                        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
                            <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                    <div className="font-bold text-gray-900">
                                        Resultado final
                                    </div>
                                    <div className="text-xs text-gray-500">
                                        1080 × 1600 px
                                    </div>
                                </div>
                                <div className="text-xs font-semibold text-gray-500">
                                    {selectedTemplate.name}
                                </div>
                            </div>

                            <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                                {previewUrl ? (
                                    <div className="relative">
                                        <img
                                            src={previewUrl}
                                            alt={`Resultado final do template ${selectedTemplate.name}`}
                                            width={1080}
                                            height={1600}
                                            className="block h-auto w-full"
                                        />
                                        {previewLoading && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-white/55 text-xs font-semibold text-gray-500 backdrop-blur-[1px]">
                                                Atualizando…
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="flex aspect-[27/40] items-center justify-center text-sm text-gray-400">
                                        {previewLoading
                                            ? "Gerando prévia…"
                                            : "Prévia indisponível"}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 px-5 py-4 sm:px-7 sm:py-5">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onClose}
                    disabled={saving}
                >
                    Cancelar
                </Button>
                <Button
                    type="button"
                    loading={saving}
                    onClick={() => onSave(template, color)}
                >
                    Salvar design
                </Button>
            </div>
        </Modal>
    );
}
