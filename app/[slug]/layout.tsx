import type { Metadata } from "next";
import { cache, Suspense } from "react";
import Script from "next/script";
import MenuSkeleton from "./loading";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

const SITE_URL = "https://www.imenuapp.com.br";

const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
] as const;

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type AddressData = {
    cep?: unknown;
    state?: unknown;
    city?: unknown;
    neighborhood?: unknown;
    street?: unknown;
    number?: unknown;
    complement?: unknown;
};

type TimeSlot = {
    open: string;
    close: string;
};

type RestaurantSeoData = {
    name: string | null;
    description: string | null;
    logo_url: string | null;
    banner_url: string | null;
    availability_json: unknown;
    address: unknown;
    store_whatsapp: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    first_time: boolean | null;
};

function text(value: unknown): string {
    return String(value ?? "").trim();
}

function getAddress(value: unknown): AddressData | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as AddressData;
}

function formatAddress(value: unknown): string | null {
    const address = getAddress(value);
    if (!address) return null;

    const street = [text(address.street), text(address.number)]
        .filter(Boolean)
        .join(", ");
    const neighborhood = text(address.neighborhood);
    const cityState = [text(address.city), text(address.state)]
        .filter(Boolean)
        .join(" - ");
    const cep = text(address.cep);

    const formatted = [street, neighborhood, cityState, cep && `CEP ${cep}`]
        .filter(Boolean)
        .join(" · ");

    return formatted || null;
}

function getStoreWhatsapp(value: unknown): {
    formatted: string;
    telephone: string;
} | null {
    const rawDigits = text(value).replace(/\D/g, "");
    if (!rawDigits) return null;

    const localDigits =
        rawDigits.startsWith("55") &&
        (rawDigits.length === 12 || rawDigits.length === 13)
            ? rawDigits.slice(2)
            : rawDigits;

    if (localDigits.length !== 10 && localDigits.length !== 11) {
        return null;
    }

    const formatted =
        localDigits.length === 11
            ? `(${localDigits.slice(0, 2)}) ${localDigits.slice(
                  2,
                  7
              )}-${localDigits.slice(7)}`
            : `(${localDigits.slice(0, 2)}) ${localDigits.slice(
                  2,
                  6
              )}-${localDigits.slice(6)}`;

    return {
        formatted,
        telephone: `+55${localDigits}`,
    };
}

function getTimeSlots(value: unknown, day: number): TimeSlot[] {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return [];
    }

    const rawSlots = (value as Record<string, unknown>)[String(day)];
    if (!Array.isArray(rawSlots)) return [];

    const uniqueSlots = new Map<string, TimeSlot>();

    for (const rawSlot of rawSlots) {
        if (!rawSlot || typeof rawSlot !== "object" || Array.isArray(rawSlot)) {
            continue;
        }

        const open = text((rawSlot as Record<string, unknown>).open);
        const close = text((rawSlot as Record<string, unknown>).close);

        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(open)) continue;
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(close)) continue;

        uniqueSlots.set(`${open}-${close}`, { open, close });
    }

    return [...uniqueSlots.values()].sort((first, second) =>
        first.open.localeCompare(second.open)
    );
}

function formatTime(value: string): string {
    const [hour, minute] = value.split(":");
    return minute === "00" ? `${Number(hour)}h` : `${Number(hour)}h${minute}`;
}

function formatDayGroup(days: number[]): string {
    if (days.length === 7) return "todos os dias";

    const consecutive = days.every(
        (day, index) => index === 0 || day === days[index - 1] + 1
    );

    if (consecutive && days.length > 2) {
        return `${DAY_LABELS[days[0]]}–${DAY_LABELS[days.at(-1) ?? days[0]]}`;
    }

    return days.map((day) => DAY_LABELS[day]).join(", ");
}

function formatOpeningHours(value: unknown): string | null {
    const schedules = new Map<string, number[]>();

    for (let day = 0; day < 7; day += 1) {
        const slots = getTimeSlots(value, day);
        if (!slots.length) continue;

        const schedule = slots
            .map((slot) => `${formatTime(slot.open)}–${formatTime(slot.close)}`)
            .join(" e ");
        const days = schedules.get(schedule) || [];
        days.push(day);
        schedules.set(schedule, days);
    }

    if (!schedules.size) return null;

    return [...schedules.entries()]
        .map(([schedule, days]) => `${formatDayGroup(days)} ${schedule}`)
        .join("; ");
}

function getCanonicalUrl(slug: string): string {
    return `${SITE_URL}/${encodeURIComponent(slug)}`;
}

function getPublicUrl(
    supabase: ReturnType<typeof createSupabaseServerClient>,
    bucket: string,
    path: string | null
): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
}

const getRestaurantSeo = cache(
    async (slug: string): Promise<RestaurantSeoData | null> => {
        const supabase = createSupabaseServerClient();
        const { data, error } = await supabase
            .from("restaurants")
            .select(
                "name, description, logo_url, banner_url, availability_json, address, store_whatsapp, latitude, longitude, first_time"
            )
            .eq("url_slug", slug)
            .maybeSingle();

        if (error) {
            console.error("[RESTAURANT_SEO] Failed to load restaurant:", error);
            return null;
        }

        if (!data) return null;

        const row = data as unknown as Record<string, unknown>;
        const logoPath = typeof row.logo_url === "string" ? row.logo_url : null;
        const bannerPath =
            typeof row.banner_url === "string" ? row.banner_url : null;

        return {
            name: typeof row.name === "string" ? row.name : null,
            description:
                typeof row.description === "string" ? row.description : null,
            logo_url: getPublicUrl(
                supabase,
                "restaurant-logos",
                logoPath
            ),
            banner_url: getPublicUrl(
                supabase,
                "menu-banners",
                bannerPath
            ),
            availability_json: row.availability_json,
            address: row.address,
            store_whatsapp:
                typeof row.store_whatsapp === "string"
                    ? row.store_whatsapp
                    : null,
            latitude:
                typeof row.latitude === "number" ||
                typeof row.latitude === "string"
                    ? row.latitude
                    : null,
            longitude:
                typeof row.longitude === "number" ||
                typeof row.longitude === "string"
                    ? row.longitude
                    : null,
            first_time:
                typeof row.first_time === "boolean" ? row.first_time : null,
        };
    }
);

