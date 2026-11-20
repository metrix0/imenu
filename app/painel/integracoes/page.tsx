"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import DeliveryIntegrations from "@/components/restaurant-owner/configuracoes/DeliveryIntegrations";
import SaveStatus, { PageSaveHeader, type SaveState } from "@/components/ui/SaveStatus";

import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import { SupportWhatsappBadge } from "@/components/common/SupportButton";
import Input from "@/components/ui/Input";
import ListLoader from "@/components/ui/ListLoader";
import { useAutoSave } from "@/lib/utils/useAutoSave";
import { cleanMetaPixelId } from "@/lib/analytics/metaEvents";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";

const extractFirst = (value: string, pattern: RegExp) =>
    value.toUpperCase().match(pattern)?.[0] ?? "";

const cleanGa4Id = (value: string) => extractFirst(value, /G-[A-Z0-9]+/);

const cleanGoogleManagerIds = (value: string) => {
    const upper = value.toUpperCase();
    const ids = [
        upper.match(/GTM-[A-Z0-9]+/)?.[0],
        ...(upper.match(/AW-[0-9]+/g) ?? []),
    ].filter((id): id is string => Boolean(id));
    return [...new Set(ids)].join(", ");
};

const EMPTY_TRACKING = {
    ga4_id: "",
    gtm_id: "",
    meta_pixel_id: "",
    ga4_enabled: false,
    gtm_enabled: false,
    is_enabled: false,
};

type Tracking = typeof EMPTY_TRACKING;

const TRACKING_PROVIDERS = [
    {
        id: "ga4_id",
        enabled: "ga4_enabled",
        title: "Google Analytics (GA4)",
        description: "Acompanhe visitas e o comportamento dos clientes no cardápio.",
        logo: "/logos/google-analytics.svg",
        label: "ID de medição do GA4",
        placeholder: "G-XXXXXXXXXX",
        help: "Copie o ID de medição do fluxo de dados Web no Google Analytics. Ele começa com G-.",
        clean: cleanGa4Id,
    },
    {
        id: "gtm_id",
        enabled: "gtm_enabled",
        title: "Google Tag Manager / Google Ads",
        description: "Carregue seu contêiner de tags ou sua tag do Google Ads no cardápio.",
        logo: "/logos/google-tag-manager.svg",
        label: "ID do Google Tag Manager ou Google Ads",
        placeholder: "GTM-XXXXXXX ou AW-XXXXXXXXXX",
        help: "Informe o ID do contêiner (GTM-) ou da tag do Google Ads (AW-). Separe os IDs por vírgula se usar os dois.",
        clean: cleanGoogleManagerIds,
    },
    {
        id: "meta_pixel_id",
        enabled: "is_enabled",
        title: "Meta Pixel e API de Conversões (Facebook/Instagram)",
        description: "Meça ações no cardápio e pedidos atribuídos aos seus anúncios da Meta.",
        logo: "/logos/meta.svg",
        label: "ID do Pixel da Meta",
        placeholder: "123456789012345",
        help: "No Gerenciador de Eventos da Meta, selecione a fonte de dados do seu site e copie o ID do Pixel.",
        clean: cleanMetaPixelId,
    },
] as const;

const META_CAPI_EVENTS = [
    ["ViewContent", "O cliente abre um produto."],
    ["AddToCart", "O cliente adiciona um produto à sacola."],
    ["InitiateCheckout", "O cliente inicia a finalização do pedido."],
    ["AddPaymentInfo", "O cliente informa a forma de pagamento."],
    ["Purchase", "O cliente envia um pedido. No Pix online, o evento é enviado após a confirmação do pagamento."],
] as const;

