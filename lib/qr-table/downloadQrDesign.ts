type DownloadQrDesignOptions = {
    qrValue: string;
    displayUrl: string;
    title: string;
    bannerUrl: string;
    fileName: string;
};

type Rgb = {
    r: number;
    g: number;
    b: number;
};

const FALLBACK_PALETTE = ["#f14400", "#ff7a33", "#ffb38f"] as const;

function loadImage(url: string): Promise<HTMLImageElement> {
    return fetch(url)
        .then((response) => {
            if (!response.ok) {
                throw new Error("Não foi possível carregar a imagem.");
            }
            return response.blob();
        })
        .then(
            (blob) =>
                new Promise<HTMLImageElement>((resolve, reject) => {
                    const objectUrl = URL.createObjectURL(blob);
                    const image = new Image();
                    image.onload = () => {
                        URL.revokeObjectURL(objectUrl);
                        resolve(image);
                    };
                    image.onerror = () => {
                        URL.revokeObjectURL(objectUrl);
                        reject(
                            new Error("Não foi possível carregar a imagem.")
                        );
                    };
                    image.src = objectUrl;
                })
        );
}

function drawCoverImage(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
) {
    const scale = Math.max(width / image.width, height / image.height);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.width - sourceWidth) / 2;
    const sourceY = (image.height - sourceHeight) / 2;

    context.drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        x,
        y,
        width,
        height
    );
}

function clamp(value: number, min = 0, max = 255): number {
    return Math.max(min, Math.min(max, value));
}

function rgbToHex({ r, g, b }: Rgb): string {
    return `#${[r, g, b]
        .map((value) => clamp(Math.round(value)).toString(16).padStart(2, "0"))
        .join("")}`;
}

function hexToRgb(hex: string): Rgb {
    const normalized = hex.replace("#", "");
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
}

function mixColor(color: string, target: string, amount: number): string {
    const sourceRgb = hexToRgb(color);
    const targetRgb = hexToRgb(target);
    return rgbToHex({
        r: sourceRgb.r + (targetRgb.r - sourceRgb.r) * amount,
        g: sourceRgb.g + (targetRgb.g - sourceRgb.g) * amount,
        b: sourceRgb.b + (targetRgb.b - sourceRgb.b) * amount,
    });
}

function rgba(color: string, alpha: number): string {
    const { r, g, b } = hexToRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function colorDistance(first: Rgb, second: Rgb): number {
    return Math.sqrt(
        (first.r - second.r) ** 2 +
            (first.g - second.g) ** 2 +
            (first.b - second.b) ** 2
    );
}

function colorSaturation({ r, g, b }: Rgb): number {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
}

function colorBrightness({ r, g, b }: Rgb): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}

function extractBannerPalette(image: HTMLImageElement): [string, string, string] {
    try {
        const sampleCanvas = document.createElement("canvas");
        sampleCanvas.width = 56;
        sampleCanvas.height = 56;
        const sampleContext = sampleCanvas.getContext("2d", {
            willReadFrequently: true,
        });
        if (!sampleContext) return [...FALLBACK_PALETTE];

        drawCoverImage(sampleContext, image, 0, 0, 56, 56);
        const pixels = sampleContext.getImageData(0, 0, 56, 56).data;
        const buckets = new Map<
            string,
            { color: Rgb; count: number; score: number }
        >();

        for (let index = 0; index < pixels.length; index += 4) {
            const alpha = pixels[index + 3];
            if (alpha < 180) continue;

            const color: Rgb = {
                r: pixels[index],
                g: pixels[index + 1],
                b: pixels[index + 2],
            };
            const brightness = colorBrightness(color);
            const saturation = colorSaturation(color);

            if (brightness < 24 || brightness > 246) continue;

            const quantized: Rgb = {
                r: Math.round(color.r / 24) * 24,
                g: Math.round(color.g / 24) * 24,
                b: Math.round(color.b / 24) * 24,
            };
            const key = `${quantized.r}-${quantized.g}-${quantized.b}`;
            const existing = buckets.get(key);
            const vibranceBoost = 0.6 + saturation * 1.8;

            if (existing) {
                existing.count += 1;
                existing.score += vibranceBoost;
            } else {
                buckets.set(key, {
                    color: quantized,
                    count: 1,
                    score: vibranceBoost,
                });
            }
        }

        const candidates = [...buckets.values()].sort(
            (first, second) => second.score - first.score
        );
        const selected: Rgb[] = [];

        for (const candidate of candidates) {
            if (
                selected.every(
                    (current) => colorDistance(current, candidate.color) > 72
                )
            ) {
                selected.push(candidate.color);
            }
            if (selected.length === 3) break;
        }

        const fallbackRgb = FALLBACK_PALETTE.map(hexToRgb);
        while (selected.length < 3) {
            selected.push(fallbackRgb[selected.length]);
        }

        return [
            rgbToHex(selected[0]),
            rgbToHex(selected[1]),
            rgbToHex(selected[2]),
        ];
    } catch {
        return [...FALLBACK_PALETTE];
    }
}

function fillRoundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fillStyle: string | CanvasGradient
) {
    context.fillStyle = fillStyle;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
}

function fitTextSize(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxSize: number,
    minSize: number,
    weight = 800
): number {
    let size = maxSize;
    while (size > minSize) {
        context.font = `${weight} ${size}px Arial, sans-serif`;
        if (context.measureText(text).width <= maxWidth) break;
        size -= 2;
    }
    return size;
}

export async function downloadQrDesign({
    qrValue,
    displayUrl,
    title,
    bannerUrl,
    fileName,
}: DownloadQrDesignOptions): Promise<void> {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&data=${encodeURIComponent(
        qrValue
    )}`;
    const [banner, qrCode] = await Promise.all([
        loadImage(bannerUrl),
        loadImage(qrUrl),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível criar o QR Code.");

    const cleanDisplayUrl = displayUrl
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "");
    const [primary, secondary, tertiary] = extractBannerPalette(banner);
    const deepPrimary = mixColor(primary, "#111827", 0.3);
    const lightPrimary = mixColor(primary, "#ffffff", 0.87);
    const lightSecondary = mixColor(secondary, "#ffffff", 0.9);
    const lightTertiary = mixColor(tertiary, "#ffffff", 0.88);

    const background = context.createLinearGradient(
        0,
        0,
        canvas.width,
        canvas.height
    );
    background.addColorStop(0, lightPrimary);
    background.addColorStop(0.46, "#ffffff");
    background.addColorStop(1, lightSecondary);
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const glowTop = context.createRadialGradient(90, 120, 20, 90, 120, 520);
    glowTop.addColorStop(0, rgba(primary, 0.25));
    glowTop.addColorStop(1, rgba(primary, 0));
    context.fillStyle = glowTop;
    context.fillRect(0, 0, 650, 720);

    const glowBottom = context.createRadialGradient(
        1000,
        1450,
        20,
        1000,
        1450,
        600
    );
    glowBottom.addColorStop(0, rgba(tertiary, 0.2));
    glowBottom.addColorStop(1, rgba(tertiary, 0));
    context.fillStyle = glowBottom;
    context.fillRect(420, 900, 660, 700);

    context.save();
    context.shadowColor = "rgba(17, 24, 39, 0.18)";
    context.shadowBlur = 34;
    context.shadowOffsetY = 14;
    context.beginPath();
    context.roundRect(58, 56, 964, 402, 44);
    context.clip();
    drawCoverImage(context, banner, 58, 56, 964, 402);

    const bannerOverlay = context.createLinearGradient(58, 56, 58, 458);
    bannerOverlay.addColorStop(0, "rgba(0, 0, 0, 0.02)");
    bannerOverlay.addColorStop(0.5, "rgba(0, 0, 0, 0.10)");
    bannerOverlay.addColorStop(1, "rgba(0, 0, 0, 0.72)");
    context.fillStyle = bannerOverlay;
    context.fillRect(58, 56, 964, 402);
    context.restore();

    const badgeWidth = Math.min(
        760,
        Math.max(220, 72 + title.length * 30)
    );
    fillRoundedRect(
        context,
        92,
        348,
        badgeWidth,
        74,
        37,
        "rgba(255, 255, 255, 0.92)"
    );
    context.fillStyle = deepPrimary;
    const badgeFontSize = fitTextSize(
        context,
        title,
        badgeWidth - 64,
        34,
        24,
        800
    );
    context.font = `800 ${badgeFontSize}px Arial, sans-serif`;
    context.textAlign = "left";
    context.textBaseline = "middle";
    context.fillText(title, 124, 385, badgeWidth - 64);

    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillStyle = deepPrimary;
    context.font = "800 25px Arial, sans-serif";
    context.fillText("ESCANEIE PARA PEDIR", 540, 528);

    context.fillStyle = "#111827";
    context.font = "800 54px Arial, sans-serif";
    context.fillText("Peça direto da sua mesa", 540, 590, 900);

    context.fillStyle = "#6b7280";
    context.font = "500 24px Arial, sans-serif";
    context.fillText(
        "Abra a câmera, aponte para o QR Code e faça seu pedido.",
        540,
        632,
        860
    );

    context.save();
    context.shadowColor = rgba(primary, 0.22);
    context.shadowBlur = 42;
    context.shadowOffsetY = 18;
    fillRoundedRect(context, 145, 680, 790, 690, 42, "#ffffff");
    context.restore();

    const cardBorder = context.createLinearGradient(145, 680, 935, 1370);
    cardBorder.addColorStop(0, rgba(primary, 0.72));
    cardBorder.addColorStop(0.5, rgba(secondary, 0.36));
    cardBorder.addColorStop(1, rgba(tertiary, 0.65));
    context.strokeStyle = cardBorder;
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(145, 680, 790, 690, 42);
    context.stroke();

    fillRoundedRect(context, 350, 712, 380, 54, 27, lightTertiary);
    context.fillStyle = deepPrimary;
    context.font = "800 20px Arial, sans-serif";
    context.fillText("APONTE A CÂMERA AQUI", 540, 747);

    context.save();
    context.shadowColor = "rgba(17, 24, 39, 0.10)";
    context.shadowBlur = 24;
    context.shadowOffsetY = 10;
    fillRoundedRect(context, 264, 786, 552, 552, 34, "#ffffff");
    context.restore();

    context.strokeStyle = rgba(primary, 0.12);
    context.lineWidth = 3;
    context.beginPath();
    context.roundRect(264, 786, 552, 552, 34);
    context.stroke();

    context.drawImage(qrCode, 290, 812, 500, 500);

    context.fillStyle = "#374151";
    context.font = "600 21px Arial, sans-serif";
    context.fillText("Cardápio • pedido • mesa identificada", 540, 1350, 680);

    const urlGradient = context.createLinearGradient(100, 0, 980, 0);
    urlGradient.addColorStop(0, deepPrimary);
    urlGradient.addColorStop(0.55, primary);
    urlGradient.addColorStop(1, secondary);
    fillRoundedRect(context, 100, 1410, 880, 90, 45, urlGradient);

    context.fillStyle = "rgba(255, 255, 255, 0.78)";
    context.font = "700 17px Arial, sans-serif";
    context.fillText("ACESSE PELO LINK", 540, 1440);

    context.fillStyle = "#ffffff";
    const urlFontSize = fitTextSize(
        context,
        cleanDisplayUrl,
        790,
        28,
        19,
        800
    );
    context.font = `800 ${urlFontSize}px Arial, sans-serif`;
    context.fillText(cleanDisplayUrl, 540, 1480, 790);

    context.fillStyle = "#6b7280";
    context.font = "600 18px Arial, sans-serif";
    context.fillText("Pedidos pelo iMenu", 540, 1542);

    const accent = context.createLinearGradient(380, 0, 700, 0);
    accent.addColorStop(0, rgba(primary, 0));
    accent.addColorStop(0.5, primary);
    accent.addColorStop(1, rgba(secondary, 0));
    fillRoundedRect(context, 380, 1566, 320, 5, 3, accent);

    const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
            if (result) resolve(result);
            else reject(new Error("Não foi possível gerar o arquivo."));
        }, "image/png");
    });

    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(objectUrl);
}
