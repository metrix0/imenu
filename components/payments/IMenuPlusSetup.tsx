"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
    ArrowLeft, ArrowRight, Bot, CalendarClock, FileText, Moon, PackageCheck,
    Settings, ShoppingCart, Sparkles, TrendingUp, UserRoundCheck,
} from "lucide-react";

import { SupportWhatsappBadge } from "@/components/common/SupportButton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import ModalFlowStep from "@/components/ui/ModalFlowStep";
import SaveStatus from "@/components/ui/SaveStatus";
import ToggleOptionCard from "@/components/ui/ToggleOptionCard";
import { IA_PLUS_WHATSAPP_ORDERING } from "@/lib/addons/products";
import { nfceRequest } from "@/components/restaurant-owner/pedidos/NfceHistory";
import { crmRequest } from "@/lib/api/crm";
import { supabase } from "@/lib/database/supabaseClient";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";
import { AUTOMATION_KINDS, AUTOMATION_LABELS, type AutomationKind, type AutomationSettings } from "@/lib/services/crmRules";
import { useAutoSave } from "@/lib/utils/useAutoSave";

const CHECKOUT_STEPS = [
    { title: "Obrigado pela compra!", description: "Seu iMenu Plus está ativo! Ative os recursos automaticamente." },
    { title: "Marketing WhatsApp", description: "Escolha quais mensagens enviar automaticamente." },
    { title: "Robô WhatsApp", description: "Escolha como o robô pode ajudar no atendimento aos seus clientes." },
    { title: "Seu cardápio", description: "Personalize o visual e as recomendações do seu cardápio." },
    { title: "Explore seu iMenu Plus", description: "Você pode fazer os demais ajustes nas páginas do painel a qualquer momento." },
] as const;
const FINAL_STEP = CHECKOUT_STEPS.length - 1;

const SETTINGS = [
    { key: "habit", title: AUTOMATION_LABELS.habit, description: "Lembre o cliente de pedir no horário em que ele costuma comprar.", icon: CalendarClock, step: 1 },
    { key: "reactivation", title: AUTOMATION_LABELS.reactivation, description: "Convide clientes que estão há um tempo sem pedir a voltar.", icon: UserRoundCheck, step: 1 },
    { key: "cart", title: AUTOMATION_LABELS.cart, description: "Incentive clientes a finalizar pedidos deixados no carrinho.", icon: ShoppingCart, step: 1 },
    { key: "aiEnabled", title: IA_PLUS_WHATSAPP_ORDERING.title, description: IA_PLUS_WHATSAPP_ORDERING.description, icon: IA_PLUS_WHATSAPP_ORDERING.icon, step: 2 },
    { key: "orderNotificationsEnabled", title: "Atualizações de pedidos", description: "Avise quando o pedido estiver pronto ou sair para entrega.", icon: PackageCheck, step: 2 },
    { key: "upsell", title: "Upsell Automático", description: "Sugira itens complementares no carrinho.", icon: TrendingUp, step: 3 },
    { key: "darkMenu", title: "Cardápio com Tema Escuro", description: "Mostre o cardápio com o visual escuro para seus clientes.", icon: Moon, step: 3 },
    { key: "nfce", title: "Notas Fiscais", description: "Emita notas fiscais dos pedidos automaticamente, sem limites.", icon: FileText, step: 3 },
] as const;

const PANEL_SECTIONS = [
    { title: "Marketing WhatsApp", description: "Mensagens, ofertas e limites de envio", icon: CalendarClock },
    { title: "Robô WhatsApp", description: "Conexão e mensagens do robô", icon: Bot },
    { title: "Cardápio", description: "Fotos, vídeos e recomendações", icon: ShoppingCart },
    { title: "Configurações", description: "Tema e download do cardápio em PDF", icon: Settings },
    { title: "Assistente IA", description: "Converse sobre a sua loja", icon: Sparkles },
    { title: "Vendas IA", description: "Acompanhe as análises de vendas", icon: TrendingUp },
] as const;

type SettingKey = typeof SETTINGS[number]["key"];
type Values = Record<SettingKey, boolean>;
type MarketingReview = {
    choices: Pick<Values, AutomationKind>;
    unconfigured: AutomationKind[];
};
type FiscalSetup = { available: boolean; enabled: boolean; configured: boolean };
type FiscalSettings = { available: boolean; environment: number | null; issuer: { data: Record<string, unknown>; next_number: number } | null };
type Setup = { values: Values; connected: boolean; marketingReview: MarketingReview | null; fiscal: FiscalSetup };

