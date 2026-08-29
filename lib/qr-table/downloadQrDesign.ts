export type QrDesignTemplate =
    | "classic"
    | "dark"
    | "banner"
    | "logo"
    | "xadrez"
    | "gradient"
    | "minimal";

type DownloadQrDesignOptions = {
    qrValue: string;
    displayUrl: string;
    title: string;
    bannerUrl: string;
    logoUrl?: string;
    fileName: string;
    template?: QrDesignTemplate;
    accentColor?: string;
};

const FONT_FAMILY = '"Inter", "Segoe UI", Arial, sans-serif';
const FONT_EDITORIAL = 'Georgia, "Times New Roman", serif';
const FONT_MODERN = '"Trebuchet MS", Arial, sans-serif';
const FONT_GEOMETRIC = 'Verdana, Geneva, sans-serif';
const FONT_BOLD = '"Arial Black", Impact, Arial, sans-serif';
const FONT_MONO = '"Courier New", Courier, monospace';
const FONT_CLEAN = '"Helvetica Neue", Arial, sans-serif';

function loadImage(url: string): Promise<HTMLImageElement> {
    return fetch(url)
        .then((response) => {
            if (!response.ok) throw new Error("Não foi possível carregar a imagem.");
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
                        reject(new Error("Não foi possível carregar a imagem."));
                    };
                    image.src = objectUrl;
                })
        );
}

async function loadOptionalImage(url?: string): Promise<HTMLImageElement | null> {
    if (!url) return null;
    try {
        return await loadImage(url);
    } catch {
        return null;
    }
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

function drawContainImage(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
) {
    const scale = Math.min(width / image.width, height / image.height);
    const targetWidth = image.width * scale;
    const targetHeight = image.height * scale;
    context.drawImage(
        image,
        x + (width - targetWidth) / 2,
        y + (height - targetHeight) / 2,
        targetWidth,
        targetHeight
    );
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
        context.font = `${weight} ${size}px ${FONT_FAMILY}`;
        if (context.measureText(text).width <= maxWidth) break;
        size -= 2;
    }
    return size;
}

function fitStyledTextSize(
    context: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxSize: number,
    minSize: number,
    weight: number,
    fontFamily: string,
    italic = false
): number {
    let size = maxSize;
    while (size > minSize) {
        context.font = `${italic ? "italic " : ""}${weight} ${size}px ${fontFamily}`;
        if (context.measureText(text).width <= maxWidth) break;
        size -= 2;
    }
    return size;
}

function normalizeHex(value?: string): string {
    return /^#[0-9a-f]{6}$/i.test(value || "") ? String(value).toUpperCase() : "#F97316";
}

function hexRgb(hex: string) {
    const value = hex.replace("#", "");
    return {
        r: parseInt(value.slice(0, 2), 16),
        g: parseInt(value.slice(2, 4), 16),
        b: parseInt(value.slice(4, 6), 16),
    };
}

function alpha(hex: string, opacity: number) {
    const { r, g, b } = hexRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function shade(hex: string, amount: number) {
    const { r, g, b } = hexRgb(hex);
    const adjust = (value: number) => Math.max(0, Math.min(255, Math.round(value + amount)));
    return `rgb(${adjust(r)}, ${adjust(g)}, ${adjust(b)})`;
}

function roundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    fill: string
) {
    context.fillStyle = fill;
    context.beginPath();
    context.roundRect(x, y, width, height, radius);
    context.fill();
}

function drawChecker(context: CanvasRenderingContext2D, accent: string) {
    const size = 84;
    context.fillStyle = "#FFFDF8";
    context.fillRect(0, 0, 1080, 1600);
    context.fillStyle = alpha(accent, 0.92);
    for (let row = 0; row < Math.ceil(1600 / size); row += 1) {
        for (let col = 0; col < Math.ceil(1080 / size); col += 1) {
            if ((row + col) % 2 === 0) {
                context.fillRect(col * size, row * size, size, size);
            }
        }
    }
}

function drawQrCard(
    context: CanvasRenderingContext2D,
    qrCode: HTMLImageElement,
    y: number,
    options?: {
        shadow?: boolean;
        radius?: number;
        borderColor?: string;
        borderWidth?: number;
    }
) {
    const shadow = options?.shadow ?? true;
    const radius = options?.radius ?? 56;
    const borderWidth = options?.borderWidth ?? 0;

    context.save();
    if (shadow) {
        context.shadowColor = "rgba(15, 23, 42, 0.22)";
        context.shadowBlur = 50;
        context.shadowOffsetY = 18;
    }
    roundedRect(context, 160, y, 760, 760, radius, "#FFFFFF");
    context.restore();

    if (options?.borderColor && borderWidth > 0) {
        context.save();
        context.strokeStyle = options.borderColor;
        context.lineWidth = borderWidth;
        context.beginPath();
        context.roundRect(
            160 + borderWidth / 2,
            y + borderWidth / 2,
            760 - borderWidth,
            760 - borderWidth,
            Math.max(0, radius - borderWidth / 2)
        );
        context.stroke();
        context.restore();
    }

    context.drawImage(qrCode, 215, y + 55, 650, 650);
}

