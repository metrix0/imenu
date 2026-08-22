import { query } from "@/lib/database/sql";
import { NextResponse } from "next/server";

type VercelVerification = {
    type?: string;
    domain?: string;
    value?: string;
    reason?: string;
};

type VercelDomain = {
    name?: string;
    apexName?: string;
    verified?: boolean;
    verification?: VercelVerification[];
    error?: { message?: string };
    message?: string;
};

type VercelDomainConfig = {
    configuredBy?: "A" | "CNAME" | "dns-01" | "http" | null;
    misconfigured?: boolean;
    recommendedIPv4?: { rank?: number; value?: string[] }[];
    recommendedCNAME?: { rank?: number; value?: string }[];
};

function normalizeDomain(value: unknown): string {
    const raw = String(value ?? "")
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        .replace(/\.$/, "");

    if (
        !raw ||
        raw.length > 253 ||
        raw.includes(":") ||
        !/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
            raw
        )
    ) {
        return "";
    }

    return raw;
}

function getVercelProjectId(): string {
    const projectId = process.env.VERCEL_PROJECT_ID;

    if (!projectId) {
        throw new Error("Configuração do projeto Vercel indisponível.");
    }

    return projectId;
}

function vercelUrl(path: string): string {
    const projectId = getVercelProjectId();

    return `https://api.vercel.com${path.replace(
        "{projectId}",
        encodeURIComponent(projectId)
    )}`;
}

async function readVercelResponse(response: Response): Promise<VercelDomain> {
    try {
        return (await response.json()) as VercelDomain;
    } catch {
        return {};
    }
}

async function readVercelConfig(
    response: Response
): Promise<VercelDomainConfig> {
    try {
        return (await response.json()) as VercelDomainConfig;
    } catch {
        return {};
    }
}

