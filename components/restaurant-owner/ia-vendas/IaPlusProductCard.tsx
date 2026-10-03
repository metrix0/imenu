"use client";
import Image from "next/image";
import Button from "@/components/ui/Button";
import { IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";
export default function IaPlusProductCard({ active, onLearnMore }: { active: boolean; onLearnMore: () => void }) {
  return <div className={`relative flex min-h-[320px] flex-col rounded-2xl border p-6 shadow-sm ${active ? "border-brand bg-[#fff1ea] ring-2 ring-brand/10" : "border-orange-200 bg-white"}`}>
    <div className="relative h-12 w-40"><Image src="/logos/IAPlusCombinationMarkLogo_Brand.png" alt="iMenu IA Plus" fill sizes="160px" className="object-contain object-left" /></div>
    <h3 className="mt-6 text-xl font-bold text-gray-900">iMenu IA Plus</h3>
    <p className="mt-2 text-sm leading-relaxed text-gray-600">Mais capacidade no Assistente IA e acesso completo às oportunidades da Análise de vendas.</p>
    <p className="mt-5 text-sm font-bold text-brand">{IA_PLUS_PRICE_LABEL}/mês</p>
    <p className="mt-3 text-sm text-gray-700">Descrições, imagens e mudanças para você revisar e aplicar.</p>
    <div className="mt-auto pt-7">{active ? <p className="text-sm font-semibold text-brand">iMenu IA Plus ativo</p> : <Button variant="secondary" className="w-full" onClick={onLearnMore}>Saiba mais</Button>}</div>
  </div>;
}
