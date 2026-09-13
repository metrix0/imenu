"use client";

import { createContext, useContext, type ReactNode } from "react";

const PanelAppearanceContext = createContext(false);

export function usePanelAppearance() {
    return useContext(PanelAppearanceContext);
}

export default function PanelAppearance({ children }: { children: ReactNode }) {
    return (
        <PanelAppearanceContext.Provider value={true}>
            <div className="panel-essencial">{children}</div>
        </PanelAppearanceContext.Provider>
    );
}
