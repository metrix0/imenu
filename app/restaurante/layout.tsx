// app/layout.tsx

import SupportButton from "@/components/SupportButton";

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html>
        <body>
        {children}
        <SupportButton />
        </body>
        </html>
    );
}