function isMarketingSetting(key: SettingKey): key is AutomationKind {
    return AUTOMATION_KINDS.some((kind) => kind === key);
}

async function loadSetup(id: string): Promise<Setup> {
    const [marketing, whatsapp, upsell, restaurant, fiscal] = await Promise.all([
        crmRequest("/api/automations", id) as Promise<{ plus: boolean; settings: AutomationSettings; configuredKinds: AutomationKind[]; connected: boolean }>,
        crmRequest("/api/whatsapp/settings", id) as Promise<{ plus: boolean; aiEnabled: boolean; orderNotificationsEnabled: boolean }>,
        supabase.from("automatic_upsell").select("enabled").eq("restaurant_id", id).maybeSingle(),
        supabase.from("restaurants").select("dark_menu_enabled").eq("id", id).single(),
        nfceRequest(id, { action: "list" }).then(async response => await response.json() as FiscalSetup)
            .catch((): FiscalSetup => ({ available: false, enabled: false, configured: false })),
    ]);
    if (!marketing.plus || !whatsapp.plus) throw new Error("Os ajustes rápidos estão disponíveis com o iMenu Plus ativo.");
    if (upsell.error || restaurant.error) throw new Error("Não foi possível carregar as configurações do cardápio.");

    const unconfigured = AUTOMATION_KINDS.filter((kind) => !marketing.configuredKinds.includes(kind));
    const suggested = (kind: AutomationKind) => unconfigured.includes(kind) || marketing.settings[kind].enabled;
    return {
        connected: marketing.connected,
        fiscal,
        marketingReview: unconfigured.length ? {
            choices: { habit: suggested("habit"), reactivation: suggested("reactivation"), cart: suggested("cart") },
            unconfigured,
        } : null,
        values: {
            habit: marketing.settings.habit.enabled,
            reactivation: marketing.settings.reactivation.enabled,
            cart: marketing.settings.cart.enabled,
            aiEnabled: whatsapp.aiEnabled,
            orderNotificationsEnabled: whatsapp.orderNotificationsEnabled,
            upsell: upsell.data?.enabled === true,
            darkMenu: restaurant.data.dark_menu_enabled === true,
            nfce: fiscal.available && fiscal.enabled === true,
        },
    };
}

async function saveSetting(id: string, key: SettingKey, enabled: boolean) {
    if (key === "nfce") {
        const current = await nfceRequest(id, { action: "settings" }).then(async response => await response.json() as FiscalSettings);
        if (!current.available || !current.environment) throw new Error("A emissão fiscal está indisponível neste ambiente.");
        const form = new FormData();
        form.set("settings", JSON.stringify({
            ...(current.issuer?.data ?? {}),
            series: current.issuer?.data?.series ?? 1,
            nextNumber: current.issuer?.next_number ?? 1,
            enabled,
        }));
        await nfceRequest(id, { action: "settings" }, { method: "POST", body: form });
        return;
    }
    if (key === "upsell") {
        const { error } = await supabase.from("automatic_upsell").upsert(
            { restaurant_id: id, enabled },
            { onConflict: "restaurant_id" },
        );
        if (error) throw new Error("Não foi possível salvar o Upsell Automático.");
        return;
    }
    if (key === "darkMenu") {
        const response = await qrTableAuthenticatedFetch("/api/menu/dark-theme", {
            method: "PATCH",
            body: JSON.stringify({ restaurantId: id, enabled }),
        });
        if (!response.ok) throw new Error("Não foi possível salvar o tema do cardápio.");
        return;
    }
    const marketing = isMarketingSetting(key);
    await crmRequest(marketing ? "/api/automations" : "/api/whatsapp/settings", id, {
        method: "PATCH",
        body: JSON.stringify(marketing ? { kind: key, enabled } : { [key]: enabled }),
    });
}

type IMenuPlusSetupProps = {
    restaurantId: string | null;
    onClose: () => void;
    onSavingChange: (saving: boolean) => void;
};