async function getVercelDomainStatus(
    domain: string,
    token: string,
    vercelDomain: VercelDomain
) {
    const configUrl = new URL(
        `https://api.vercel.com/v6/domains/${encodeURIComponent(domain)}/config`
    );
    configUrl.searchParams.set("projectIdOrName", getVercelProjectId());

    const configResponse = await fetch(configUrl, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
    });
    const config = configResponse.ok
        ? await readVercelConfig(configResponse)
        : {};
    const apexName = vercelDomain.apexName || domain;
    const isApex = domain === apexName;
    const preferredIPv4 =
        config.recommendedIPv4?.find((record) => record.rank === 1)
            ?.value?.[0] ||
        config.recommendedIPv4?.[0]?.value?.[0] ||
        "76.76.21.21";
    const preferredCNAME =
        config.recommendedCNAME?.find((record) => record.rank === 1)?.value ||
        config.recommendedCNAME?.[0]?.value ||
        "cname.vercel-dns-0.com";
    const subdomainSuffix = `.${apexName}`;

    return {
        domain,
        added: true,
        verified: Boolean(vercelDomain.verified),
        configured:
            Boolean(vercelDomain.verified) &&
            configResponse.ok &&
            config.misconfigured === false,
        configurationChecked: configResponse.ok,
        configuredBy: config.configuredBy ?? null,
        verification: Array.isArray(vercelDomain.verification)
            ? vercelDomain.verification
            : [],
        dns: {
            type: isApex ? "A" : "CNAME",
            name: isApex
                ? "@"
                : domain.endsWith(subdomainSuffix)
                  ? domain.slice(0, -subdomainSuffix.length)
                  : domain,
            value: isApex ? preferredIPv4 : preferredCNAME,
        },
    };
}

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const token = process.env.VERCEL_TOKEN;

    if (!id) {
        return NextResponse.json(
            { error: "Restaurant ID is required" },
            { status: 400 }
        );
    }

    if (!token) {
        return NextResponse.json(
            { error: "A conexão de domínios ainda não foi configurada." },
            { status: 503 }
        );
    }

    try {
        const restaurantResult = await query<{
            id: string;
            custom_domain: string | null;
        }>(
            `SELECT id, custom_domain FROM public.restaurants WHERE id = $1 LIMIT 1`,
            [id]
        );
        const restaurant = restaurantResult.rows[0];

        if (!restaurant) {
            return NextResponse.json(
                { error: "Restaurant not found" },
                { status: 404 }
            );
        }

        const domain = normalizeDomain(restaurant.custom_domain);
        if (!domain) {
            return NextResponse.json(
                {
                    domain: null,
                    added: false,
                    verified: false,
                    configured: false,
                    configurationChecked: true,
                    verification: [],
                    dns: null,
                },
                { headers: { "Cache-Control": "no-store" } }
            );
        }

        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
        const detailsResponse = await fetch(
            vercelUrl(
                `/v9/projects/{projectId}/domains/${encodeURIComponent(domain)}`
            ),
            { headers, cache: "no-store" }
        );

        if (detailsResponse.status === 404) {
            return NextResponse.json(
                {
                    domain,
                    added: false,
                    verified: false,
                    configured: false,
                    configurationChecked: true,
                    verification: [],
                    dns: null,
                },
                { headers: { "Cache-Control": "no-store" } }
            );
        }

        const vercelDomain = await readVercelResponse(detailsResponse);
        if (!detailsResponse.ok) {
            return NextResponse.json(
                {
                    error:
                        vercelDomain.error?.message ||
                        vercelDomain.message ||
                        "Não foi possível verificar este domínio.",
                },
                { status: detailsResponse.status }
            );
        }

        return NextResponse.json(
            await getVercelDomainStatus(domain, token, vercelDomain),
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("Error checking custom domain:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Erro interno do servidor.",
            },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const token = process.env.VERCEL_TOKEN;

    if (!id) {
        return NextResponse.json(
            { error: "Restaurant ID is required" },
            { status: 400 }
        );
    }

    if (!token) {
        return NextResponse.json(
            { error: "A conexão de domínios ainda não foi configurada." },
            { status: 503 }
        );
    }

    let domain = "";
    try {
        const body = await request.json();
        domain = normalizeDomain(body?.domain);
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!domain) {
        return NextResponse.json(
            { error: "Informe um domínio válido." },
            { status: 400 }
        );
    }

    if (
        domain === "imenuapp.com.br" ||
        domain.endsWith(".imenuapp.com.br") ||
        domain.endsWith(".vercel.app")
    ) {
        return NextResponse.json(
            { error: "Este domínio não pode ser usado." },
            { status: 400 }
        );
    }

    try {
        const restaurantResult = await query<{
            id: string;
            custom_domain: string | null;
        }>(
            `SELECT id, custom_domain FROM public.restaurants WHERE id = $1 LIMIT 1`,
            [id]
        );

        if (!restaurantResult.rows[0]) {
            return NextResponse.json(
                { error: "Restaurant not found" },
                { status: 404 }
            );
        }

        const duplicateResult = await query<{ id: string }>(
            `
            SELECT id
            FROM public.restaurants
            WHERE LOWER(custom_domain) = LOWER($1)
              AND id <> $2
            LIMIT 1
            `,
            [domain, id]
        );

        if (duplicateResult.rows[0]) {
            return NextResponse.json(
                { error: "Este domínio já está sendo usado por outra loja." },
                { status: 409 }
            );
        }

        const headers = {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        };
        const detailsUrl = vercelUrl(
            `/v9/projects/{projectId}/domains/${encodeURIComponent(domain)}`
        );
        const existingResponse = await fetch(detailsUrl, {
            headers,
            cache: "no-store",
        });

        let vercelDomain: VercelDomain;
        if (existingResponse.ok) {
            vercelDomain = await readVercelResponse(existingResponse);
        } else if (existingResponse.status === 404) {
            const addResponse = await fetch(
                vercelUrl("/v10/projects/{projectId}/domains"),
                {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ name: domain }),
                }
            );
            vercelDomain = await readVercelResponse(addResponse);

            if (!addResponse.ok) {
                return NextResponse.json(
                    {
                        error:
                            vercelDomain.error?.message ||
                            vercelDomain.message ||
                            "Não foi possível conectar este domínio.",
                    },
                    { status: addResponse.status }
                );
            }
        } else {
            const payload = await readVercelResponse(existingResponse);
            return NextResponse.json(
                {
                    error:
                        payload.error?.message ||
                        payload.message ||
                        "Não foi possível verificar este domínio.",
                },
                { status: existingResponse.status }
            );
        }

        await query(
            `
            UPDATE public.restaurants
            SET custom_domain = $2, updated_at = NOW()
            WHERE id = $1
            `,
            [id, domain]
        );

        return NextResponse.json({
            success: true,
            ...(await getVercelDomainStatus(domain, token, vercelDomain)),
        });
    } catch (error) {
        console.error("Error connecting custom domain:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Erro interno do servidor.",
            },
            { status: 500 }
        );
    }
}
