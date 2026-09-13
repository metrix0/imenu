import type { ScriptableContext } from "chart.js";

export const CHART_BRAND = "#c93f0b";
export const CHART_FONT = { family: "iFoodRCTextos, 'Segoe UI', sans-serif", size: 12 };
export const CHART_CATEGORY_AXIS = {
    grid: { display: false },
    border: { display: false },
    ticks: { color: "#626973", font: CHART_FONT, maxRotation: 0, autoSkip: true, maxTicksLimit: 8, padding: 8 },
};
export const CHART_VALUE_AXIS = {
    beginAtZero: true,
    grid: { color: "#e2e5e9", drawTicks: false },
    border: { display: false, dash: [3, 4] },
    ticks: { color: "#626973", font: CHART_FONT, padding: 10, maxTicksLimit: 6 },
};
export const CHART_LEGEND = {
    position: "bottom" as const,
    labels: { color: "#626973", font: CHART_FONT, usePointStyle: true, pointStyle: "circle" as const, boxWidth: 8, boxHeight: 8, padding: 18 },
};

export const STANDARD_CHART_TOOLTIP = {
    backgroundColor: "#1d1d1d",
    titleColor: "#ffffff",
    bodyColor: "#f7f8fa",
    footerColor: "#e2e5e9",
    padding: 12,
    cornerRadius: 10,
    displayColors: false,
    caretPadding: 8,
    titleFont: { ...CHART_FONT, weight: 500 as const },
    bodyFont: CHART_FONT,
    footerFont: CHART_FONT,
    titleMarginBottom: 8,
    bodySpacing: 5,
};

export function createBrandAreaGradient(
    context: ScriptableContext<"line">
): CanvasGradient | string {
    const { chart } = context;
    const { ctx, chartArea } = chart;

    if (!chartArea) {
        return "rgba(201, 63, 11, 0.12)";
    }

    const gradient = ctx.createLinearGradient(
        0,
        chartArea.top,
        0,
        chartArea.bottom
    );
    gradient.addColorStop(0, "rgba(201, 63, 11, 0.16)");
    gradient.addColorStop(0.55, "rgba(201, 63, 11, 0.05)");
    gradient.addColorStop(1, "rgba(201, 63, 11, 0)");
    return gradient;
}