function buildDescription(restaurant: RestaurantSeoData): string {
    const name = text(restaurant.name) || "Restaurante";
    const address = getAddress(restaurant.address);
    const city = text(address?.city);
    const formattedAddress = formatAddress(restaurant.address);
    const whatsapp = getStoreWhatsapp(restaurant.store_whatsapp);
    const openingHours = formatOpeningHours(restaurant.availability_json);

    return [
        `Veja o cardápio de ${name}${city ? ` em ${city}` : ""} e faça seu pedido online.`,
        whatsapp ? `WhatsApp: ${whatsapp.formatted}.` : null,
        formattedAddress ? `Endereço: ${formattedAddress}.` : null,
        openingHours ? `Horários: ${openingHours}.` : null,
    ]
        .filter(Boolean)
        .join(" ");
}

function buildStructuredData(
    slug: string,
    restaurant: RestaurantSeoData
): Record<string, unknown> {
    const canonicalUrl = getCanonicalUrl(slug);
    const address = getAddress(restaurant.address);
    const whatsapp = getStoreWhatsapp(restaurant.store_whatsapp);
    const images = [restaurant.banner_url, restaurant.logo_url].filter(
        (value, index, values): value is string =>
            Boolean(value) && values.indexOf(value) === index
    );
    const latitude =
        restaurant.latitude === null || text(restaurant.latitude) === ""
            ? null
            : Number(restaurant.latitude);
    const longitude =
        restaurant.longitude === null || text(restaurant.longitude) === ""
            ? null
            : Number(restaurant.longitude);
    const openingHoursSpecification = DAY_NAMES.flatMap((dayName, day) =>
        getTimeSlots(restaurant.availability_json, day).map((slot) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: `https://schema.org/${dayName}`,
            opens: slot.open,
            closes: slot.close,
        }))
    );

    const streetAddress = [
        text(address?.street),
        text(address?.number),
        text(address?.complement),
        text(address?.neighborhood),
    ]
        .filter(Boolean)
        .join(", ");

    return {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "@id": `${canonicalUrl}#restaurant`,
        name: text(restaurant.name),
        url: canonicalUrl,
        hasMenu: canonicalUrl,
        description: text(restaurant.description) || buildDescription(restaurant),
        ...(images.length ? { image: images } : {}),
        ...(whatsapp ? { telephone: whatsapp.telephone } : {}),
        ...(address
            ? {
                  address: {
                      "@type": "PostalAddress",
                      ...(streetAddress ? { streetAddress } : {}),
                      ...(text(address.city)
                          ? { addressLocality: text(address.city) }
                          : {}),
                      ...(text(address.state)
                          ? { addressRegion: text(address.state) }
                          : {}),
                      addressCountry: "BR",
                      ...(text(address.cep)
                          ? { postalCode: text(address.cep) }
                          : {}),
                  },
              }
            : {}),
        ...(latitude !== null &&
        longitude !== null &&
        Number.isFinite(latitude) &&
        Number.isFinite(longitude)
            ? {
                  geo: {
                      "@type": "GeoCoordinates",
                      latitude,
                      longitude,
                  },
              }
            : {}),
        ...(openingHoursSpecification.length
            ? { openingHoursSpecification }
            : {}),
    };
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const { slug } = await params;
    const restaurant = await getRestaurantSeo(slug);

    if (!restaurant?.name) {
        return {
            title: "Cardápio não encontrado | iMenu",
            robots: { index: false, follow: false },
        };
    }

    const address = getAddress(restaurant.address);
    const city = text(address?.city);
    const title = `${restaurant.name}${city ? ` em ${city}` : ""} | Cardápio e delivery`;
    const description = buildDescription(restaurant);
    const canonicalUrl = getCanonicalUrl(slug);
    const image =
        restaurant.banner_url ||
        restaurant.logo_url ||
        `${SITE_URL}/placeholders/banner.png`;
    const shouldIndex = restaurant.first_time === false;

    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
        },
        robots: {
            index: shouldIndex,
            follow: shouldIndex,
            googleBot: {
                index: shouldIndex,
                follow: shouldIndex,
            },
        },
        openGraph: {
            type: "website",
            locale: "pt_BR",
            siteName: "iMenu",
            url: canonicalUrl,
            title,
            description,
            images: [
                {
                    url: image,
                    alt: `${restaurant.name} — cardápio e delivery`,
                },
            ],
        },
    };
}

export default async function Layout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const restaurant = await getRestaurantSeo(slug);
    const structuredData =
        restaurant?.name && restaurant.first_time === false
            ? buildStructuredData(slug, restaurant)
            : null;

    return (
        <>
            {structuredData && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{
                        __html: JSON.stringify(structuredData).replace(
                            /</g,
                            "\\u003c"
                        ),
                    }}
                />
            )}

            <Suspense fallback={<MenuSkeleton />}>
                <Script id="ms-clarity" strategy="afterInteractive">
                    {`
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "uk4ichh2nj");
              `}
                </Script>
                {children}
            </Suspense>
        </>
    );
}
