"use client";

import { useCallback, useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

type Verification = {
    type?: string;
    domain?: string;
    value?: string;
};

type DomainStatus = {
    domain?: string | null;
    added?: boolean;
    verified?: boolean;
    configured?: boolean;
    configurationChecked?: boolean;
    verification?: Verification[];
    dns?: {
        type?: string;
        name?: string;
        value?: string;
    } | null;
    error?: string;
};

type CustomDomainModalProps = {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    initialDomain?: string | null;
    onDomainChange?: (domain: string) => void;
};

async function fetchDomainStatus(restaurantId: string): Promise<DomainStatus> {
    const response = await fetch(`/api/restaurants/${restaurantId}/domain`, {
        cache: "no-store",
    });
    const payload = (await response.json()) as DomainStatus;

    if (!response.ok) {
        throw new Error(
            payload.error || "Não foi possível verificar este domínio."
        );
    }

    return payload;
}

export default function CustomDomainModal({
    open,
    onClose,
    restaurantId,
    initialDomain,
    onDomainChange,
}: CustomDomainModalProps) {
    const [domain, setDomain] = useState(initialDomain || "");
    const [savedDomain, setSavedDomain] = useState(initialDomain || "");
    const [status, setStatus] = useState<DomainStatus | null>(null);
    const [saving, setSaving] = useState(false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState("");
    const domainUnchanged =
        Boolean(savedDomain) &&
        domain.trim().toLowerCase() === savedDomain;

    const applyStatus = useCallback(
        (payload: DomainStatus) => {
            const nextDomain =
                typeof payload.domain === "string" ? payload.domain : "";
            setStatus(payload);
            setSavedDomain(nextDomain);
            setDomain(nextDomain);
            onDomainChange?.(nextDomain);
        },
        [onDomainChange]
    );

    useEffect(() => {
        if (!open) return;

        setDomain(initialDomain || "");
        setSavedDomain(initialDomain || "");
        setError("");

        if (!initialDomain) {
            setStatus(null);
            return;
        }

        let active = true;
        setChecking(true);
        void fetchDomainStatus(restaurantId)
            .then((payload) => {
                if (active) applyStatus(payload);
            })
            .catch((caught) => {
                if (active) {
                    setError(
                        caught instanceof Error
                            ? caught.message
                            : "Não foi possível verificar este domínio."
                    );
                }
            })
            .finally(() => {
                if (active) setChecking(false);
            });

        return () => {
            active = false;
        };
    }, [applyStatus, initialDomain, open, restaurantId]);

    const checkDomainStatus = async () => {
        setChecking(true);
        setError("");
        try {
            applyStatus(await fetchDomainStatus(restaurantId));
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Não foi possível verificar este domínio."
            );
        } finally {
            setChecking(false);
        }
    };

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
            const payload = (await response.json()) as DomainStatus;

            if (!response.ok) {
                throw new Error(
                    payload?.error || "Não foi possível conectar este domínio."
                );
            }

            applyStatus(payload);
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

    const disconnectDomain = async () => {
        if (
            !window.confirm(
                "Desconectar este domínio? O cardápio deixará de abrir por ele."
            )
        ) {
            return;
        }

        setSaving(true);
        setError("");

        try {
            const response = await fetch(
                `/api/restaurants/${restaurantId}/domain`,
                { method: "DELETE" }
            );
            const payload = (await response.json()) as DomainStatus;

            if (!response.ok) {
                throw new Error(
                    payload?.error ||
                        "Não foi possível desconectar este domínio."
                );
            }

            applyStatus(payload);
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Não foi possível desconectar este domínio."
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
                    placeholder="seudominio.com.br"
                    value={domain}
                    onChange={(event) => setDomain(event.target.value)}
                    autoComplete="off"
                />

                {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {savedDomain && (
                    <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                            <span
                                className={`h-2.5 w-2.5 rounded-full ${
                                    status?.configured
                                        ? "bg-green-500"
                                        : "bg-amber-500"
                                }`}
                            />
                            <p className="font-medium text-gray-900">
                                {checking
                                    ? "Verificando domínio..."
                                    : status?.configured
                                      ? "Domínio conectado"
                                      : status?.verified
                                        ? "Configuração de DNS pendente"
                                        : "Verificação do domínio pendente"}
                            </p>
                        </div>
                        <p className="break-all font-medium">{savedDomain}</p>

                        {!checking && status?.added === false && (
                            <p>
                                Este domínio ainda não está vinculado ao projeto
                                iMenu na Vercel. Clique em Conectar domínio.
                            </p>
                        )}

                        {!checking && status?.added !== false && !status?.configured && (
                            <>
                                {status?.dns && (
                                    <div className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2 rounded border border-gray-200 bg-white p-3">
                                        <div>
                                            <p className="text-xs text-gray-500">Tipo</p>
                                            <b>{status.dns.type}</b>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Nome</p>
                                            <b>{status.dns.name}</b>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs text-gray-500">Valor</p>
                                            <b className="break-all">{status.dns.value}</b>
                                        </div>
                                    </div>
                                )}
                                <p>
                                    No provedor do domínio, crie ou substitua o
                                    registro acima e remova registros A, AAAA,
                                    CNAME ou ALIAS conflitantes.
                                </p>
                                <p>
                                    Não altere registros MX ou TXT usados pelo
                                    e-mail.
                                </p>
                                {status?.configurationChecked === false && (
                                    <p>
                                        Não foi possível confirmar o DNS agora.
                                        Verifique novamente em alguns minutos.
                                    </p>
                                )}
                                {status?.verification?.map((item, index) => (
                                    <div
                                        key={`${item.type}-${item.domain}-${index}`}
                                        className="break-all rounded border border-gray-200 bg-white p-3"
                                    >
                                        <p className="mb-1 text-xs text-gray-500">
                                            Verificação de propriedade
                                        </p>
                                        <b>{item.type || "TXT"}</b>{" "}
                                        {item.domain || savedDomain}: {item.value}
                                    </div>
                                ))}
                            </>
                        )}

                        {!checking && status?.configured && (
                            <p>O DNS está configurado e o domínio está ativo.</p>
                        )}

                        <Button
                            type="button"
                            variant="secondary"
                            loading={checking}
                            onClick={() => void checkDomainStatus()}
                            className="py-1.5 text-sm"
                        >
                            Verificar novamente
                        </Button>
                    </div>
                )}
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
                <Button type="button" variant="secondary" onClick={onClose}>
                    Fechar
                </Button>
                {domainUnchanged ? (
                    <Button
                        type="button"
                        variant="secondary"
                        loading={saving}
                        onClick={() => void disconnectDomain()}
                    >
                        Desconectar
                    </Button>
                ) : (
                    <Button
                        type="button"
                        loading={saving}
                        onClick={() => void connectDomain()}
                    >
                        {savedDomain
                            ? "Atualizar domínio"
                            : "Conectar domínio"}
                    </Button>
                )}
            </div>
        </Modal>
    );
}
