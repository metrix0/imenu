// app/dev/layout.tsx
import { ReactNode } from "react";

export default function DevLayout({ children }: { children: ReactNode }) {
    // if (process.env.NODE_ENV !== "development") {
    //     return (
    //         <div style={{ padding: 50, textAlign: "center", color: "red" }}>
    //             ❌ This page is for development only
    //         </div>
    //     );
    // }

    return <>{children}</>;
}
