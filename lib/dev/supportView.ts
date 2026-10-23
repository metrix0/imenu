import type { Connection } from "@/lib/dev/supportTypes";

export function formatPhone(value: string | null): string {
    const digits = String(value || "").replace(/\D/g, "");
    const local = digits.startsWith("55") ? digits.slice(2) : digits;

    if (local.length === 11) {
        return (
            "(" +
            local.slice(0, 2) +
            ") " +
            local.slice(2, 7) +
            "-" +
            local.slice(7)
        );
    }

    if (local.length === 10) {
        return (
            "(" +
            local.slice(0, 2) +
            ") " +
            local.slice(2, 6) +
            "-" +
            local.slice(6)
        );
    }

    return value || "—";
}

export function getWhatsappUrl(value: string | null): string | null {
    let digits = String(value || "").replace(/\D/g, "");
    if (!digits) return null;
    if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
        digits = "55" + digits;
    }
    return "https://wa.me/" + digits;
}

export function statusPresentation(connection: Connection | null) {
    if (!connection || connection.desired_state === "disconnected") {
        return {
            label: "Não conectado",
            className: "bg-gray-100 text-gray-600",
        };
    }

    if (connection.status === "WORKING") {
        return {
            label: "Conectado",
            className: "bg-green-50 text-green-700",
        };
    }

    if (connection.status === "SCAN_QR_CODE") {
        return {
            label: "Escaneie o QR",
            className: "bg-blue-50 text-blue-700",
        };
    }

    if (connection.status === "FAILED") {
        return {
            label: "Falhou",
            className: "bg-red-50 text-red-700",
        };
    }

    return {
        label: "Conectando",
        className: "bg-amber-50 text-amber-700",
    };
}
