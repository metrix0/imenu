"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChoiceCardGroup from "@/components/ui/ChoiceCardGroup";
import Textarea from "@/components/ui/Textarea";

const STORAGE_KEY = "imenu:account-deletion-feedback";
const REASONS = [
    { value: "missing_feature", label: "Faltou alguma funcionalidade" },
    { value: "technical_problems", label: "Tive problemas técnicos" },
    { value: "business_closed", label: "Encerrei meu negócio" },
    { value: "other", label: "Outro motivo" },
] as const;

type Reason = (typeof REASONS)[number]["value"];

export default function AccountDeletedPage() {
    const [token, setToken] = useState<string | null>(null);
    const [reason, setReason] = useState<Reason | "">("");
    const [feedback, setFeedback] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const requiresFeedback = reason === "missing_feature";

    useEffect(() => {
        try {
            const stored = sessionStorage.getItem(STORAGE_KEY);
            if (stored) {
                setToken(stored);
                return;
            }
        } catch {
            // The survey is optional.
        }
        window.location.replace("/restaurante");
    }, []);

    const finish = () => {
        try { sessionStorage.removeItem(STORAGE_KEY); } catch {}
        window.location.replace("/restaurante");
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!reason || !token || loading || (requiresFeedback && !feedback.trim())) return;
        setLoading(true);
        setError("");
        try {
            const response = await fetch("/api/auth/delete-account", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, reason, feedback }),
            });
            if (!response.ok) {
                setError(response.status === 401
                    ? "O prazo para enviar o feedback expirou."
                    : "Não foi possível enviar o feedback. Tente novamente.");
                return;
            }
            finish();
        } catch {
            setError("Não foi possível enviar o feedback. Tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    if (!token) return null;

    return (
        <div className="flex min-h-screen flex-col">
            <header className="flex w-full items-center justify-center bg-white px-4 py-6 sm:justify-start">
                <div className="relative h-8 w-32 sm:ml-4">
                    <Image src="/logos/CombinationMarkLogo_Brand.png" alt="iMenu" fill className="object-contain" />
                </div>
            </header>
            <main className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-8">
                <Card className="w-full max-w-lg space-y-5">
                    <div className="space-y-2">
                        <p className="text-sm text-gray-500">Sua conta foi excluída.</p>
                        <h1 className="text-xl font-semibold text-gray-900">Por que você decidiu deixar o iMenu?</h1>
                    </div>
                    <form onSubmit={submit} className="space-y-4">
                        <ChoiceCardGroup<Reason | "">
                            value={reason}
                            options={REASONS}
                            onChange={setReason}
                            disabled={loading}
                            aria-label="Motivo da exclusão"
                            className="!gap-2"
                        />
                        <div className="space-y-2">
                            <label htmlFor="exit-feedback" className="block text-sm font-medium text-gray-900">
                                {requiresFeedback ? "Qual funcionalidade fez falta?" : "O que poderíamos melhorar?"}
                                {!requiresFeedback && <span className="font-normal text-gray-500"> (opcional)</span>}
                            </label>
                            <Textarea
                                id="exit-feedback"
                                value={feedback}
                                onChange={(event) => setFeedback(event.target.value)}
                                required={requiresFeedback}
                                maxLength={2000}
                                rows={3}
                                disabled={loading}
                                className="w-full resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                            />
                        </div>
                        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button type="submit" loading={loading} disabled={!reason || loading || (requiresFeedback && !feedback.trim())} className="flex-1">
                                Enviar feedback
                            </Button>
                            <Button type="button" variant="secondary" disabled={loading} onClick={finish} className="sm:min-w-24">
                                Pular
                            </Button>
                        </div>
                    </form>
                </Card>
            </main>
        </div>
    );
}
