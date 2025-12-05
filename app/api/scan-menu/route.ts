import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type ScanRequest = {
    urls: string[];
    restaurantId: string;
};

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
    try {
        const { urls, restaurantId } = (await req.json()) as ScanRequest;

        if (!urls || !Array.isArray(urls)) {
            return NextResponse.json(
                { error: "urls must be an array" },
                { status: 400 }
            );
        }

        if (!restaurantId) {
            return NextResponse.json(
                { error: "restaurantId required" },
                { status: 400 }
            );
        }

        // ----------------------------------------
        // BUILD THE INPUT FOR THE OPENAI API
        // ----------------------------------------

        const inputs: any[] = [];

        // SYSTEM INSTRUCTION
        inputs.push({
            role: "user",
            content: [
                {
                    type: "input_text",
                    text: `
You are analyzing restaurant menu images (photos, scanned pdfs, screenshots).

Extract structured JSON ONLY:

{
  "items": [
    {
      "name": string,
      "description": string | null,
      "price_cents": number | null,
      "image_path": string | null,
      "category_name": string
    }
  ],
  "categories": [
    { "name": string }
  ]
}

Rules:
- Convert prices to integer cents.
- Items must belong to a category.
- If a category is not explicit, infer one.
- Do not add anything outside JSON.
`
                }
            ]
        });

        // MENU IMAGES / PDFs AS URLs
        for (const url of urls) {
            inputs.push({
                role: "user",
                content: [
                    {
                        type: "input_text",
                        text: `Analyze this menu image:`
                    },
                    {
                        type: "input_image",
                        image_url: url // <--- pass URL directly
                    }
                ]
            });
        }

        // ----------------------------------------
        // CALL OPENAI (NEW RESPONSES API)
        // ----------------------------------------
        const response = await client.responses.create({
            model: "gpt-4.1",
            input: inputs,
            max_output_tokens: 6000
        });

        // ----------------------------------------
        // EXTRACT TEXT CORRECTLY (NEW API FORMAT)
        // ----------------------------------------
        const outputText =
            response.output_text ||
            "";

        let parsed;
        try {
            parsed = JSON.parse(outputText);
        } catch (err) {
            console.error("RAW AI OUTPUT:", outputText);
            return NextResponse.json(
                { error: "Could not parse AI JSON output" },
                { status: 500 }
            );
        }

        // ----------------------------------------
        // TRANSFORM INTO YOUR SYSTEM’S FORMAT
        // ----------------------------------------
        const categories = parsed.categories.map((c: any, i: number) => ({
            name: c.name,
            restaurant_id: restaurantId,
            position: i + 1
        }));

        const items = parsed.items.map((it: any, i: number) => ({
            name: it.name,
            description: it.description ?? null,
            price_cents: it.price_cents ?? null,
            image_path: it.image_path ?? null,
            category_name: it.category_name,
            restaurant_id: restaurantId,
            is_available: true,
            position: i
        }));

        return NextResponse.json({ items, categories });
    } catch (err: any) {
        console.error("API ERROR:", err);
        return NextResponse.json(
            { error: "Server error", details: err.message },
            { status: 500 }
        );
    }
}
