"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCheck,
    faCopy,
    faPenNib,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Dropdown from "@/components/ui/Dropdown";
import Input from "@/components/ui/Input";
import { Notice, ToolPanel } from "@/components/common/restaurant-tools/ToolUi";

type GeneratedDescriptions = {
    descriptions: string[];
    shortDescription: string;
    keywords: string[];
};

export default function AiDescriptionTool() {
    const [name, setName] = useState("");
    const [details, setDetails] = useState("");
    const [category, setCategory] = useState("Lanche");
    const [tone, setTone] = useState("apetitoso");
    const [differential, setDifferential] = useState("");
    const [result, setResult] = useState<GeneratedDescriptions | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [copied, setCopied] = useState("");

    const generate = async () => {
        if (name.trim().length < 2 || details.trim().length < 5) {
            setError("Informe o nome e os ingredientes ou detalhes reais do produto.");
            return;
        }

        setLoading(true);
        setError("");
        setCopied("");

        try {
            const response = await fetch("/api/tools/product-description", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, details, category, tone, differential }),
            });
            const payload = (await response.json()) as GeneratedDescriptions & { error?: string };
            if (!response.ok) throw new Error(payload.error || "Não foi possível gerar as descrições.");
            setResult(payload);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Não foi possível gerar as descrições.");
        } finally {
            setLoading(false);
        }
    };

    const copy = async (label: string, value: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
        } catch {
            setCopied("");
        }
    };

    return (
        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <ToolPanel title="Dados verdadeiros do produto" icon={faPenNib}>
                <div className="space-y-4">
                    <Input label="Nome do produto" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Ex.: X-Bacon Artesanal" />
                    <label className="block text-xs font-medium 2xl:text-base">
                        Ingredientes, preparo e tamanho
                        <textarea
                            value={details}
                            onChange={(event) => setDetails(event.target.value)}
                            maxLength={800}
                            rows={5}
                            placeholder="Ex.: pão brioche, hambúrguer bovino de 160 g, bacon crocante, queijo prato e maionese da casa"
                            className="mt-1 w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-3 outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                        />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Input label="Categoria" value={category} onChange={(event) => setCategory(event.target.value)} maxLength={80} />
                        <Dropdown
                            label="Tom da descrição"
                            value={tone}
                            onChange={(event) => setTone(event.target.value)}
                            options={[
                                { value: "apetitoso", label: "Apetitoso e direto" },
                                { value: "artesanal", label: "Artesanal" },
                                { value: "sofisticado", label: "Sofisticado" },
                                { value: "descontraido", label: "Descontraído" },
                                { value: "objetivo", label: "Objetivo" },
                            ]}
                        />
                    </div>
                    <Input label="Diferencial real (opcional)" value={differential} onChange={(event) => setDifferential(event.target.value)} maxLength={200} placeholder="Ex.: molho produzido diariamente" />
                    <Button type="button" className="w-full" loading={loading} onClick={() => void generate()}>
                        <FontAwesomeIcon icon={faWandMagicSparkles} className="mr-2 h-4 w-4" />
                        Gerar descrições
                    </Button>
                    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
                </div>
                <Notice>
                    Revise o texto e confira ingredientes, quantidades, alergênicos e restrições antes de publicar. A IA não substitui essa verificação.
                </Notice>
            </ToolPanel>

            <ToolPanel title="Descrições geradas" description="Escolha e adapte a versão que mais combina com o seu cardápio." icon={faWandMagicSparkles}>
                {result ? (
                    <div className="space-y-4">
                        {result.descriptions.map((description, index) => (
                            <article key={`${description}-${index}`} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <h3 className="font-semibold text-gray-900">Opção {index + 1}</h3>
                                    <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand hover:underline" onClick={() => void copy(`option-${index}`, description)}>
                                        <FontAwesomeIcon icon={copied === `option-${index}` ? faCheck : faCopy} className="h-3 w-3" />
                                        {copied === `option-${index}` ? "Copiado" : "Copiar"}
                                    </button>
                                </div>
                                <p className="mt-2 text-sm leading-6 text-gray-700">{description}</p>
                            </article>
                        ))}
                        <article className="rounded-xl border border-brand/25 bg-brand/5 p-4">
                            <div className="flex items-start justify-between gap-3">
                                <h3 className="font-semibold text-gray-900">Versão curta</h3>
                                <button type="button" className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand hover:underline" onClick={() => void copy("short", result.shortDescription)}>
                                    <FontAwesomeIcon icon={copied === "short" ? faCheck : faCopy} className="h-3 w-3" />
                                    {copied === "short" ? "Copiado" : "Copiar"}
                                </button>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-gray-700">{result.shortDescription}</p>
                        </article>
                        <div>
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Palavras-chave sugeridas</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {result.keywords.map((keyword) => <span key={keyword} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">{keyword}</span>)}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm leading-6 text-gray-500">
                        Preencha os dados ao lado para receber três descrições e uma versão curta.
                    </div>
                )}
            </ToolPanel>
        </div>
    );
}
