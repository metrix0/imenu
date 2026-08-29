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

function isUniversalTitle(title: string) {
    return !title.trim() || title.trim().toLowerCase() === "universal";
}

function drawTableName(
    context: CanvasRenderingContext2D,
    title: string,
    y: number,
    background: string,
    foreground: string
) {
    if (isUniversalTitle(title)) return;
    const size = fitTextSize(context, title, 760, 72, 44, 800);
    context.font = `800 ${size}px ${FONT_FAMILY}`;
    const width = Math.min(870, Math.max(320, context.measureText(title).width + 120));
    roundedRect(context, (1080 - width) / 2, y, width, 108, 54, background);
    context.fillStyle = foreground;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(title, 540, y + 54, width - 70);
}

function drawOpenMenu(
    context: CanvasRenderingContext2D,
    y: number,
    color: string,
    size = 74
) {
    context.fillStyle = color;
    context.font = `900 ${size}px ${FONT_FAMILY}`;
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
        drawOpenMenu(context, 230, "#FFFFFF");
        drawTableName(context, title, 315, alpha(accent, 0.18), "#FFFFFF");
        drawQrCard(context, qrCode, isUniversalTitle(title) ? 420 : 485);
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
        drawTableName(context, title, 175, "rgba(255,255,255,.94)", "#111827");
        drawOpenMenu(context, isUniversalTitle(title) ? 500 : 480, "#111827", 72);
        drawQrCard(context, qrCode, isUniversalTitle(title) ? 585 : 570);
    } else if (template === "logo") {
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, 1080, 1600);
        context.fillStyle = alpha(accent, 0.09);
        context.fillRect(0, 0, 1080, 360);
        context.fillStyle = accent;
        context.fillRect(0, 0, 1080, 18);
        if (logo) {
            roundedRect(context, 335, 55, 410, 145, 36, "#FFFFFF");
            drawContainImage(context, logo, 380, 75, 320, 105);
        }
        drawOpenMenu(context, 300, "#111827", 68);
        drawTableName(context, title, 370, accent, "#FFFFFF");
        drawQrCard(context, qrCode, isUniversalTitle(title) ? 430 : 500);
    } else if (template === "xadrez") {
        drawChecker(context, accent);
        roundedRect(context, 90, 85, 900, 1430, 70, "rgba(255,255,255,.96)");
        drawOpenMenu(context, 215, "#111827", 70);
        drawTableName(context, title, 300, accent, "#FFFFFF");
        drawQrCard(context, qrCode, isUniversalTitle(title) ? 405 : 470, false);
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
        drawOpenMenu(context, 215, "#FFFFFF", 70);
        drawTableName(context, title, 300, "rgba(255,255,255,.16)", "#FFFFFF");
        drawQrCard(context, qrCode, isUniversalTitle(title) ? 405 : 470);
    } else if (template === "minimal") {
        context.fillStyle = "#FFFFFF";
        context.fillRect(0, 0, 1080, 1600);
        context.fillStyle = accent;
        context.fillRect(0, 0, 22, 1600);
        context.fillStyle = alpha(accent, 0.08);
        context.fillRect(22, 0, 1058, 360);
        drawOpenMenu(context, 215, "#111827", 70);
        drawTableName(context, title, 300, "#111827", "#FFFFFF");
        drawQrCard(context, qrCode, isUniversalTitle(title) ? 405 : 470, false);
    }

    await saveCanvas(canvas, fileName);
}
