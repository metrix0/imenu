import type { ScriptableContext } from "chart.js";

export const CHART_BRAND = "#f14400";

export const STANDARD_CHART_TOOLTIP = {
    backgroundColor: "#111827",
    titleColor: "#ffffff",
    bodyColor: "#e5e7eb",
    footerColor: "#d1d5db",
    padding: 12,
    cornerRadius: 10,
    displayColors: false,
    caretPadding: 8,
};

export function createBrandAreaGradient(
    context: ScriptableContext<"line">
): CanvasGradient | string {
    const { chart } = context;
    const { ctx, chartArea } = chart;

    if (!chartArea) {
        return "rgba(241, 68, 0, 0.16)";
    }

    const gradient = ctx.createLinearGradient(
        0,
        chartArea.top,
        0,
        chartArea.bottom
    );
    gradient.addColorStop(0, "rgba(241, 68, 0, 0.28)");
    gradient.addColorStop(0.55, "rgba(241, 68, 0, 0.10)");
    gradient.addColorStop(1, "rgba(241, 68, 0, 0)");
    return gradient;
}