function isUniversalTitle(title: string) {
    return !title.trim() || title.trim().toLowerCase() === "universal";
}

function drawTableName(
    context: CanvasRenderingContext2D,
    title: string,
    y: number,
    options: {
        foreground: string;
        background?: string | null;
        fontFamily: string;
        weight?: number;
        maxSize?: number;
        minSize?: number;
        italic?: boolean;
        paddingX?: number;
        height?: number;
        radius?: number;
        shadow?: boolean;
    }
) {
    if (isUniversalTitle(title)) return;

    const weight = options.weight ?? 800;
    const maxSize = options.maxSize ?? 78;
    const minSize = options.minSize ?? 44;
    const paddingX = options.paddingX ?? 120;
    const height = options.height ?? 112;
    const radius = options.radius ?? height / 2;
    const size = fitStyledTextSize(
        context,
        title,
        850,
        maxSize,
        minSize,
        weight,
        options.fontFamily,
        options.italic
    );

    context.font = `${options.italic ? "italic " : ""}${weight} ${size}px ${options.fontFamily}`;
    const width = Math.min(940, Math.max(320, context.measureText(title).width + paddingX));

    if (options.background) {
        context.save();
        if (options.shadow) {
            context.shadowColor = "rgba(15, 23, 42, 0.20)";
            context.shadowBlur = 28;
            context.shadowOffsetY = 8;
        }
        roundedRect(
            context,
            (1080 - width) / 2,
            y,
            width,
            height,
            radius,
            options.background
        );
        context.restore();
    }

    context.fillStyle = options.foreground;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(title, 540, y + height / 2, width - 60);
}

