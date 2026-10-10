import { NextResponse } from "next/server";

// Retired: cached confirmation pages must never trigger owner pushes.
export async function POST() {
    return NextResponse.json({ ok: false }, { status: 410 });
}
