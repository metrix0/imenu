import { Suspense } from "react";
import MenuSkeleton from "./loading"; // wherever you stored it

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<MenuSkeleton />}>
            {children}
        </Suspense>
    );
}