import type { ReactNode } from "react";

import PanelAppearance from "@/components/ui/PanelAppearance";
import "../painel/essencial.css";

export default function GarcomLayout({ children }: { children: ReactNode }) {
    return <PanelAppearance>{children}</PanelAppearance>;
}