function drawOpenMenu(
    context: CanvasRenderingContext2D,
    y: number,
    options: {
        color: string;
        fontFamily: string;
        size?: number;
        weight?: number;
        italic?: boolean;
    }
) {
    const size = options.size ?? 66;
    const weight = options.weight ?? 800;
    context.fillStyle = options.color;
    context.font = `${options.italic ? "italic " : ""}${weight} ${size}px ${options.fontFamily}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("Abrir cardápio", 540, y, 900);
}

async function saveCanvas(canvas: HTMLCanvasElement, fileName: string) {
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

async function downloadLegacyDesign({
    qrValue,
    displayUrl,
    title,
    bannerUrl,
    fileName,
}: DownloadQrDesignOptions) {
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
    const showTitleBadge =
        title.trim() !== "" && title.trim().toLowerCase() !== "universal";

    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.save();
    context.beginPath();
    context.rect(0, 0, canvas.width, 390);
    context.clip();
    context.filter = "blur(12px)";
    drawCoverImage(context, banner, -24, -24, canvas.width + 48, 438);
    context.restore();

    context.fillStyle = "rgba(0, 0, 0, 0.20)";
    context.fillRect(0, 0, canvas.width, 390);

    context.textAlign = "center";
    context.textBaseline = "middle";

    if (showTitleBadge) {
        const badgeFontSize = fitTextSize(context, title, 820, 104, 54, 800);
        context.font = `800 ${badgeFontSize}px ${FONT_FAMILY}`;
        const badgeTextWidth = context.measureText(title).width;
        const badgeWidth = Math.min(940, Math.max(360, badgeTextWidth + 140));
        const badgeHeight = 150;
        const badgeX = (canvas.width - badgeWidth) / 2;
        const badgeY = 120;

        context.save();
        context.shadowColor = "rgba(17, 24, 39, 0.20)";
        context.shadowBlur = 28;
        context.shadowOffsetY = 10;
        context.fillStyle = "rgba(255, 255, 255, 0.94)";
        context.beginPath();
        context.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 75);
        context.fill();
        context.restore();

        context.fillStyle = "#111827";
        context.fillText(title, 540, badgeY + badgeHeight / 2, badgeWidth - 80);
    }

    context.textBaseline = "alphabetic";
    context.fillStyle = "#111827";
    context.font = `800 82px ${FONT_FAMILY}`;
    context.fillText("Abrir cardápio", 540, 530, 900);

    context.drawImage(qrCode, 215, 610, 650, 650);

    context.fillStyle = "#6b7280";
    context.font = `500 28px ${FONT_FAMILY}`;
    context.fillText("Ou acesse pelo link", 540, 1370);

    const urlFontSize = fitTextSize(
        context,
        cleanDisplayUrl,
        790,
        30,
        20,
        700
    );
    context.font = `700 ${urlFontSize}px ${FONT_FAMILY}`;
    const urlTextWidth = context.measureText(cleanDisplayUrl).width;
    const urlBadgeWidth = Math.min(900, Math.max(360, urlTextWidth + 90));
    const urlBadgeHeight = 78;
    const urlBadgeX = (canvas.width - urlBadgeWidth) / 2;
    const urlBadgeY = 1408;

    context.fillStyle = "#f3f4f6";
    context.beginPath();
    context.roundRect(
        urlBadgeX,
        urlBadgeY,
        urlBadgeWidth,
        urlBadgeHeight,
        39
    );
    context.fill();

    context.fillStyle = "#111827";
    context.textBaseline = "middle";
    context.fillText(
        cleanDisplayUrl,
        540,
        urlBadgeY + urlBadgeHeight / 2,
        urlBadgeWidth - 60
    );

    await saveCanvas(canvas, fileName);
}

export async function downloadQrDesign(options: DownloadQrDesignOptions): Promise<void> {
    const {
        qrValue,
        title,
        bannerUrl,
        logoUrl,
        fileName,
        template = "classic",
        accentColor,
    } = options;

    if (template === "classic") {
        await downloadLegacyDesign(options);
        return;
    }

    const accent = normalizeHex(accentColor);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=720x720&data=${encodeURIComponent(qrValue)}`;
    const [qrCode, banner, logo] = await Promise.all([
        loadImage(qrUrl),
        loadOptionalImage(bannerUrl),
        loadOptionalImage(logoUrl),
    ]);

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1600;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível criar o QR Code.");

    context.textAlign = "center";
    context.textBaseline = "middle";
    const universal = isUniversalTitle(title);

    if (template === "dark") {
        context.fillStyle = "#07090D";
        context.fillRect(0, 0, 1080, 1600);

        context.fillStyle = alpha(accent, 0.2);
        context.beginPath();
        context.arc(930, 120, 360, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = alpha(accent, 0.1);
        context.beginPath();
        context.arc(70, 1440, 330, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = accent;
        context.fillRect(0, 0, 1080, 18);
        context.fillRect(390, universal ? 320 : 390, 300, 8);

        drawTableName(context, title, 150, {
            foreground: "#FFFFFF",
            background: null,
            fontFamily: FONT_BOLD,
            weight: 900,
            maxSize: 98,
            minSize: 54,
            height: 120,
        });
        drawOpenMenu(context, universal ? 255 : 330, {
            color: "#FFFFFF",
            fontFamily: FONT_MODERN,
            size: 58,
            weight: 800,
        });
        drawQrCard(context, qrCode, universal ? 400 : 470, {
            shadow: true,
            radius: 64,
            borderColor: accent,
            borderWidth: 8,
        });
    } else if (template === "banner") {
        context.fillStyle = "#FAF8F4";
        context.fillRect(0, 0, 1080, 1600);

        if (banner) {
            context.save();
            context.beginPath();
            context.rect(0, 0, 1080, 540);
            context.clip();
            drawCoverImage(context, banner, 0, 0, 1080, 540);
            context.restore();
        } else {
            context.fillStyle = accent;
            context.fillRect(0, 0, 1080, 540);
        }

        const overlay = context.createLinearGradient(0, 0, 0, 540);
        overlay.addColorStop(0, "rgba(0,0,0,.05)");
        overlay.addColorStop(1, "rgba(0,0,0,.58)");
        context.fillStyle = overlay;
        context.fillRect(0, 0, 1080, 540);

        drawTableName(context, title, 165, {
            foreground: "#FFFFFF",
            background: null,
            fontFamily: FONT_EDITORIAL,
            weight: 700,
            maxSize: 100,
            minSize: 52,
            height: 130,
        });
        drawOpenMenu(context, universal ? 550 : 610, {
            color: "#111827",
            fontFamily: FONT_MODERN,
            size: 64,
            weight: 900,
        });
        roundedRect(context, 445, universal ? 600 : 660, 190, 8, 4, accent);
        drawQrCard(context, qrCode, universal ? 650 : 710, {
            shadow: true,
            radius: 62,
            borderColor: "rgba(255,255,255,.95)",
            borderWidth: 10,
        });
    } else if (template === "logo") {
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, 1080, 1600);
        context.fillStyle = alpha(accent, 0.08);
        context.beginPath();
        context.arc(1020, 80, 340, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = alpha(accent, 0.05);
        context.beginPath();
        context.arc(70, 1540, 280, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = accent;
        context.fillRect(0, 0, 1080, 18);

        if (logo) {
            roundedRect(context, 345, 70, 390, 165, 42, "#FFFFFF");
            drawContainImage(context, logo, 390, 95, 300, 115);
        }

        drawTableName(context, title, logo ? 265 : 155, {
            foreground: "#111827",
            background: null,
            fontFamily: FONT_GEOMETRIC,
            weight: 900,
            maxSize: 78,
            minSize: 46,
            height: 110,
        });
        drawOpenMenu(context, universal ? (logo ? 315 : 220) : logo ? 385 : 280, {
            color: "#111827",
            fontFamily: FONT_CLEAN,
            size: 56,
            weight: 800,
        });
        drawQrCard(context, qrCode, universal ? (logo ? 405 : 335) : logo ? 470 : 390, {
            shadow: true,
            radius: 54,
            borderColor: accent,
            borderWidth: 6,
        });
    } else if (template === "xadrez") {
        drawChecker(context, accent);
        roundedRect(context, 82, 78, 916, 1444, 74, "rgba(255,255,255,.97)");

        context.save();
        context.strokeStyle = "rgba(17,24,39,.10)";
        context.lineWidth = 3;
        context.beginPath();
        context.roundRect(82, 78, 916, 1444, 74);
        context.stroke();
        context.restore();

        drawTableName(context, title, 160, {
            foreground: "#111111",
            background: null,
            fontFamily: FONT_MONO,
            weight: 900,
            maxSize: 82,
            minSize: 46,
            height: 115,
        });
        drawOpenMenu(context, universal ? 250 : 325, {
            color: "#111111",
            fontFamily: FONT_BOLD,
            size: 54,
            weight: 900,
        });
        roundedRect(context, 420, universal ? 300 : 375, 240, 10, 5, accent);
        drawQrCard(context, qrCode, universal ? 390 : 460, {
            shadow: false,
            radius: 28,
            borderColor: "#111111",
            borderWidth: 5,
        });
    } else if (template === "gradient") {
        const gradient = context.createLinearGradient(40, 40, 1040, 1560);
        gradient.addColorStop(0, accent);
        gradient.addColorStop(0.52, shade(accent, -58));
        gradient.addColorStop(1, "#0B1220");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 1080, 1600);

        context.fillStyle = "rgba(255,255,255,.10)";
        context.beginPath();
        context.arc(865, 160, 320, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "rgba(255,255,255,.06)";
        context.beginPath();
        context.arc(120, 1460, 390, 0, Math.PI * 2);
        context.fill();

        drawTableName(context, title, 150, {
            foreground: "#FFFFFF",
            background: "rgba(255,255,255,.12)",
            fontFamily: FONT_EDITORIAL,
            weight: 700,
            maxSize: 82,
            minSize: 46,
            italic: true,
            height: 116,
            radius: 58,
            shadow: true,
        });
        drawOpenMenu(context, universal ? 260 : 340, {
            color: "#FFFFFF",
            fontFamily: FONT_GEOMETRIC,
            size: 55,
            weight: 800,
        });
        drawQrCard(context, qrCode, universal ? 405 : 480, {
            shadow: true,
            radius: 68,
            borderColor: "rgba(255,255,255,.45)",
            borderWidth: 5,
        });
    } else if (template === "minimal") {
        context.fillStyle = "#FCFCFA";
        context.fillRect(0, 0, 1080, 1600);
        context.fillStyle = accent;
        context.fillRect(0, 0, 20, 1600);

        context.strokeStyle = alpha(accent, 0.35);
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(250, universal ? 275 : 350);
        context.lineTo(830, universal ? 275 : 350);
        context.stroke();

        drawTableName(context, title, 145, {
            foreground: "#111827",
            background: null,
            fontFamily: FONT_EDITORIAL,
            weight: 700,
            maxSize: 104,
            minSize: 54,
            height: 125,
        });
        drawOpenMenu(context, universal ? 220 : 305, {
            color: "#4B5563",
            fontFamily: FONT_CLEAN,
            size: 48,
            weight: 700,
        });
        drawQrCard(context, qrCode, universal ? 390 : 455, {
            shadow: false,
            radius: 0,
            borderColor: "#E5E7EB",
            borderWidth: 3,
        });
    }

    await saveCanvas(canvas, fileName);
}
