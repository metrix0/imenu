import type { ReactNode } from "react";

import PayoutTestActions from "@/components/dev/PayoutTestActions";

export default function PayoutTemplate({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
            <PayoutTestActions />
        </>
    );
}
