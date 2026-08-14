"use client";

import AiDescriptionTool from "@/components/common/restaurant-tools/AiDescriptionTool";
import { CalculatorTool } from "@/components/common/restaurant-tools/CalculatorTools";
import DigitalMenuTool from "@/components/common/restaurant-tools/DigitalMenuTool";
import QrCodeTool from "@/components/common/restaurant-tools/QrCodeTool";

export default function RestaurantToolRenderer({ tool }: { tool: string }) {
    if (tool === "gerador-qr-code-cardapio") return <QrCodeTool />;
    if (tool === "gerador-cardapio-digital") return <DigitalMenuTool />;
    if (tool === "gerador-descricao-produto-ia") return <AiDescriptionTool />;
    return <CalculatorTool tool={tool} />;
}
