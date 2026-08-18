import type { ReactNode } from "react";

export default function MestreLayout({ children }: { children: ReactNode }) {
    return <div className="mestre-responsive">{children}</div>;
}
