import { NextRequest, NextResponse } from "next/server";

import {
    executeSupportMcpTool,
    SUPPORT_MCP_TOOLS,
    verifySupportMcpToken,
} from "@/lib/services/supportMcp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type JsonRpcRequest = {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, any>;
};

function rpcResult(id: JsonRpcRequest["id"], result: unknown) {
    return NextResponse.json({
        jsonrpc: "2.0",
        id: id ?? null,
        result,
    });
}

function rpcError(
    id: JsonRpcRequest["id"],
    code: number,
    message: string
) {
    return NextResponse.json({
        jsonrpc: "2.0",
        id: id ?? null,
        error: { code, message },
    });
}

export async function POST(request: NextRequest) {
    const conversationId =
        request.nextUrl.searchParams.get("conversationId")?.trim() || "";
    const authorization =
        request.headers.get("authorization")?.trim() || "";
    const token = authorization.replace(/^Bearer\s+/i, "").trim();

    if (
        !conversationId ||
        !token ||
        !verifySupportMcpToken(conversationId, token)
    ) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    let body: JsonRpcRequest;
    try {
        body = (await request.json()) as JsonRpcRequest;
    } catch {
        return rpcError(null, -32700, "Parse error");
    }

    if (body.method === "initialize") {
        return rpcResult(body.id, {
            protocolVersion: "2025-06-18",
            capabilities: { tools: {} },
            serverInfo: {
                name: "imenu-support",
                version: "1.0.0",
            },
        });
    }

    if (body.method === "notifications/initialized") {
        return new NextResponse(null, { status: 202 });
    }

    if (body.method === "ping") {
        return rpcResult(body.id, {});
    }

    if (body.method === "tools/list") {
        return rpcResult(body.id, {
            tools: SUPPORT_MCP_TOOLS,
        });
    }

    if (body.method === "tools/call") {
        const name = String(body.params?.name || "");
        const args = body.params?.arguments ?? {};

        try {
            const result = await executeSupportMcpTool(
                conversationId,
                name,
                args
            );

            return rpcResult(body.id, {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result),
                    },
                ],
                isError: false,
            });
        } catch (error) {
            return rpcResult(body.id, {
                content: [
                    {
                        type: "text",
                        text:
                            error instanceof Error
                                ? error.message
                                : "Support tool failed.",
                    },
                ],
                isError: true,
            });
        }
    }

    return rpcError(body.id, -32601, "Method not found");
}
