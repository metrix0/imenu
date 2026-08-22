"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

type Verification = {
    type?: string;
    domain?: string;
    value?: string;
};

type CustomDomainModalProps = {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    initialDomain?: string | null;
};

export default function CustomDomainModal({
    open,
    onClose,
    restaurantId,
    initialDomain,
}: CustomDomainModalProps) {
    const [domain, setDomain] = useState(initialDomain || "");
    const [savedDomain, setSavedDomain] = useState(initialDomain || "");
    const [verified, setVerified] = useState(false);
    const [verification, setVerification] = useState<Verification[]>([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const connectDomain = async () => {
        setSaving(true);
        setError("");

        try {
            const response = await fetch(
                `/api/restaurants/${restaurantId}/domain`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ domain }),
                }
            );
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(
                    payload?.error || "Não foi possível conectar este domínio."
                );
            }

            setDomain(payload.domain);
            setSavedDomain(payload.domain);
            setVerified(Boolean(payload.verified));
            setVerification(
                Array.isArray(payload.verification)
                    ? payload.verification
                    : []
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Não foi possível conectar este domínio."
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal open={open} onClose={onClose} className="max-w-lg">
            <div className="border-b border-gray-200 px-6 py-5">
                <h2 className="text-xl font-bold text-gray-900">
                    Usar meu domínio
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Use seu próprio domínio para abrir o cardápio.
                </p>
            </div>

            <div className="space-y-5 px-6 py-6">
                <Input
                    label="Domínio"
                    placeholder="cardapio.seudominio.com.br"
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    autoComplete="off"
                />

                {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {savedDomain && !error && (
                    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                        <p className="font-medium text-gray-900">
                            {verified
                                ? "Domínio conectado."
                                : "Domínio adicionado. Configure o DNS para concluir."}
                        </p>

                        {!verified && (
                            <>
                                <p>
                                    Domínio principal: registro A para
                                    76.76.21.21. Subdomínio: registro CNAME para
                                    cname.vercel-dns-0.com.
                                </p>
                                {verification.map((item, index) => (
                                    <div
                                        key={`${item.type}-${item.domain}-${index}`}
                                        className="break-all rounded border border-gray-200 bg-white p-3"
                                    >
                                        <b>{item.type || "TXT"}</b>{" "}
                                        {item.domain || savedDomain}: {item.value}
                                    </div>
                                ))}
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <Button type="button" variant="secondary" onClick={onClose}>
                    Fechar
                </Button>
                <Button
                    type="button"
                    loading={saving}
                    onClick={() => void connectDomain()}
                >
                    Conectar domínio
                </Button>
            </div>
        </Modal>
    );
}
