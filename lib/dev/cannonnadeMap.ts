export type DensityMode = "absolute" | "relative";
export type Scope = "pe" | "br";

export type GeoGeometry = {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
};

export type GeoFeature = {
    type: "Feature";
    properties?: {
        code?: string;
        name?: string;
        [key: string]: unknown;
    };
    geometry: GeoGeometry;
};

export type GeoFeatureCollection = {
    type: "FeatureCollection";
    features: GeoFeature[];
};

export type Merchant = {
    id: string;
    name: string;
    slug: string | null;
    orders30d: number;
    gmv30dCents: number;
};

export type City = {
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

export type Payload = {
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

export type ViewBox = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type HoverState = {
    code: string;
    x: number;
    y: number;
};

export function money(cents: number): string {
    return (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

export function integer(value: number): string {
    return value.toLocaleString("pt-BR");
}

export function decimal(value: number): string {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function featureCode(feature: GeoFeature): string {
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

export function geometryBounds(geometry: GeoGeometry): ViewBox {
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

export function collectionBounds(features: GeoFeature[]): ViewBox {
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

export function geometryPath(geometry: GeoGeometry): string {
    if (geometry.type === "Polygon") {
        return (geometry.coordinates as number[][][]).map(ringPath).join(" ");
    }

    return (geometry.coordinates as number[][][][])
        .flatMap((polygon) => polygon.map(ringPath))
        .join(" ");
}
