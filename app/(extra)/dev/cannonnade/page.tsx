"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Activity,
    ExternalLink,
    LocateFixed,
    Minus,
    Plus,
    RotateCcw,
    Store,
    UsersRound,
} from "lucide-react";

import Button from "@/components/ui/Button";
import { supabase } from "@/lib/database/supabaseClient";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type AccessState = "checking" | "allowed" | "forbidden" | "signed-out";
type DensityMode = "absolute" | "relative";
type Scope = "pe" | "br";

type GeoGeometry = {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
};

type GeoFeature = {
    type: "Feature";
    properties?: {
        code?: string;
        name?: string;
        [key: string]: unknown;
    };
    geometry: GeoGeometry;
};

type GeoFeatureCollection = {
    type: "FeatureCollection";
    features: GeoFeature[];
};

type Merchant = {
    id: string;
    name: string;
    slug: string | null;
    orders30d: number;
    gmv30dCents: number;
};

type City = {
    code: string;
    name: string;
    state: string;
    population: number;
    restaurants: number;
    active30d: number;
    orders30d: number;
    gmv30dCents: number;
    relativeDensity: number;
    merchants: Merchant[];
};

type Payload = {
    scope: Scope;
    state: { code: string; name: string };
    metric: {
        absolute: string;
        relative: string;
    };
    populationYear: string | null;
    referenceCityCode: string | null;
    cities: City[];
    geojson: GeoFeatureCollection;
    totals: {
        municipalities: number;
        citiesWithIMenu: number;
        restaurants: number;
        active30d: number;
    };
    generatedAt: string;
};

type ViewBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type HoverState = {
    code: string;
    x: number;
    y: number;
};

