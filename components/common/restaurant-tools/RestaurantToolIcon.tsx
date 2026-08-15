import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBoxOpen,
    faCalculator,
    faChartLine,
    faClipboardList,
    faPercent,
    faQrcode,
    faReceipt,
    faTag,
    faTicket,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

const TOOL_ICONS = {
    "calculadora-taxas-ifood": faReceipt,
    "calculadora-preco-de-venda": faTag,
    "calculadora-margem-delivery": faChartLine,
    "gerador-qr-code-cardapio": faQrcode,
    "gerador-cardapio-digital": faClipboardList,
    "calculadora-ticket-medio": faTicket,
    "calculadora-comissao-delivery": faPercent,
    "calculadora-cmv": faCalculator,
    "calculadora-preco-combo": faBoxOpen,
    "gerador-descricao-produto-ia": faWandMagicSparkles,
} as const;

export default function RestaurantToolIcon({
    tool,
    className,
}: {
    tool: string;
    className?: string;
}) {
    const icon = TOOL_ICONS[tool as keyof typeof TOOL_ICONS] ?? faCalculator;

    return <FontAwesomeIcon icon={icon} className={className} />;
}
