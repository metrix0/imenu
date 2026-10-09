import type { ReactNode } from "react";
import PanelAppearance from "@/components/ui/PanelAppearance";
import "../painel/essencial.css";

export default function MotoboyLayout({ children }: { children: ReactNode }) {
    return <PanelAppearance>{children}</PanelAppearance>;
}
