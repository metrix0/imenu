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
    const size = 90;
    context.fillStyle = "#FFF7ED";
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
    shadow = true
) {
    context.save();
    if (shadow) {
        context.shadowColor = "rgba(15, 23, 42, 0.18)";
        context.shadowBlur = 42;
        context.shadowOffsetY = 16;
    }
    roundedRect(context, 160, y, 760, 760, 56, "#FFFFFF");
    context.restore();
    context.drawImage(qrCode, 215, y + 55, 650, 650);
}

function drawTitleBadge(
    context: CanvasRenderingContext2D,
    title: string,
    y: number,
    background: string,
    foreground: string
) {
    if (!title.trim() || title.trim().toLowerCase() === "universal") return;
    const size = fitTextSize(context, title, 760, 72, 44, 800);
    context.font = `800 ${size}px ${FONT_FAMILY}`;
    const width = Math.min(870, Math.max(320, context.measureText(title).width + 120));
    roundedRect(context, (1080 - width) / 2, y, width, 108, 54, background);
    context.fillStyle = foreground;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(title, 540, y + 54, width - 70);
}

function drawFooter(
    context: CanvasRenderingContext2D,
    displayUrl: string,
    textColor: string,
    mutedColor: string,
    badgeBackground: string
) {
    const cleanDisplayUrl = displayUrl
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "");
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    context.fillStyle = mutedColor;
    context.font = `600 27px ${FONT_FAMILY}`;
    context.fillText("Ou acesse pelo link", 540, 1390);

    const urlFontSize = fitTextSize(context, cleanDisplayUrl, 790, 30, 20, 800);
    context.font = `800 ${urlFontSize}px ${FONT_FAMILY}`;
    const textWidth = context.measureText(cleanDisplayUrl).width;
    const width = Math.min(900, Math.max(360, textWidth + 90));
    roundedRect(context, (1080 - width) / 2, 1423, width, 82, 41, badgeBackground);
    context.fillStyle = textColor;
    context.textBaseline = "middle";
    context.fillText(cleanDisplayUrl, 540, 1464, width - 60);
}

