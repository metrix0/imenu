import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { normalizeAffiliateCode } from "@/lib/analytics/affiliateCode";
import AffiliateDashboard from "./AffiliateDashboard";

export const metadata: Metadata = {
    title: "Painel do afiliado | iMenu",
    robots: { index: false, follow: false },
};

export default async function AffiliatePage({ params }: { params: Promise<{ code: string }> }) {
    const code = normalizeAffiliateCode((await params).code);
    if (!code) notFound();

    return <div className="min-h-screen bg-[#f7f8fa] text-[#1d1d1d]">
        <header className="border-b border-[#e2e5e9] bg-white">
            <div className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
                <Image src="/logos/CombinationMarkLogo_Brand.png" alt="iMenu" width={115} height={25} className="h-6 w-auto" />
            </div>
        </header>
        <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
            <h1 className="text-2xl font-semibold sm:text-3xl">Painel do afiliado</h1>
            <AffiliateDashboard key={code} code={code} />
        </main>
    </div>;
}
