export default function PainelLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="pt-BR">
        <body className="min-h-screen bg-white text-gray-900">
        {children}
        </body>
        </html>
    );
}