function money(cents: number): string {
    return (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function integer(value: number): string {
    return value.toLocaleString("pt-BR");
}

function decimal(value: number): string {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

function featureCode(feature: GeoFeature): string {
    return String(feature.properties?.code || "");
}

function visitCoordinates(
    value: unknown,
    visit: (longitude: number, latitude: number) => void
) {
    if (!Array.isArray(value)) return;
    if (
        value.length >= 2 &&
        typeof value[0] === "number" &&
        typeof value[1] === "number"
    ) {
        visit(value[0], value[1]);
        return;
    }

    for (const child of value) visitCoordinates(child, visit);
}

function geometryBounds(geometry: GeoGeometry): ViewBox {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    visitCoordinates(geometry.coordinates, (longitude, latitude) => {
        const y = -latitude;
        minX = Math.min(minX, longitude);
        maxX = Math.max(maxX, longitude);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    });

    if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
        return { x: 0, y: 0, width: 1, height: 1 };
    }

    return {
        x: minX,
        y: minY,
        width: Math.max(maxX - minX, 0.0001),
        height: Math.max(maxY - minY, 0.0001),
    };
}

function collectionBounds(features: GeoFeature[]): ViewBox {
    if (!features.length) return { x: 0, y: 0, width: 1, height: 1 };

    const bounds = features.map((feature) => geometryBounds(feature.geometry));
    const minX = Math.min(...bounds.map((item) => item.x));
    const minY = Math.min(...bounds.map((item) => item.y));
    const maxX = Math.max(...bounds.map((item) => item.x + item.width));
    const maxY = Math.max(...bounds.map((item) => item.y + item.height));
    const width = Math.max(maxX - minX, 0.0001);
    const height = Math.max(maxY - minY, 0.0001);
    const paddingX = width * 0.035;
    const paddingY = height * 0.035;

    return {
        x: minX - paddingX,
        y: minY - paddingY,
        width: width + paddingX * 2,
        height: height + paddingY * 2,
    };
}

function ringPath(ring: number[][]): string {
    if (!ring.length) return "";

    return (
        ring
            .map(
                ([longitude, latitude], index) =>
                    `${index === 0 ? "M" : "L"} ${longitude} ${-latitude}`
            )
            .join(" ") + " Z"
    );
}

function geometryPath(geometry: GeoGeometry): string {
    if (geometry.type === "Polygon") {
        return (geometry.coordinates as number[][][]).map(ringPath).join(" ");
    }

    return (geometry.coordinates as number[][][][])
        .flatMap((polygon) => polygon.map(ringPath))
        .join(" ");
}

function CenteredMessage({
    title,
    description,
    actionLabel,
    onAction,
}: {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] p-6 text-center">
            <div className="max-w-md">
                <h1 className="text-xl font-semibold text-[#1d1d1d]">{title}</h1>
                {description && (
                    <p className="mt-2 text-sm leading-6 text-[#626973]">
                        {description}
                    </p>
                )}
                {actionLabel && onAction && (
                    <Button className="mt-5" onClick={onAction}>
                        {actionLabel}
                    </Button>
                )}
            </div>
        </main>
    );
}

export default function CannonnadePage() {
    const router = useRouter();
    const [accessState, setAccessState] = useState<AccessState>("checking");
    const [data, setData] = useState<Payload | null>(null);
    const [scope, setScope] = useState<Scope>("pe");
    const [mode, setMode] = useState<DensityMode>("absolute");
    const [selectedCode, setSelectedCode] = useState<string | null>(null);
    const [selectedMerchantId, setSelectedMerchantId] = useState<string | null>(
        null
    );
    const [hover, setHover] = useState<HoverState | null>(null);
    const [error, setError] = useState("");
    const [viewBox, setViewBox] = useState<ViewBox | null>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const dragRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setError("");
            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session?.access_token) {
                    setAccessState("signed-out");
                    return;
                }

                const response = await fetch(
                    `/api/dev/cannonnade?scope=${scope}`,
                    {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    cache: "no-store",
                    signal: controller.signal,
                    }
                );
                const payload = (await response.json()) as Payload & {
                    error?: string;
                };

                if (response.status === 401) {
                    setAccessState("signed-out");
                    return;
                }
                if (response.status === 403) {
                    setAccessState("forbidden");
                    return;
                }
                if (!response.ok) {
                    throw new Error(payload.error || "Não foi possível carregar o mapa.");
                }

                setData(payload);
                setSelectedCode(payload.referenceCityCode);
                setSelectedMerchantId(null);
                setAccessState("allowed");
            } catch (loadError) {
                if (controller.signal.aborted) return;
                setError(
                    loadError instanceof Error
                        ? loadError.message
                        : "Não foi possível carregar o mapa."
                );
                setAccessState("allowed");
            }
        };

        void load();
        return () => controller.abort();
    }, [scope]);

    const cityByCode = useMemo(
        () => new Map((data?.cities || []).map((city) => [city.code, city])),
        [data]
    );

    const featureByCode = useMemo(
        () =>
            new Map(
                (data?.geojson.features || []).map((feature) => [
                    featureCode(feature),
                    feature,
                ])
            ),
        [data]
    );

    const renderedFeatures = useMemo(
        () =>
            (data?.geojson.features || []).map((feature) => ({
                feature,
                code: featureCode(feature),
                path: geometryPath(feature.geometry),
            })),
        [data]
    );

    const baseViewBox = useMemo(
        () => collectionBounds(data?.geojson.features || []),
        [data]
    );

    useEffect(() => {
        if (!data) return;
        setViewBox(baseViewBox);
    }, [data, baseViewBox]);

    const metricMaximum = useMemo(() => {
        if (!data) return 0;
        return Math.max(
            0,
            ...data.cities.map((city) =>
                mode === "absolute" ? city.restaurants : city.relativeDensity
            )
        );
    }, [data, mode]);

    const selectedCity =
        (selectedCode && cityByCode.get(selectedCode)) ||
        (data?.referenceCityCode
            ? cityByCode.get(data.referenceCityCode)
            : undefined) ||
        null;

    const selectedMerchant =
        selectedCity?.merchants.find(
            (merchant) => merchant.id === selectedMerchantId
        ) || null;

    useEffect(() => {
        setSelectedMerchantId(null);
    }, [selectedCode]);

    const hoveredCity = hover ? cityByCode.get(hover.code) || null : null;

    const metricValue = (city: City | undefined) =>
        !city
            ? 0
            : mode === "absolute"
              ? city.restaurants
              : city.relativeDensity;

    const densityOpacity = (city: City | undefined) => {
        const value = metricValue(city);
        if (value <= 0 || metricMaximum <= 0) return 1;
        return 0.18 + 0.72 * Math.sqrt(value / metricMaximum);
    };

    const zoom = (factor: number, center?: { x: number; y: number }) => {
        setViewBox((current) => {
            if (!current) return current;

            const minimumWidth = baseViewBox.width / 35;
            const maximumWidth = baseViewBox.width * 1.3;
            const targetWidth = Math.min(
                maximumWidth,
                Math.max(minimumWidth, current.width * factor)
            );
            const scale = targetWidth / current.width;
            const targetHeight = current.height * scale;
            const centerX = center?.x ?? current.x + current.width / 2;
            const centerY = center?.y ?? current.y + current.height / 2;

            return {
                x:
                    centerX -
                    ((centerX - current.x) / current.width) * targetWidth,
                y:
                    centerY -
                    ((centerY - current.y) / current.height) * targetHeight,
                width: targetWidth,
                height: targetHeight,
            };
        });
    };

    const focusReference = () => {
        if (!data?.referenceCityCode) return;
        const feature = featureByCode.get(data.referenceCityCode);
        if (!feature) return;

        const bounds = geometryBounds(feature.geometry);
        const centerX = bounds.x + bounds.width / 2;
        const centerY = bounds.y + bounds.height / 2;
        const width = Math.max(bounds.width * 8, baseViewBox.width * 0.18);
        const height = Math.max(bounds.height * 8, baseViewBox.height * 0.18);

        setViewBox({
            x: centerX - width / 2,
            y: centerY - height / 2,
            width,
            height,
        });
        setSelectedCode(data.referenceCityCode);
    };

    const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
        event.preventDefault();
        if (!viewBox || !svgRef.current) return;

        const rectangle = svgRef.current.getBoundingClientRect();
        const x =
            viewBox.x +
            ((event.clientX - rectangle.left) / rectangle.width) * viewBox.width;
        const y =
            viewBox.y +
            ((event.clientY - rectangle.top) / rectangle.height) * viewBox.height;

        zoom(event.deltaY > 0 ? 1.18 : 0.84, { x, y });
    };

    const handlePointerDown = (
        event: React.PointerEvent<SVGSVGElement>
    ) => {
        if (event.button !== 0) return;
        dragRef.current = { x: event.clientX, y: event.clientY };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (
        event: React.PointerEvent<SVGSVGElement>
    ) => {
        if (!dragRef.current || !viewBox || !svgRef.current) return;

        const rectangle = svgRef.current.getBoundingClientRect();
        const dx =
            ((event.clientX - dragRef.current.x) / rectangle.width) *
            viewBox.width;
        const dy =
            ((event.clientY - dragRef.current.y) / rectangle.height) *
            viewBox.height;

        dragRef.current = { x: event.clientX, y: event.clientY };
        setViewBox((current) =>
            current
                ? {
                      ...current,
                      x: current.x - dx,
                      y: current.y - dy,
                  }
                : current
        );
    };

    const endDrag = () => {
        dragRef.current = null;
    };

    if (accessState === "checking") {
        return <CenteredMessage title="Carregando CANNONNADE…" />;
    }

    if (accessState === "signed-out") {
        return (
            <CenteredMessage
                title="Faça login primeiro"
                description={`Entre com ${ALLOWED_DEV_EMAIL} para acessar o CANNONNADE.`}
                actionLabel="Ir para o login"
                onAction={() => router.push("/restaurante/login")}
            />
        );
    }

    if (accessState === "forbidden") {
        return (
            <CenteredMessage
                title="Acesso negado"
                description={`Esta página está disponível somente para ${ALLOWED_DEV_EMAIL}.`}
            />
        );
    }

    if (error || !data || !viewBox) {
        return (
            <CenteredMessage
                title="Não foi possível carregar o CANNONNADE"
                description={error || "Os dados do mapa ainda não estão disponíveis."}
            />
        );
    }

    return (
        <main className="min-h-screen bg-[#f7f8fa] p-4 text-[#1d1d1d] sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1800px]">
                <header className="mb-5 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
                    <div>
                        <p className="text-sm font-medium text-brand">
                            /dev/cannonnade
                        </p>
                        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
                            CANNONNADE
                        </h1>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-[#626973]">
                            Penetração do iMenu por município em{" "}
                            {scope === "br" ? "todo o Brasil" : "Pernambuco"}.
                            Aliança é a cidade de referência para expansão.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <div className="flex rounded-[10px] border border-[#e2e5e9] bg-white p-1">
                            <Button
                                variant="secondary"
                                aria-pressed={scope === "pe"}
                                onClick={() => setScope("pe")}
                                className={
                                    scope === "pe"
                                        ? "!min-h-9 !border-[#1d1d1d] !bg-[#1d1d1d] !px-3 !py-1.5 !text-white"
                                        : "!min-h-9 !border-transparent !px-3 !py-1.5"
                                }
                            >
                                Pernambuco
                            </Button>
                            <Button
                                variant="secondary"
                                aria-pressed={scope === "br"}
                                onClick={() => setScope("br")}
                                className={
                                    scope === "br"
                                        ? "!min-h-9 !border-[#1d1d1d] !bg-[#1d1d1d] !px-3 !py-1.5 !text-white"
                                        : "!min-h-9 !border-transparent !px-3 !py-1.5"
                                }
                            >
                                Brasil
                            </Button>
                        </div>
                        <div className="flex rounded-[10px] border border-[#e2e5e9] bg-white p-1">
                            <Button
                                variant="secondary"
                                aria-pressed={mode === "absolute"}
                                onClick={() => setMode("absolute")}
                                className={
                                    mode === "absolute"
                                        ? "!min-h-9 !border-[#1d1d1d] !bg-[#1d1d1d] !px-3 !py-1.5 !text-white"
                                        : "!min-h-9 !border-transparent !px-3 !py-1.5"
                                }
                            >
                                Bruta
                            </Button>
                            <Button
                                variant="secondary"
                                aria-pressed={mode === "relative"}
                                onClick={() => setMode("relative")}
                                className={
                                    mode === "relative"
                                        ? "!min-h-9 !border-[#1d1d1d] !bg-[#1d1d1d] !px-3 !py-1.5 !text-white"
                                        : "!min-h-9 !border-transparent !px-3 !py-1.5"
                                }
                            >
                                Relativa
                            </Button>
                        </div>
                        <Button variant="secondary" onClick={focusReference}>
                            <LocateFixed size={15} />
                            Aliança
                        </Button>
                    </div>
                </header>

                <section className="overflow-hidden rounded-[10px] border border-[#e2e5e9] bg-white lg:grid lg:min-h-[calc(100dvh-180px)] lg:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="relative h-[68dvh] min-h-[520px] overflow-hidden bg-[#f1f3f5] lg:h-auto lg:min-h-0">
                        <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-8rem)] rounded-[8px] border border-[#e2e5e9] bg-white/95 px-3 py-2 shadow-sm backdrop-blur">
                            <p className="text-xs font-medium text-[#1d1d1d]">
                                {mode === "absolute"
                                    ? data.metric.absolute
                                    : data.metric.relative}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[#626973]">
                                {data.totals.restaurants} restaurantes em{" "}
                                {data.totals.citiesWithIMenu} municípios ·{" "}
                                {data.totals.active30d} ativos nos últimos 30 dias
                            </p>
                        </div>

                        <div className="absolute right-4 top-4 z-20 flex flex-col gap-2">
                            <button
                                type="button"
                                aria-label="Aumentar zoom"
                                onClick={() => zoom(0.78)}
                                className="grid h-10 w-10 cursor-pointer place-items-center rounded-[8px] border border-[#e2e5e9] bg-white text-[#1d1d1d] shadow-sm transition-colors hover:bg-[#f7f8fa]"
                            >
                                <Plus size={17} />
                            </button>
                            <button
                                type="button"
                                aria-label="Diminuir zoom"
                                onClick={() => zoom(1.28)}
                                className="grid h-10 w-10 cursor-pointer place-items-center rounded-[8px] border border-[#e2e5e9] bg-white text-[#1d1d1d] shadow-sm transition-colors hover:bg-[#f7f8fa]"
                            >
                                <Minus size={17} />
                            </button>
                            <button
                                type="button"
                                aria-label="Redefinir mapa"
                                onClick={() => setViewBox(baseViewBox)}
                                className="grid h-10 w-10 cursor-pointer place-items-center rounded-[8px] border border-[#e2e5e9] bg-white text-[#1d1d1d] shadow-sm transition-colors hover:bg-[#f7f8fa]"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>

                        <svg
                            ref={svgRef}
                            role="img"
                            aria-label="Mapa de densidade de restaurantes iMenu em Pernambuco"
                            className="h-full w-full touch-none cursor-grab select-none active:cursor-grabbing"
                            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
                            preserveAspectRatio="xMidYMid meet"
                            onWheel={handleWheel}
                            onPointerDown={handlePointerDown}
                            onPointerMove={handlePointerMove}
                            onPointerUp={endDrag}
                            onPointerCancel={endDrag}
                        >
                            {renderedFeatures.map(({ feature, code, path }) => {
                                const city = cityByCode.get(code);
                                const value = metricValue(city);
                                const selected = code === selectedCode;
                                const reference =
                                    code === data.referenceCityCode;

                                return (
                                    <path
                                        key={code}
                                        d={path}
                                        fill={
                                            value > 0
                                                ? "var(--color-brand)"
                                                : "#ffffff"
                                        }
                                        fillOpacity={
                                            value > 0
                                                ? densityOpacity(city)
                                                : 0.88
                                        }
                                        stroke={
                                            selected
                                                ? "#1d1d1d"
                                                : reference
                                                  ? "var(--color-green)"
                                                  : "#cfd4da"
                                        }
                                        strokeWidth={
                                            selected
                                                ? 2.2
                                                : reference
                                                  ? 1.8
                                                  : 0.8
                                        }
                                        vectorEffect="non-scaling-stroke"
                                        fillRule="evenodd"
                                        className="cursor-pointer transition-[fill-opacity] duration-150 hover:fill-opacity-100"
                                        onPointerEnter={(event) => {
                                            if (!city || dragRef.current) return;
                                            const rectangle =
                                                event.currentTarget.ownerSVGElement?.getBoundingClientRect();
                                            if (!rectangle) return;
                                            setHover({
                                                code,
                                                x:
                                                    event.clientX -
                                                    rectangle.left,
                                                y:
                                                    event.clientY -
                                                    rectangle.top,
                                            });
                                        }}
                                        onPointerLeave={() =>
                                            setHover((current) =>
                                                current?.code === code
                                                    ? null
                                                    : current
                                            )
                                        }
                                        onClick={(event) => {
                                            if (dragRef.current) return;
                                            event.stopPropagation();
                                            setSelectedCode(code);
                                        }}
                                    />
                                );
                            })}
                        </svg>

                        {hoveredCity && hover && (
                            <div
                                className="pointer-events-none absolute z-30 min-w-44 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-[8px] border border-[#e2e5e9] bg-white px-3 py-2 text-xs shadow-lg"
                                style={{
                                    left: Math.max(90, hover.x),
                                    top: Math.max(80, hover.y),
                                }}
                            >
                                <p className="font-medium text-[#1d1d1d]">
                                    {hoveredCity.name}
                                </p>
                                <p className="mt-1 text-[#626973]">
                                    {hoveredCity.restaurants} restaurantes iMenu
                                </p>
                                <p className="text-[#626973]">
                                    {decimal(hoveredCity.relativeDensity)} por 10
                                    mil hab.
                                </p>
                            </div>
                        )}

                        <div className="absolute bottom-4 left-4 z-10 rounded-[8px] border border-[#e2e5e9] bg-white/95 px-3 py-2 text-[11px] text-[#626973] shadow-sm backdrop-blur">
                            <div className="mb-1.5 flex items-center justify-between gap-8">
                                <span>0</span>
                                <span>maior densidade</span>
                            </div>
                            <div className="flex h-2 w-48 overflow-hidden rounded-full">
                                {[0.08, 0.2, 0.35, 0.52, 0.72, 0.9].map(
                                    (opacity) => (
                                        <span
                                            key={opacity}
                                            className="flex-1 bg-brand"
                                            style={{ opacity }}
                                        />
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    <aside className="border-t border-[#e2e5e9] bg-white p-5 lg:border-l lg:border-t-0 lg:p-6">
                        {selectedCity ? (
                            <div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="text-2xl font-semibold">
                                        {selectedCity.name}
                                    </h2>
                                    {selectedCity.code ===
                                        data.referenceCityCode && (
                                        <span className="rounded-full bg-green/10 px-2.5 py-1 text-[11px] font-medium text-green-800">
                                            Referência
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1 text-xs text-[#626973]">
{scope === "br" ? `${selectedCity.state} · ` : ""}
                                    {integer(selectedCity.population)} habitantes
                                    {data.populationYear
                                        ? ` · IBGE ${data.populationYear}`
                                        : ""}
                                </p>

                                <dl className="mt-6 grid grid-cols-2 gap-3">
                                    <div className="rounded-[8px] bg-[#f7f8fa] p-3">
                                        <dt className="flex items-center gap-1.5 text-[11px] text-[#626973]">
                                            <Store size={13} />
                                            iMenu
                                        </dt>
                                        <dd className="mt-1 text-2xl font-semibold tabular-nums">
                                            {selectedCity.restaurants}
                                        </dd>
                                    </div>
                                    <div className="rounded-[8px] bg-[#f7f8fa] p-3">
                                        <dt className="flex items-center gap-1.5 text-[11px] text-[#626973]">
                                            <UsersRound size={13} />
                                            Por 10 mil
                                        </dt>
                                        <dd className="mt-1 text-2xl font-semibold tabular-nums">
                                            {decimal(
                                                selectedCity.relativeDensity
                                            )}
                                        </dd>
                                    </div>
                                    <div className="rounded-[8px] bg-[#f7f8fa] p-3">
                                        <dt className="flex items-center gap-1.5 text-[11px] text-[#626973]">
                                            <Activity size={13} />
                                            Ativos 30d
                                        </dt>
                                        <dd className="mt-1 text-2xl font-semibold tabular-nums">
                                            {selectedCity.active30d}
                                        </dd>
                                    </div>
                                    <div className="rounded-[8px] bg-[#f7f8fa] p-3">
                                        <dt className="text-[11px] text-[#626973]">
                                            GMV 30d
                                        </dt>
                                        <dd className="mt-1 text-lg font-semibold tabular-nums">
                                            {money(
                                                selectedCity.gmv30dCents
                                            )}
                                        </dd>
                                    </div>
                                </dl>

                                <div className="mt-6 border-t border-[#e2e5e9] pt-5">
                                    {selectedMerchant && (
                                        <div className="mb-4 rounded-[8px] border border-green-200 bg-green-50 p-3">
                                            <p className="text-[11px] font-medium text-green-800">
                                                Restaurante selecionado
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-[#1d1d1d]">
                                                {selectedMerchant.name}
                                            </p>
                                            <p className="mt-1 text-xs text-[#626973]">
                                                {selectedMerchant.orders30d} pedidos ·{" "}
                                                {money(selectedMerchant.gmv30dCents)} nos últimos 30 dias
                                            </p>
                                            {selectedMerchant.slug && (
                                                <a
                                                    href={`https://imenuapp.com.br/${selectedMerchant.slug}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                                                >
                                                    Abrir cardápio
                                                    <ExternalLink size={13} />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between gap-3">
                                        <h3 className="text-sm font-medium">
                                            Restaurantes iMenu
                                        </h3>
                                        <span className="text-xs text-[#626973]">
                                            {selectedCity.orders30d} pedidos /
                                            30d
                                        </span>
                                    </div>

                                    {selectedCity.merchants.length ? (
                                        <div className="mt-3 space-y-2">
                                            {selectedCity.merchants
                                                .slice(0, 10)
                                                .map((merchant) => (
                                                    <div
                                                        key={merchant.id}
                                                        className={`flex items-center gap-2 rounded-[8px] border transition-colors ${
                                                            selectedMerchantId === merchant.id
                                                                ? "border-green-200 bg-green-50"
                                                                : "border-[#e2e5e9] bg-white hover:bg-[#f7f8fa]"
                                                        }`}
                                                    >
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setSelectedMerchantId(
                                                                    merchant.id
                                                                )
                                                            }
                                                            className="min-w-0 flex-1 cursor-pointer px-3 py-2.5 text-left"
                                                        >
                                                            <p className="truncate text-sm font-medium">
                                                                {merchant.name}
                                                            </p>
                                                            <p className="mt-0.5 text-[11px] text-[#626973]">
                                                                {merchant.orders30d} pedidos ·{" "}
                                                                {money(
                                                                    merchant.gmv30dCents
                                                                )}
                                                            </p>
                                                        </button>
                                                        {merchant.slug && (
                                                            <a
                                                                href={`https://imenuapp.com.br/${merchant.slug}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                aria-label={`Abrir cardápio de ${merchant.name}`}
                                                                className="mr-2 grid h-8 w-8 shrink-0 place-items-center rounded-[8px] text-brand transition-colors hover:bg-orange-50"
                                                            >
                                                                <ExternalLink size={14} />
                                                            </a>
                                                        )}
                                                    </div>
                                                ))}
                                        </div>
                                    ) : (
                                        <p className="mt-3 rounded-[8px] bg-[#f7f8fa] p-4 text-sm leading-6 text-[#626973]">
                                            Nenhum restaurante com cadastro
                                            concluído nesta cidade.
                                        </p>
                                    )}
                                </div>

                                <p className="mt-6 border-t border-[#e2e5e9] pt-4 text-[11px] leading-5 text-[#626973]">
                                    Bruta = restaurantes iMenu com cadastro
                                    concluído. Relativa = esse total por 10 mil
                                    habitantes. Ativo 30d = restaurante com ao
                                    menos um pedido concluído nos últimos 30
                                    dias.
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-[#626973]">
                                Clique em um município para ver os detalhes.
                            </p>
                        )}
                    </aside>
                </section>
            </div>
        </main>
    );
}
