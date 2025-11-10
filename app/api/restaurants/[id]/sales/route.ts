// app/api/restaurants/[id]/sales/route.ts
import { query } from "@/lib/sql";
import { NextResponse } from "next/server";

// Helper function to get default dates (Last 7 days)
const getDates = (from?: string, to?: string) => {
    const today = new Date();
    const endDate = to ? new Date(to) : new Date(today);
    
    // Set end date to the end of the day
    endDate.setHours(23, 59, 59, 999);

    const startDate = from ? new Date(from) : new Date(new Date().setDate(today.getDate() - 7));
    // Set start date to the beginning of the day
    startDate.setHours(0, 0, 0, 0);

    return { startDate, endDate };
};

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    
    const { startDate, endDate } = getDates(
        searchParams.get("from") || undefined,
        searchParams.get("to") || undefined
    );

    if (!id) {
        return NextResponse.json({ error: "Restaurant ID is required" }, { status: 400 });
    }

    try {
        // Query 1: Get total stats (Total Sales and Order Count)
        const statsQuery = query(
            `
            SELECT
                COUNT(*) AS total_orders,
                SUM(total_cents) AS total_sales_cents
            FROM public.orders
            WHERE
                restaurant_id = $1
                AND created_at >= $2
                AND created_at <= $3
                AND status = 'paid' 
        `,
            [id, startDate, endDate]
        );

        // Query 2: Get data for the graph (Sales per day)
        const graphQuery = query(
            `
            SELECT
                DATE_TRUNC('day', created_at) AS date,
                SUM(total_cents) AS daily_sales_cents,
                COUNT(*) AS daily_order_count
            FROM public.orders
            WHERE
                restaurant_id = $1
                AND created_at >= $2
                AND created_at <= $3
                AND status = 'paid'
            GROUP BY date
            ORDER BY date ASC
        `,
            [id, startDate, endDate]
        );

        // Run queries in parallel
        const [statsResult, graphResult] = await Promise.all([
            statsQuery,
            graphQuery,
        ]);

        const stats = statsResult.rows[0];
        const graphData = graphResult.rows;

        return NextResponse.json({
            stats: {
                total_orders: parseInt(stats.total_orders, 10) || 0,
                total_sales_cents: parseInt(stats.total_sales_cents, 10) || 0,
            },
            graphData,
        });
    } catch (error) {
        console.error("Error fetching sales data:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}