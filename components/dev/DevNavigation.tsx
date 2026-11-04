"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [["Dashboard", "/dev"], ["Health", "/dev/health"], ["CRM", "/dev/crm"], ["Blast", "/dev/blast"], ["Messages", "/dev/messages"], ["Payouts", "/dev/payouts"], ["Support", "/dev/support"], ["Analytics", "/dev/analytics"]] as const;

export default function DevNavigation() {
    const path = usePathname();
    return <nav aria-label="Administração iMenu" className="sticky top-0 z-30 border-b border-[#e2e5e9] bg-white px-4 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] items-center gap-6">
            <Link href="/dev" className="shrink-0 py-4 font-semibold text-[#d93d00]">iMenu</Link>
            <div className="flex min-w-0 gap-5 overflow-x-auto whitespace-nowrap">
                {sections.map(([label, href]) => <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={`border-b-2 py-4 text-sm font-medium ${path === href ? "border-[#d93d00] text-[#c43700]" : "border-transparent text-[#626973] hover:text-[#1d1d1d]"}`}>{label}</Link>)}
            </div>
        </div>
    </nav>;
}