export default function IntegracoesPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [deliverySaveState, setDeliverySaveState] = useState<SaveState>("idle");
    const [loading, setLoading] = useState(true);
    const [iaPlusOpen, setIaPlusOpen] = useState(false);
    const [iaPlusActive, setIaPlusActive] = useState(false);
    const [tracking, setTracking] = useState(EMPTY_TRACKING);
    const [trackingLoadError, setTrackingLoadError] = useState(false);
    const autosave = useAutoSave<Tracking>(restaurantId || null, async value => {
        if (!restaurantId) throw new Error("Não foi possível identificar o restaurante.");

        const settings = {
            ...value,
            ga4_id: cleanGa4Id(value.ga4_id) || null,
            gtm_id: cleanGoogleManagerIds(value.gtm_id) || null,
            meta_pixel_id: cleanMetaPixelId(value.meta_pixel_id),
        };
        const invalid = TRACKING_PROVIDERS.find(({ id }) => value[id].trim() && !settings[id]);
        if (invalid) throw new Error(`Confira o ID em ${invalid.title}.`);

        const { error } = await supabase.from("tracking_integrations").upsert(
            { restaurant_id: restaurantId, ...settings, updated_at: new Date().toISOString() },
            { onConflict: "restaurant_id" }
        );
        if (error) {
            console.error("[TRACKING] Erro ao salvar integrações:", error);
            throw new Error("Não foi possível salvar o rastreamento de anúncios.");
        }
    });

    function changeTracking(changes: Partial<Tracking>) {
        const next = { ...tracking, ...changes };
        setTracking(next);
        autosave.schedule(next);
    }

    useEffect(() => {
        let canceled = false;
        setLoading(true);
        setTrackingLoadError(false);
        const loadTracking = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (canceled) return;
            if (!session?.user) {
                setLoading(false);
                return;
            }

            let resolvedRestaurantId = restaurantId;
            if (!resolvedRestaurantId) {
                const { data } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .single();
                if (canceled) return;
                if (!data) {
                    setLoading(false);
                    return;
                }
                resolvedRestaurantId = String(data.id);
                setRestaurantId(resolvedRestaurantId);
                return;
            }

            const { data, error } = await supabase
                .from("tracking_integrations")
                .select("ga4_id, gtm_id, meta_pixel_id, ga4_enabled, gtm_enabled, is_enabled")
                .eq("restaurant_id", resolvedRestaurantId)
                .order("updated_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (canceled) return;
            if (error) {
                setTrackingLoadError(true);
            } else if (data) {
                const googleSource = `${data.ga4_id ?? ""} ${data.gtm_id ?? ""}`;
                const ga4Id = cleanGa4Id(googleSource);
                const gtmId = cleanGoogleManagerIds(googleSource);
                const metaId = cleanMetaPixelId(data.meta_pixel_id);
                setTracking({
                    ga4_id: ga4Id,
                    gtm_id: gtmId,
                    meta_pixel_id: metaId ?? "",
                    ga4_enabled: Boolean(ga4Id && data.ga4_enabled),
                    gtm_enabled: Boolean(gtmId && data.gtm_enabled),
                    is_enabled: Boolean(metaId && data.is_enabled),
                });
            } else {
                setTracking(EMPTY_TRACKING);
            }
            setLoading(false);
        };

        void loadTracking();
        return () => { canceled = true; };
    }, [restaurantId, setRestaurantId]);

    useEffect(() => {
        if (!restaurantId) return;
        let canceled = false;
        const loadIaPlus = async () => {
            try {
                const response = await qrTableAuthenticatedFetch(
                    `/api/addons/billing?restaurantId=${encodeURIComponent(restaurantId)}`,
                    { cache: "no-store" }
                );
                if (!response.ok) return;
                const payload = await response.json() as {
                    addons: { addon: { product_key: string }; active: boolean }[];
                };
                if (!canceled) {
                    setIaPlusActive(payload.addons.some(
                        (item) => item.addon.product_key === "ia_plus" && item.active
                    ));
                }
            } catch (error) {
                console.error("[INTEGRACOES] Erro ao carregar iMenu Plus:", error);
            }
        };
        void loadIaPlus();
        return () => { canceled = true; };
    }, [restaurantId]);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <ListLoader lines={4} />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-4xl px-4 pb-24 pt-8 sm:px-6">
            <PageSaveHeader>
                <div className="flex items-start justify-between gap-4">
                    <h1 className="mb-2 text-3xl font-bold text-gray-900">Integrações</h1>
                    <SaveStatus status={deliverySaveState} />
                    <SaveStatus status={autosave.status} />
                </div>
            </PageSaveHeader>
            <p className="mb-6 text-gray-600">
                Configure o rastreamento dos seus anúncios e solicite novas integrações.
            </p>

            <Card className="mb-6 !p-5 sm:!p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            Solicitar integrações
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Com o iMenu Plus, solicite integrações e novas funcionalidades
                            para serem adicionadas em até 3 dias úteis.
                        </p>
                    </div>
                    <Button type="button" className="shrink-0" disabled={!restaurantId} onClick={() => setIaPlusOpen(true)}>
                        Solicitar integração
                    </Button>
                </div>
            </Card>

            {restaurantId && <DeliveryIntegrations key={restaurantId} restaurantId={restaurantId} onSaveState={setDeliverySaveState} />}

            <Card className="space-y-6 !p-5 sm:!p-7">
                <h2 className="text-xl font-semibold text-gray-900">Rastreamento de anúncios</h2>
                {trackingLoadError && (
                    <p role="alert" className="text-sm text-red-600">Não foi possível carregar o rastreamento de anúncios.</p>
                )}
                {autosave.error && <p role="alert" className="text-sm text-red-600">{autosave.error}</p>}
                {!trackingLoadError && TRACKING_PROVIDERS.map(({ id, enabled, title, description, logo, label, placeholder, help, clean }, index) => {
                    const configured = Boolean(clean(tracking[id]));
                    const active = tracking[enabled];
                    const isMeta = id === "meta_pixel_id";

                    return (
                        <CollapsibleSection
                            key={id}
                            className={index > 0 ? "border-t border-gray-200 pt-6" : undefined}
                            title={title}
                            description={description}
                            icon={<Image src={logo} alt="" width={36} height={36} className="h-9 w-9 object-contain" />}
                            badge={
                                !configured ? <Badge variant="warning">Configurar</Badge> :
                                active ? <Badge variant="success">{isMeta ? "Pixel ativado" : "Ativo"}</Badge> :
                                <Badge variant="neutral">Desativado</Badge>
                            }
                            toggle={{
                                checked: active,
                                disabled: !restaurantId,
                                label: `Ativar ${title}`,
                                onChange: checked => changeTracking({ [enabled]: checked }),
                            }}
                        >
                            <div className="space-y-1">
                                <Input
                                    label={label}
                                    placeholder={placeholder}
                                    value={tracking[id]}
                                    inputMode={isMeta ? "numeric" : undefined}
                                    autoComplete="off"
                                    disabled={!restaurantId}
                                    aria-describedby={`${id}-help`}
                                    onChange={event => changeTracking({ [id]: event.target.value })}
                                />
                                <p id={`${id}-help`} className="text-sm text-gray-500">{help}</p>
                            </div>
                            {isMeta && (
                                <div className="space-y-3 text-sm text-gray-600">
                                    <p>O Pixel registra eventos no navegador. Com a API de Conversões configurada, o iMenu também envia eventos pelo servidor. Quando um evento é enviado pelos dois canais, o mesmo ID ajuda a Meta a contar uma única vez.</p>
                                    <h3 className="font-medium text-gray-900">Eventos enviados pela API de Conversões</h3>
                                    <dl className="space-y-2">
                                        {META_CAPI_EVENTS.map(([event, when]) => (
                                            <div key={event} className="grid gap-0.5 sm:grid-cols-[9rem_1fr] sm:gap-3">
                                                <dt className="font-medium text-gray-900">{event}</dt>
                                                <dd>{when}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p>Para configurar a API de Conversões, fale com o suporte.</p>
                                        <SupportWhatsappBadge />
                                    </div>
                                </div>
                            )}
                        </CollapsibleSection>
                    );
                })}
            </Card>

            {restaurantId && (
                <IaPlusSalesModal
                    open={iaPlusOpen}
                    onClose={() => setIaPlusOpen(false)}
                    restaurantId={restaurantId}
                    active={iaPlusActive}
                    contextMessage="Com o iMenu Plus, você pode solicitar novas integrações e funcionalidades para o seu restaurante."
                    onPaid={() => {
                        setIaPlusActive(true);
                        setIaPlusOpen(false);
                    }}
                />
            )}
        </div>
    );
}