export async function downloadQrDesign({
    qrValue,
    displayUrl,
    title,
    bannerUrl,
    logoUrl,
    fileName,
    template = "classic",
    accentColor,
}: DownloadQrDesignOptions): Promise<void> {
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

    if (template === "dark") {
        context.fillStyle = "#090D16";
        context.fillRect(0, 0, 1080, 1600);
        context.fillStyle = alpha(accent, 0.14);
        context.beginPath();
        context.arc(930, 140, 330, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = alpha(accent, 0.09);
        context.beginPath();
        context.arc(100, 1390, 280, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = accent;
        context.fillRect(0, 0, 1080, 18);
        context.fillStyle = "#FFFFFF";
        context.font = `900 74px ${FONT_FAMILY}`;
        context.fillText("ABRIR CARDÁPIO", 540, 235, 900);
        drawTitleBadge(context, title, 310, alpha(accent, 0.18), "#FFFFFF");
        drawQrCard(context, qrCode, 470);
        drawFooter(context, displayUrl, "#FFFFFF", "#94A3B8", alpha(accent, 0.2));
    } else if (template === "banner") {
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, 1080, 1600);
        if (banner) {
            context.save();
            context.beginPath();
            context.rect(0, 0, 1080, 455);
            context.clip();
            drawCoverImage(context, banner, 0, 0, 1080, 455);
            context.restore();
        } else {
            context.fillStyle = accent;
            context.fillRect(0, 0, 1080, 455);
        }
        const overlay = context.createLinearGradient(0, 0, 0, 455);
        overlay.addColorStop(0, "rgba(0,0,0,.08)");
        overlay.addColorStop(1, "rgba(0,0,0,.58)");
        context.fillStyle = overlay;
        context.fillRect(0, 0, 1080, 455);
        context.fillStyle = "#FFFFFF";
        context.font = `900 76px ${FONT_FAMILY}`;
        context.fillText("SEU PEDIDO COMEÇA AQUI", 540, 215, 930);
        drawTitleBadge(context, title, 310, "rgba(255,255,255,.94)", "#111827");
        drawQrCard(context, qrCode, 500);
        context.fillStyle = accent;
        roundedRect(context, 430, 1300, 220, 12, 6, accent);
        drawFooter(context, displayUrl, "#111827", "#6B7280", "#F3F4F6");
    } else if (template === "logo") {
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, 1080, 1600);
        context.fillStyle = alpha(accent, 0.09);
        context.fillRect(0, 0, 1080, 420);
        context.fillStyle = accent;
        context.fillRect(0, 0, 1080, 18);
        if (logo) {
            roundedRect(context, 335, 70, 410, 170, 36, "#FFFFFF");
            drawContainImage(context, logo, 380, 95, 320, 120);
        } else {
            context.fillStyle = accent;
            context.font = `900 58px ${FONT_FAMILY}`;
            context.fillText("SUA MARCA", 540, 150, 780);
        }
        context.fillStyle = "#111827";
        context.font = `900 62px ${FONT_FAMILY}`;
        context.fillText("ESCANEIE E PEÇA", 540, 320, 900);
        drawTitleBadge(context, title, 370, accent, "#FFFFFF");
        drawQrCard(context, qrCode, 510);
        drawFooter(context, displayUrl, "#111827", "#6B7280", alpha(accent, 0.1));
    } else if (template === "xadrez") {
        drawChecker(context, accent);
        context.fillStyle = "rgba(255,255,255,.96)";
        roundedRect(context, 90, 85, 900, 1430, 70, "rgba(255,255,255,.96)");
        context.fillStyle = "#111827";
        context.font = `900 70px ${FONT_FAMILY}`;
        context.fillText("PEÇA PELO QR CODE", 540, 220, 850);
        drawTitleBadge(context, title, 305, accent, "#FFFFFF");
        drawQrCard(context, qrCode, 470, false);
        drawFooter(context, displayUrl, "#111827", "#6B7280", alpha(accent, 0.13));
    } else if (template === "gradient") {
        const gradient = context.createLinearGradient(40, 40, 1040, 1560);
        gradient.addColorStop(0, accent);
        gradient.addColorStop(0.55, shade(accent, -65));
        gradient.addColorStop(1, "#0F172A");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 1080, 1600);
        context.fillStyle = "rgba(255,255,255,.08)";
        context.beginPath();
        context.arc(850, 210, 300, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = "#FFFFFF";
        context.font = `900 70px ${FONT_FAMILY}`;
        context.fillText("SEU CARDÁPIO, NA MESA", 540, 220, 920);
        drawTitleBadge(context, title, 310, "rgba(255,255,255,.16)", "#FFFFFF");
        drawQrCard(context, qrCode, 470);
        drawFooter(context, displayUrl, "#FFFFFF", "rgba(255,255,255,.72)", "rgba(255,255,255,.14)");
    } else if (template === "minimal") {
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, 1080, 1600);
        context.fillStyle = accent;
        context.fillRect(0, 0, 22, 1600);
        context.fillStyle = alpha(accent, 0.08);
        context.fillRect(22, 0, 1058, 360);
        context.fillStyle = "#111827";
        context.font = `900 34px ${FONT_FAMILY}`;
        context.fillText("CARDÁPIO DIGITAL", 540, 125, 800);
        context.font = `900 74px ${FONT_FAMILY}`;
        context.fillText("APONTE. ESCANEIE. PEÇA.", 540, 230, 900);
        drawTitleBadge(context, title, 330, "#111827", "#FFFFFF");
        drawQrCard(context, qrCode, 490, false);
        drawFooter(context, displayUrl, "#111827", "#9CA3AF", "#F9FAFB");
    } else {
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, 1080, 1600);
        if (banner) {
            context.save();
            context.beginPath();
            context.rect(0, 0, 1080, 390);
            context.clip();
            context.filter = "blur(10px)";
            drawCoverImage(context, banner, -20, -20, 1120, 430);
            context.restore();
            context.fillStyle = "rgba(0,0,0,.28)";
            context.fillRect(0, 0, 1080, 390);
        } else {
            context.fillStyle = accent;
            context.fillRect(0, 0, 1080, 390);
        }
        drawTitleBadge(context, title, 135, "rgba(255,255,255,.95)", "#111827");
        context.fillStyle = "#111827";
        context.font = `900 78px ${FONT_FAMILY}`;
        context.fillText("Abrir cardápio", 540, 505, 900);
        context.fillStyle = accent;
        roundedRect(context, 450, 550, 180, 10, 5, accent);
        drawQrCard(context, qrCode, 605, false);
        drawFooter(context, displayUrl, "#111827", "#6B7280", "#F3F4F6");
    }

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