export default function IMenuPlusSetup({ restaurantId, onClose, onSavingChange }: IMenuPlusSetupProps) {
    const [step, setStep] = useState(0);
    const [reverse, setReverse] = useState(false);
    const [animate, setAnimate] = useState(false);
    const [skippedSetup, setSkippedSetup] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const [setup, setSetup] = useState<Setup | null>(null);
    const [loadError, setLoadError] = useState("");
    const persisted = useRef<Partial<Values>>({});
    const heading = useRef<HTMLHeadingElement>(null);

    useEffect(() => {
        if (!restaurantId) return;
        let active = true;
        void loadSetup(restaurantId).then((data) => {
            if (!active) return;
            persisted.current = { ...data.values };
            setSetup(data);
        }).catch((error) => {
            if (active) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar as configurações.");
        });
        return () => { active = false; };
    }, [restaurantId, attempt]);

    const save = useAutoSave<Values>(restaurantId, async (values) => {
        if (!restaurantId) throw new Error("Restaurante não encontrado.");
        let failure: unknown;
        for (const { key } of SETTINGS) {
            const value = values[key];
            if (persisted.current[key] === value) continue;
            // A failed response can follow a successful write. Resend that setting on retry.
            delete persisted.current[key];
            try {
                await saveSetting(restaurantId, key, value);
                persisted.current[key] = value;
            } catch (error) {
                failure ??= error;
            }
        }
        if (failure) throw failure;
    });
    const saving = save.status === "saving";
    useEffect(() => {
        onSavingChange(saving);
    }, [onSavingChange, saving]);

    useEffect(() => {
        if (animate) heading.current?.focus({ preventScroll: true });
    }, [animate, step]);

    const goToStep = (next: number) => {
        setReverse(next < step);
        setAnimate(true);
        setStep(next);
    };
    const scheduleSettings = (next: Setup) => {
        setSetup(next);
        onSavingChange(true);
        save.schedule(next.values);
    };

    const toggle = (key: SettingKey, checked: boolean) => {
        if (!setup) return;
        if (setup.marketingReview && isMarketingSetting(key)) {
            setSetup({
                ...setup,
                marketingReview: {
                    ...setup.marketingReview,
                    choices: { ...setup.marketingReview.choices, [key]: checked },
                },
            });
            return;
        }
        scheduleSettings({ ...setup, values: { ...setup.values, [key]: checked } });
    };

    const current = CHECKOUT_STEPS[step];
    const final = step === FINAL_STEP;
    const settingsStep = step > 0 && !final;
    const reviewingMarketing = step === 1 ? setup?.marketingReview : null;

    const advance = () => {
        if (final) { onClose(); return; }
        if (step === 0) setSkippedSetup(false);
        if (setup && reviewingMarketing) {
            // An explicit off choice must persist even for a rule that had no saved value.
            for (const kind of reviewingMarketing.unconfigured) delete persisted.current[kind];
            scheduleSettings({
                ...setup,
                values: { ...setup.values, ...reviewingMarketing.choices },
                marketingReview: null,
            });
        }
        goToStep(step + 1);
    };

    return (
        <div className="h-full min-h-0 overflow-hidden">
            <ModalFlowStep key={step} animate={animate} reverse={reverse}>
                <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5 pt-7 sm:px-8 sm:pt-8">
                    <div className={step === 0 ? "flex min-h-full flex-col justify-center text-center" : "relative"}>
                        {step === 0 && (
                            <div className="mx-auto mb-5 flex size-20 items-center justify-center rounded-full bg-brand/10">
                                <Image src="/images/party_popper_emoji.png" alt="" width={64} height={64} className="size-16 object-contain" />
                            </div>
                        )}
                        <p className="mb-2 text-xs font-medium text-gray-500">
                            Etapa {step + 1} de {CHECKOUT_STEPS.length}
                        </p>
                        <div className="flex items-start justify-between gap-3">
                            <h2 ref={heading} tabIndex={-1} className={`text-2xl font-bold text-gray-900 outline-none sm:text-3xl ${step === 0 ? "mx-auto" : ""}`}>
                                {current.title}
                            </h2>
                            {step > 0 && <SaveStatus status={save.status} className="absolute -top-1.5 right-9 sm:static" />}
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base">{current.description}</p>
                    </div>

                    {save.status === "error" && (
                        <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-red-700">
                            <span>{save.error}</span>
                            <Button type="button" variant="secondary" onClick={save.retry}>Tentar novamente</Button>
                        </div>
                    )}

                    {settingsStep && setup && (
                        <div className="mt-5 space-y-2.5">
                            {step <= 2 && !setup.connected && (
                                <p className="pb-1 text-sm text-gray-600">
                                    Para enviar mensagens, conecte o WhatsApp na página Robô WhatsApp.
                                </p>
                            )}
                            {SETTINGS.filter((setting) => setting.step === step).map(({ key, title, description, icon: Icon }) => (
                                <ToggleOptionCard key={key} label={title}
                                    description={key === "nfce" ? <>
                                        {description}
                                        {setup.values.nfce && !setup.fiscal.configured && (
                                            <span className="mt-1 block">
                                                Conclua a configuração em{" "}
                                                <strong className="inline-flex items-center gap-1 font-semibold text-gray-700">
                                                    <Settings size={13} aria-hidden="true" />Configurações
                                                </strong>.
                                            </span>
                                        )}
                                    </> : description}
                                    checked={reviewingMarketing && isMarketingSetting(key) ? reviewingMarketing.choices[key] : setup.values[key]}
                                    onChange={(checked) => toggle(key, checked)}
                                    disabled={key === "nfce" && !setup.fiscal.available}
                                    badge={key === "darkMenu" ? <Badge variant="neutral">Opcional</Badge> : undefined}
                                    switchBadge={key === "nfce" && setup.values.nfce && !setup.fiscal.configured
                                        ? <Badge variant="warning" className="font-medium!">Não configurado</Badge> : undefined}
                                    ariaLabel={title} icon={<Icon size={18} aria-hidden="true" />}
                                    className={key === "nfce"
                                        ? "max-sm:p-3! items-start! [&>div:first-child]:items-start [&>div:first-child>span:first-child]:mt-0.5"
                                        : "max-sm:p-3!"} />
                            ))}
                        </div>
                    )}

                    {settingsStep && !setup && (
                        loadError || !restaurantId ? (
                            <div className="mt-5 space-y-3 text-sm text-gray-600">
                                <p role="status">{loadError || "As configurações estão disponíveis no painel do restaurante."}</p>
                                {restaurantId && (
                                    <Button type="button" variant="secondary" onClick={() => { setLoadError(""); setAttempt(attempt + 1); }}>
                                        Tentar novamente
                                    </Button>
                                )}
                            </div>
                        ) : <div className="flex min-h-32 items-center justify-center" role="status" aria-label="Carregando configurações"><Loader /></div>
                    )}

                    {final && (
                        <>
                            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                                {PANEL_SECTIONS.map(({ title, description, icon: Icon }) => (
                                    <li key={title} className="flex min-h-[64px] items-center gap-3 rounded-lg border border-gray-200 bg-white p-3">
                                        <Icon size={18} aria-hidden="true" className="shrink-0 text-brand" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium text-gray-900">{title}</p>
                                            <p className="text-xs text-gray-600">{description}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                            <div className="mt-4 flex flex-wrap items-center gap-2">
                                <p className="text-sm text-gray-600">Lembre-se de que o iMenu Plus inclui <strong>atendimento prioritário</strong>.</p>
                                <SupportWhatsappBadge />
                            </div>
                        </>
                    )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200 bg-white px-4 py-4 sm:gap-3 sm:px-8">
                    {step === 0 ? (
                        <Button type="button" variant="secondary" onClick={() => { setSkippedSetup(true); goToStep(FINAL_STEP); }}>Configurar depois</Button>
                    ) : (
                        <Button type="button" variant="secondary" onClick={() => goToStep(final && skippedSetup ? 0 : step - 1)}
                            leftIcon={<ArrowLeft size={16} aria-hidden="true" />}>Voltar</Button>
                    )}
                    <Button type="button"
                        disabled={(final && saving) || (step === 1 && Boolean(restaurantId) && !setup && !loadError)}
                        rightIcon={final ? undefined : <ArrowRight size={16} aria-hidden="true" />}
                        onClick={advance}>
                        {final ? "Concluir" : step === 0 ? "Configurar agora" : reviewingMarketing ? "Confirmar e continuar" : "Continuar"}
                    </Button>
                </div>
            </ModalFlowStep>
        </div>
    );
}
